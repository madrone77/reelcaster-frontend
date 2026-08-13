// The Explore viewport's bbox key, and the box the page opens on.
//
// Extracted from explore-shell so the SERVER can compute the same key the
// client will seed itself with. That equality is the whole point: the page
// prefetches the 14-day strip for this box, and the client's own seed has to
// round to the identical string or it would refetch what it was just handed.

import type { RailSpot } from "./explore-data";

export interface ViewBounds {
  w: number;
  s: number;
  e: number;
  n: number;
}

/**
 * The strip's fetch key: the box padded 20% and rounded.
 *
 * Rounded to 2dp (~1 km), not 3. The map settles in stages — `load`, then the
 * `fitBounds` animation, then a resize — and each stage used to mint a
 * bbox that differed in the fourth decimal, missing the payload cache and
 * refetching the same 14 days. At 2dp those stages collapse onto one key.
 */
export function paddedBbox(b: ViewBounds): string {
  const padLng = (b.e - b.w) * 0.2;
  const padLat = (b.n - b.s) * 0.2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return `${r(b.w - padLng)},${r(b.s - padLat)},${r(b.e + padLng)},${r(b.n + padLat)}`;
}

export function boundsOf(
  spots: RailSpot[],
): [[number, number], [number, number]] | null {
  if (spots.length === 0) return null;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const spot of spots) {
    w = Math.min(w, spot.lng);
    e = Math.max(e, spot.lng);
    s = Math.min(s, spot.lat);
    n = Math.max(n, spot.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/**
 * The box a cold /explore opens on: the default city's spots, padded — exactly
 * what the shell's mount-time seed computes from the same `spots` array.
 *
 * Returns null when there is nothing to frame (empty or failed payload); the
 * caller falls back to the covered-region box, same as the client does.
 *
 * A remembered view (rc:exploreView) can override this on the client, and a
 * `?loc` / `?spot` deep link names its own place. Both are browser-side facts
 * the server cannot see, so the prefetch simply goes unused on those loads —
 * it is right for the cold, bare /explore that most arrivals are.
 */
export function openingBbox(
  spots: RailSpot[],
  defaultCitySlug: string | null,
): string | null {
  const citySpots = defaultCitySlug
    ? spots.filter((s) => s.citySlug === defaultCitySlug)
    : spots;
  const bounds = boundsOf(citySpots.length > 0 ? citySpots : spots);
  if (!bounds) return null;
  return paddedBbox({
    w: bounds[0][0],
    s: bounds[0][1],
    e: bounds[1][0],
    n: bounds[1][1],
  });
}
