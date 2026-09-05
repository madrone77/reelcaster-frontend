/**
 * How many spot pages an ad-framed visit may open before the offer.
 *
 * Under the ad frame a spot open is the tap that shows the most intent, and
 * FE PR #563 made every one of them open the trial modal instead of the
 * page. Casey's call (2026-09-04): on `?ad=day2` the first TWO opens go
 * through to the (still framed) spot page, and the third makes the offer.
 * The `today` and `open` walls keep asking on the first tap.
 *
 * Counted per tab in sessionStorage, keyed by wall, so the allowance
 * survives the round trip through the spot page and its "Back to map" link,
 * and a fresh tab from the same ad click starts over. `ensureSafeStorage`
 * has already swapped a blocked store for an in-memory one by the time
 * this runs, and the try/catch is for whatever it could not swap.
 */
import type { AdWall } from "@/lib/ad-mode";

export const SPOT_OPENS_BEFORE_OFFER: Record<AdWall, number> = {
  today: 0,
  day2: 2,
  open: 0,
};

const KEY = "rc_ad_spot_opens";

function read(wall: AdWall): number {
  try {
    const n = Number(window.sessionStorage.getItem(`${KEY}:${wall}`));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** How many spot pages this tab has opened under the wall so far. */
export function adSpotOpensUsed(wall: AdWall): number {
  return typeof window === "undefined" ? 0 : read(wall);
}

/**
 * Spend one of the wall's spot opens. True when the page may open, false
 * when the allowance is used up and the caller should make the offer.
 */
export function takeAdSpotOpen(wall: AdWall): boolean {
  if (typeof window === "undefined") return false;
  const used = read(wall);
  if (used >= SPOT_OPENS_BEFORE_OFFER[wall]) return false;
  try {
    window.sessionStorage.setItem(`${KEY}:${wall}`, String(used + 1));
  } catch {
    // Nothing to persist to; the next tap counts from zero again.
  }
  return true;
}
