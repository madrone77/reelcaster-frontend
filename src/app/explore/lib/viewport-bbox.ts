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

/** The zoom a `?spot` deep link opens at — the one its `flyTo` has always used. */
export const SPOT_LINK_ZOOM = 12;

/**
 * A box around a single spot, big enough to cover the frame a `?spot` link
 * opens at whatever size the browser turns out to be.
 *
 * This is a guess, and it has to be: framing a point means "zoom 12 around this
 * coordinate", and how much water that covers depends on the viewport, which
 * the server does not know. A 1440-wide desktop at zoom 12 spans roughly 0.25°
 * of longitude; at 48°N the latitude degrees are Mercator-compressed by about
 * cos(φ), so the same frame is roughly 0.10° tall.
 *
 * The numbers below are about 1.6× that, so the payload covers a desktop frame,
 * a phone held in either orientation, and a little pan slack. Erring wide is
 * nearly free — spots outside the frame just do not draw — while erring narrow
 * costs the thing this whole path exists to avoid: an empty map until the
 * client fetches again.
 *
 * Unlike `openingBbox`, this cannot round to the same key the client will mint,
 * because that key comes from the real viewport. The strip still paints from it
 * immediately and is replaced once when the camera reports; see the seeding
 * comment in explore-shell.
 */
export function spotViewBox(spot: { lat: number; lng: number }): string {
  const HALF_LNG = 0.2;
  const HALF_LAT = 0.12;
  const r = (v: number) => Math.round(v * 100) / 100;
  return [
    r(spot.lng - HALF_LNG),
    r(spot.lat - HALF_LAT),
    r(spot.lng + HALF_LNG),
    r(spot.lat + HALF_LAT),
  ].join(",");
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
