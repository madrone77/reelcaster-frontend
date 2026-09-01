"use client";

/**
 * When to ask an angler to make the spot they are reading their home spot.
 *
 * Setting a home spot is the single highest-leverage thing a new account can
 * do — it is what turns the dashboard from a set of links into a daily report
 * about one piece of water — and until now the only way to do it was an
 * unlabelled house icon in the spot header. This module decides when to say so
 * out loud.
 *
 * The rule is that the offer has to be EARNED. A bar that appears the instant
 * a page opens is chrome; one that appears after the angler has shown the spot
 * matters to them is a suggestion. Two signals count as earned, and either is
 * enough:
 *
 *   * they have opened this spot before (this is view 2+), or
 *   * they have stayed on it — see DWELL_MS.
 *
 * The counting is deliberately local-only. A view count is not worth a row in
 * the database, it is worthless on a device the angler has not used yet, and
 * the whole feature degrades to "never offered" in a browser blocking storage,
 * which is the correct failure.
 */

const VIEWS_KEY = "rc-spot-views";
const DISMISS_KEY = "rc-home-prompt";

/** Opening a spot for the second time is a statement about the spot. */
export const REPEAT_VIEW_THRESHOLD = 2;

/**
 * How long a first visit has to last before it counts on its own.
 *
 * Long enough that a mis-tap and a back button never trip it, short enough
 * that it fires while the angler is still reading rather than after they have
 * moved on.
 */
export const DWELL_MS = 20_000;

/** "Not now" twice means no. */
export const MAX_DISMISSALS = 2;

/** How long the first "Not now" buys. */
export const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Views are capped so this can never grow without bound in a browser that
 * keeps its storage for years. Objects preserve string-key insertion order, so
 * dropping from the front drops the least recently first-seen spots.
 */
const MAX_TRACKED_SPOTS = 40;

type ViewMap = Record<string, number>;

export interface DismissState {
  /** How many times "Not now" has been pressed. */
  n: number;
  /** Epoch ms before which the offer stays quiet. */
  until: number;
}

const NO_DISMISSALS: DismissState = { n: 0, until: 0 };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    return parsed as T;
  } catch {
    // Absent, blocked, or corrupt — all mean "we know nothing", and the gate
    // below treats knowing nothing as not yet earned.
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota. The offer simply won't persist its state, which
    // for a dismissal means it may be asked again — acceptable, and the
    // alternative is throwing inside a render path.
  }
}

/** How many times this spot has been opened, including the current view. */
export function readSpotViews(slug: string): number {
  const views = readJson<ViewMap>(VIEWS_KEY, {});
  const n = views[slug];
  return typeof n === "number" && n > 0 ? n : 0;
}

/**
 * Count one view of `slug` and return the new total.
 *
 * Call once per spot-page mount, from an effect. Calling it during render
 * would double-count under StrictMode and write storage in a render path.
 */
export function recordSpotView(slug: string): number {
  const views = readJson<ViewMap>(VIEWS_KEY, {});
  const next = (typeof views[slug] === "number" ? views[slug] : 0) + 1;
  views[slug] = next;

  const keys = Object.keys(views);
  if (keys.length > MAX_TRACKED_SPOTS) {
    // Never evict the slug we just wrote, even in the pathological case where
    // it is also the oldest key — its count is the answer being returned.
    for (const k of keys.slice(0, keys.length - MAX_TRACKED_SPOTS)) {
      if (k !== slug) delete views[k];
    }
  }

  writeJson(VIEWS_KEY, views);
  return next;
}

/** The angler's standing answer to the offer. */
export function readDismissState(): DismissState {
  const raw = readJson<Partial<DismissState>>(DISMISS_KEY, NO_DISMISSALS);
  return {
    n: typeof raw.n === "number" && raw.n > 0 ? raw.n : 0,
    until: typeof raw.until === "number" && raw.until > 0 ? raw.until : 0,
  };
}

/**
 * Record a "Not now" and return the new state.
 *
 * `now` is passed in rather than read here so the caller — always an event
 * handler — owns the clock read, and so this stays testable.
 */
export function recordDismissal(now: number): DismissState {
  const prev = readDismissState();
  const next: DismissState = {
    n: prev.n + 1,
    until: now + SNOOZE_MS,
  };
  writeJson(DISMISS_KEY, next);
  return next;
}

export interface PromptGateInput {
  /** Views of this spot including the current one. 0 = not counted yet. */
  views: number;
  /** Has this visit lasted DWELL_MS? */
  dwellMet: boolean;
  dismissals: DismissState;
  now: number;
}

/**
 * Has the offer been earned, and is the angler still open to hearing it?
 *
 * Pure, and clock-free apart from the `now` it is handed — every caller reads
 * the clock in an effect or a handler, never in render.
 *
 * Note this answers only "is the moment right". Whether there is already a
 * home spot, whether we are signed in, and whether the pin has even been read
 * back from the server are the caller's to check — see the component.
 */
export function promptEarned({
  views,
  dwellMet,
  dismissals,
  now,
}: PromptGateInput): boolean {
  if (dismissals.n >= MAX_DISMISSALS) return false;
  if (dismissals.n > 0 && now < dismissals.until) return false;
  return views >= REPEAT_VIEW_THRESHOLD || dwellMet;
}
