/**
 * How many spots a signed-out visitor has read this visit.
 *
 * WHY. The proactive Pro ask that used to ride the engagement count was
 * removed for converting at zero: it interrupted a browsing visitor with a
 * modal about a restriction they had not hit (see @/lib/upgrade-nag). This is
 * the other shape of ask, the one every logged-out ChatGPT tab wears: a small
 * card at the bottom of the screen, Log in / Sign up for free, that stays
 * out of the way and never blocks anything. It appears after three spots and
 * asks for a free account, not a card.
 *
 * WHAT COUNTS is a spot READ: the phone's spot sheet, the spot page itself,
 * or the desktop drawer. A pin tap that only shows the preview card does not,
 * because reading a score off a preview is not the same as opening the spot.
 * Distinct slugs, so reloading one spot three times is one spot.
 *
 * sessionStorage, for the same reason the engagement count lives there: a
 * card tap on a phone can navigate to the spot page and back, and the count
 * has to survive the trip. A new tab is a fresh count and a fresh ask; the
 * dismissal is per tab too, so "not now" holds for the visit and no longer.
 *
 * Every storage touch is wrapped: iOS with site data blocked throws on the
 * getter itself, and the module falls back to memory for the page's life.
 */

const STORAGE_KEY = "rc-spot-views";

/** Distinct spots read before the card appears. */
export const SPOT_VIEWS_BEFORE_CTA = 3;

export interface SpotViewsState {
  /** Distinct spot slugs read this visit, oldest first. */
  slugs: readonly string[];
  /** The visit's card was closed. Stays closed for the rest of the tab. */
  dismissed: boolean;
}

const EMPTY: SpotViewsState = Object.freeze({
  slugs: Object.freeze([]) as readonly string[],
  dismissed: false,
});

let state: SpotViewsState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = store()?.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SpotViewsState>;
    state = {
      slugs: Array.isArray(parsed.slugs)
        ? parsed.slugs.filter((s): s is string => typeof s === "string")
        : [],
      dismissed: parsed.dismissed === true,
    };
  } catch {
    // Unreadable: this visit counts from zero.
  }
}

function commit(next: SpotViewsState): void {
  state = next;
  try {
    store()?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Memory only from here; still right for this page's lifetime.
  }
  for (const fn of listeners) fn();
}

export function subscribeSpotViews(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function readSpotViews(): SpotViewsState {
  hydrate();
  return state;
}

export function serverSpotViews(): SpotViewsState {
  return EMPTY;
}

/** Count one spot read. Idempotent per slug; safe to call from an effect. */
export function noteSpotView(slug: string): void {
  if (typeof window === "undefined" || !slug) return;
  hydrate();
  if (state.slugs.includes(slug)) return;
  commit({ ...state, slugs: [...state.slugs, slug] });
}

/** Close the card for the rest of this tab. */
export function dismissSpotViewsCta(): void {
  if (typeof window === "undefined") return;
  hydrate();
  if (state.dismissed) return;
  commit({ ...state, dismissed: true });
}

/** Has this visit read enough spots to be asked? */
export function spotViewsEarned(s: SpotViewsState): boolean {
  return !s.dismissed && s.slugs.length >= SPOT_VIEWS_BEFORE_CTA;
}
