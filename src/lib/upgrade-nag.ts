/**
 * The engagement count: how /explore knows a visitor is actually using it.
 *
 * WHY THIS EXISTS. Every upgrade wall on /explore is reactive. It waits for
 * someone to tap a locked day, a locked reports panel, "set alert" or "create
 * custom spot", and only then does the modal open. That works for a visitor
 * who goes looking for the edges of the free tier. It does nothing at all for
 * the visitor a Meta ad just bought, who lands on the map, opens three spots,
 * reads the scores, never touches a lock, and leaves. They were interested
 * enough to click four times and were never once asked for anything.
 *
 * So this counts the clicks instead of waiting for a wall, and when the count
 * says "this person is actually using the thing", one ask is made unprompted.
 *
 * WHAT THE COUNT NOW OPENS is the depth gate, and only the depth gate — the
 * ask for a free account on the ad frame, which has something behind it: say
 * no and the charted depth goes away. See @/lib/preview-gate.
 *
 * IT USED TO OPEN <ProTrialModal feature="whole-map"> as well, on /explore and
 * on the spot page. That was removed. Over seven days the two together took 33
 * impressions and produced no clicks, while every wall a visitor walked into
 * on their own converted — the top-bar ask at 33%, a locked day at 6-10%,
 * custom spots at 12%. The lesson is in the headline it used: "Unlock the
 * whole map", said to somebody whose map was not locked and who had not been
 * refused anything. The threshold was never the problem, so the trigger went
 * rather than the number. Anything wired here in future should be an ask about
 * something the visitor has actually run into.
 *
 * THE COUNT. A browse click (opening a spot, picking a day, filtering, picking
 * a station) is worth 1. Anything gated is worth 2, because bouncing off a
 * wall says more about intent than panning a map does. Four points earns the
 * ask. The numbers live here as named constants so they can be tuned in one
 * place once the paywall report has something to say about them.
 *
 * IT LIVES IN sessionStorage, and it has to. On a phone, tapping a spot card
 * on /explore navigates to /explore/spot/<slug>, so a counter in React state
 * would be wiped by exactly the click that proves the most interest. A session
 * counter survives the trip and is still there when they come back to the map.
 * It also gives "once per visit" its meaning for free: a new tab is a new
 * session and a fresh ask, a reload is neither.
 *
 * STORAGE CAN THROW. iOS with cookies blocked does not return null from
 * sessionStorage, it throws on the property access itself, which is how a
 * white screen got shipped once already. Every read and write here is wrapped,
 * and the module falls back to a plain in-memory count, which still works for
 * the whole of one page's life.
 *
 * A WALL RESTARTS THE COUNT, AT TWO (see `noteWallShown`, called by
 * <ProTrialModal> on every open). Somebody who just closed the plan matrix
 * does not want another dialog ninety seconds later because they carried on
 * browsing, so the count starts over. It does not start over at zero, though:
 * walking into a wall is the strongest signal on the page, so it carries
 * forward as the two points a lock is worth and leaves them halfway to the
 * next ask. In practice a visitor who hits a wall, closes it, and keeps
 * digging is asked again two clicks later; a visitor who never hits one is
 * asked after four. The once-per-visit budget caps both at a single
 * unprompted modal either way.
 *
 * That is the only path the `gated` weight has on /explore today, because
 * every lock on the page already opens this modal. The weight is still the
 * right vocabulary for the first lock that does not (an inert strip on a spot
 * page, say), which is why it is a named constant rather than a literal.
 *
 * NOT FOR PRO, and not for the ad frame (`?ad=`), which is a page built around
 * a single offer already on screen. Both gates are the caller's, in
 * `useUpgradeNag`.
 */

const STORAGE_KEY = 'rc-explore-nag';

/**
 * What a click is worth. A lock counts double: refusing to pay is a decision,
 * and someone who has made it once is closer to the buy than someone who has
 * only been reading scores.
 */
export const NAG_WEIGHTS = { browse: 1, gated: 2 } as const;

export type NagSignal = keyof typeof NAG_WEIGHTS;

/** Points that earn the ask. */
export const NAG_THRESHOLD = 4;

export interface NagState {
  /** Points banked since the last wall, or since the visit began. */
  score: number;
  /** Has the one proactive ask of this visit already been spent? */
  asked: boolean;
}

/**
 * The server snapshot, and the value every reader starts from. Frozen and
 * shared so `useSyncExternalStore` sees one stable identity before hydration
 * rather than a new object per render.
 */
const EMPTY: NagState = Object.freeze({ score: 0, asked: false });

let state: NagState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reads the session's count exactly once, on first access from the browser. */
function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = store()?.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<NagState>;
    state = {
      score:
        typeof parsed.score === 'number' && parsed.score >= 0
          ? parsed.score
          : 0,
      asked: parsed.asked === true,
    };
  } catch {
    // Unreadable or unparseable: this visit counts from zero. A nag that
    // cannot read its own bookkeeping asks once too often at worst.
  }
}

