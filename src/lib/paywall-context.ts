/**
 * What the reader was looking at when a wall opened.
 *
 * THE PROBLEM THIS SOLVES. A wall is opened by whichever component owns the
 * lock — a day tile in the forecast strip, a star on a spot card, the top bar.
 * None of them knows the spot in front of the reader, because on /explore the
 * selected spot lives in explore-shell and the strip is region-scoped: the
 * fortnight under the map is the whole viewport's, not one pin's. Threading a
 * slug down through fifteen components to reach a fire-and-forget counter
 * would be a large diff in files that have nothing to do with reporting, and
 * every new wall would have to remember to do it.
 *
 * So the page publishes what it is showing, once, and the counter reads it.
 * A module singleton rather than a context provider, for the same reason
 * `upgrade-nag` is one: the reader is a plain function called from an event
 * handler that is often about to navigate, and it must not need a hook, a
 * render, or a mounted tree to answer.
 *
 * SET IT WHERE THE SELECTION CHANGES, not in an effect that mirrors state. The
 * value has to be true at the instant a lock is tapped, and an effect that
 * runs after paint is one frame too late for a tap that opens a modal
 * synchronously.
 *
 * STALENESS IS THE FAILURE MODE, so this expires. A slug set on /explore and
 * never cleared would still be here when the same tab hits a wall on the
 * marketing page twenty minutes later, and would put a spot on an event that
 * had nothing to do with it. Anything older than `MAX_AGE_MS` reads as absent.
 */

export interface PaywallContext {
  /** The spot in front of them, when there is one. */
  spotSlug?: string;
  /** Its display name, for the modal headline. Never stored server side. */
  spotName?: string;
  /** The city whose water they are looking at. */
  citySlug?: string;
  /** The species filter in force, if any. */
  speciesId?: string;
  /** Which page published this, so a stale value is obvious in the data. */
  page?: 'explore' | 'spot' | 'city' | 'other';
}

/** Two minutes. Longer than any gap between a selection and the tap after it. */
const MAX_AGE_MS = 1000 * 60 * 2;

let current: PaywallContext = {};
let setAt = 0;

/**
 * Publish what is on screen. Merges rather than replaces, so a component that
 * knows only the species filter does not have to know the spot as well.
 * Passing `undefined` for a key leaves it alone; clearing is `clearPaywallContext`.
 */
export function setPaywallContext(next: PaywallContext): void {
  if (typeof window === 'undefined') return;
  current = { ...current, ...prune(next) };
  setAt = Date.now();
}

/** Forget everything. Called when a selection is closed. */
export function clearPaywallContext(keep: Pick<PaywallContext, 'page'> = {}): void {
  current = { ...keep };
  setAt = Date.now();
}

/** What was on screen, or an empty object if nothing recent enough was. */
export function readPaywallContext(): PaywallContext {
  if (typeof window === 'undefined') return {};
  if (!setAt || Date.now() - setAt > MAX_AGE_MS) return {};
  return current;
}

/** Drop undefined values so a merge cannot blank a field by omission. */
function prune(value: PaywallContext): PaywallContext {
  const out: PaywallContext = {};
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined && v !== null && v !== '') {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}
