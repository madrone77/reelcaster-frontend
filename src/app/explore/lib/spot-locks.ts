/**
 * Locked spots on the signed-out map.
 *
 * Shipped as split test `explore_locked_spots_v1` (2026-09-19) and made the
 * default 2026-09-20 when locked pins won on trials, 6 to 2.
 *
 * Casey (2026-09-19): on the anonymous map, put locks instead of scores on
 * some spots, so a tap says "unlock scoring
 * at every spot with Pro". The spot the visitor landed on, or the mark the
 * city ad page featured, stays open: the test never takes away a number the
 * page they came from already showed them.
 *
 * WHICH SPOTS. A stable three in five, chosen by hashing the slug. Stable so
 * the same pin is locked on every visit and after every pan, which reads as a
 * rule rather than a tease; enough left open that the map still shows real
 * highs and lows and keeps demonstrating that spots differ. Casey set the
 * share at roughly 60% (2026-09-19) after seeing the half-locked frames. Locking only the
 * best spots was considered and set aside for a first test: the visible
 * scores would then all be middling, and the map would undersell itself.
 *
 * WHO. Every signed-out viewer, on Explore, the city page chart and
 * the hero reel. Never a signed-in viewer, and never while auth is still
 * resolving, so a member does not watch locks appear and then vanish. It
 * began on the ad frame only and was widened to all anonymous traffic the
 * same day (Casey, 2026-09-19).
 *
 * WHAT IS STRIPPED. Everything that is a score: the day peak, the hourly
 * series, the per-species peaks and the driver species. Conditions stay,
 * because tide and wind are not what is being sold. The row itself stays so
 * the pin still stands on the water; it wears a padlock in place of the
 * number. This is a client-side transform of a payload the browser already
 * holds, so it is a UX gate, not protection: the same today score is one tap
 * away on the public spot page.
 */

import type { RailSpot } from "./explore-data";

/** `?keep=` names spots the lock must leave open, comma-separated slugs. */
export const KEEP_PARAM = "keep";

const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** Parse `?keep=a,b,c` into slugs, dropping anything that is not slug-shaped. */
export function parseKeepParam(raw: string | string[] | null | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const out: string[] = [];
  for (const part of value.split(",")) {
    const slug = part.trim().toLowerCase();
    if (SLUG_SHAPE.test(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= 12) break;
  }
  return out;
}

/** djb2 over the slug. Small, stable, and the same in every browser. */
function hashSlug(slug: string): number {
  let h = 5381;
  for (let i = 0; i < slug.length; i++) h = ((h << 5) + h + slug.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Locked share, in tenths of the slug-hash space. 6 = about 60% of spots. */
export const LOCKED_TENTHS = 6;

/**
 * Is this spot locked? The hash's last decimal digit decides
 * (`< LOCKED_TENTHS` locks); the keep set is exempt. A viewer's own spot is
 * never locked: it is their data, not ours to sell.
 */
export function isSpotLocked(
  spot: Pick<RailSpot, "slug" | "isCustom">,
  keep: ReadonlySet<string>,
): boolean {
  if (spot.isCustom) return false;
  if (keep.has(spot.slug)) return false;
  return hashSlug(spot.slug) % 10 < LOCKED_TENTHS;
}

/**
 * Strip the scores off every locked spot and mark it, leaving the rest as
 * they were. Returns the same array when nothing is locked, so memoised
 * consumers do not re-run for a no-op.
 */
export function applySpotLocks(spots: RailSpot[], keep: ReadonlySet<string>): RailSpot[] {
  let changed = false;
  const out = spots.map((s) => {
    if (!isSpotLocked(s, keep)) return s;
    changed = true;
    return {
      ...s,
      locked: true,
      score: null,
      bestSpeciesId: null,
      driverSpecies: null,
      peakHour: null,
      hours24: [],
      scoresBySpecies: {},
    } satisfies RailSpot;
  });
  return changed ? out : spots;
}