function commit(next: NagState): void {
  state = next;
  try {
    store()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // In-memory only from here. Still correct for this page's lifetime.
  }
  for (const fn of listeners) fn();
}

export function subscribeNag(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function readNag(): NagState {
  hydrate();
  return state;
}

export function serverNag(): NagState {
  return EMPTY;
}

/**
 * Count a click. Cheap and safe to call from anywhere, including from a
 * handler that is about to navigate: nothing here is async.
 *
 * Stops counting once the ask has been spent, so the number in storage stays
 * the small honest thing it is rather than climbing all visit.
 */
export function noteEngagement(signal: NagSignal, action?: NagAction): void {
  if (typeof window === 'undefined') return;
  hydrate();
  // Journalled BEFORE the `asked` gate, and deliberately outside it. The score
  // stops climbing once this visit's one ask is spent, because its only job is
  // to decide whether to ask; the journal keeps recording, because its job is
  // to describe what somebody did before they walked into a wall and that
  // question does not stop being interesting after the first modal.
  if (action) noteAction(action);
  if (state.asked) return;
  commit({ ...state, score: state.score + NAG_WEIGHTS[signal] });
}

/* -------------------------------------------------------------------------
 * The journal — what they did before the wall opened.
 * ---------------------------------------------------------------------- */

/**
 * The vocabulary of things worth remembering about a visit to /explore.
 *
 * KINDS ONLY, never content. "search_spot" is recorded; what was typed into
 * the search box is not, here or anywhere downstream. The question this
 * answers is "was this person using the map or bouncing off it", and the
 * answer never needed the strings.
 */
export type NagAction =
  | 'spot_open'
  | 'spot_preview'
  | 'search_spot'
  | 'search_species'
  | 'species_filter'
  | 'score_filter'
  | 'station_pick'
  | 'day_pick'
  | 'spot_page'
  | 'wall';

export interface JournalEntry {
  /** What they did. */
  k: NagAction;
  /** Seconds since the first entry of this visit. */
  t: number;
}

/**
 * How many actions ride along with a paywall event.
 *
 * Twelve is the shape of a visit, not a transcript of one. The interesting
 * distinctions — bounced straight into a lock, browsed six spots first,
 * filtered then hit the fortnight — all resolve well inside it, and the whole
 * array has to fit in a fire-and-forget request body sent while the page is
 * navigating away.
 */
const JOURNAL_MAX = 12;
const JOURNAL_KEY = 'rc-explore-journal';

interface Journal {
  /** Epoch ms of the first entry, so `t` can stay a small integer. */
  t0: number;
  entries: JournalEntry[];
}

let journal: Journal | null = null;
let journalHydrated = false;

function hydrateJournal(): void {
  if (journalHydrated || typeof window === 'undefined') return;
  journalHydrated = true;
  try {
    const raw = store()?.getItem(JOURNAL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Journal>;
    if (typeof parsed.t0 === 'number' && Array.isArray(parsed.entries)) {
      journal = { t0: parsed.t0, entries: parsed.entries.slice(-JOURNAL_MAX) };
    }
  } catch {
    // An unreadable journal is an empty one. Same argument as the score above.
  }
}

/**
 * Append one action. Keeps the LAST `JOURNAL_MAX`, not the first: the actions
 * nearest the wall are the ones that explain it.
 */
export function noteAction(action: NagAction): void {
  if (typeof window === 'undefined') return;
  hydrateJournal();
  const now = Date.now();
  if (!journal) journal = { t0: now, entries: [] };
  journal.entries.push({ k: action, t: Math.round((now - journal.t0) / 1000) });
  if (journal.entries.length > JOURNAL_MAX) {
    journal.entries = journal.entries.slice(-JOURNAL_MAX);
  }
  try {
    store()?.setItem(JOURNAL_KEY, JSON.stringify(journal));
  } catch {
    // In-memory for the rest of this page's life, which is enough for a wall
    // opened on the page that is already loaded.
  }
}

/** The visit so far, oldest first. Empty when nothing has been done yet. */
export function readJournal(): JournalEntry[] {
  if (typeof window === 'undefined') return [];
  hydrateJournal();
  return journal?.entries ?? [];
}

/** Spends the visit's one proactive ask. Called when the nag actually opens. */
export function markNagAsked(): void {
  hydrate();
  if (state.asked) return;
  commit({ score: 0, asked: true });
}

/**
 * A wall just showed the plan matrix, so the pitch has been made and the count
 * starts over at what a lock is worth. Called by <ProTrialModal> on every
 * open, which is why it catches walls this module has never heard of, and why
 * it has to be idempotent: React runs the effect twice in development.
 */
export function noteWallShown(): void {
  if (typeof window === 'undefined') return;
  hydrate();
  if (state.asked || state.score === NAG_WEIGHTS.gated) return;
  commit({ ...state, score: NAG_WEIGHTS.gated });
}
