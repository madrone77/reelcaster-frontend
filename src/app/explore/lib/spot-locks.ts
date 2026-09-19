/**
 * Locked spots on the ad-framed map: `explore_locked_spots_v1`.
 *
 * Casey (2026-09-19): on the anonymous map reached from a Meta or Google ad,
 * put locks instead of scores on some spots, so a tap says "unlock scoring
 * at every spot with Pro". The spot the visitor landed on, or the mark the
 * city ad page featured, stays open: the test never takes away a number the
 * page they came from already showed them.
 *
 * WHICH SPOTS. A stable half, chosen by hashing the slug. Stable so the same
 * pin is locked on every visit and after every pan, which reads as a rule
 * rather than a tease; a half so the open pins still show real highs and
 * lows and the map keeps demonstrating that spots differ. Locking only the
 * best spots was considered and set aside for a first test: the visible
 * scores would then all be middling, and the map would undersell itself.
 *
 * WHO. Only inside the ad frame (`?ad=`), only arm b, and never a signed-in
 * viewer: the frame is what says the visit was paid for, and a member who
 * clicked their own ad keeps what their account entitles them to.
 *
 * WHAT IS STRIPPED. Everything that is a score: the day peak, the hourly
 * series, the per-species peaks and the driver species. Conditions stay,
 * because tide and wind are not what is being sold. The row itself stays so
 * the pin still stands on the water; it wears a padlock in place of the
 * number. This is a client-side transform of a payload the browser already
 * holds, so it is a UX gate, not protection: the same today score is one tap
 * away on the public spot page. Fine for a split test.
 */

import type { RailSpot } from "./explore-data";

export const LOCKED_SPOTS_TEST = "explore_locked_spots_v1";

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

/**
 * Is this spot locked under the test? Odd hashes lock; the keep set is exempt.
 * A viewer's own spot is never locked: it is their data, not ours to sell.
 */
export function isSpotLocked(
  spot: Pick<RailSpot, "slug" | "isCustom">,
  keep: ReadonlySet<string>,
): boolean {
  if (spot.isCustom) return false;
  if (keep.has(spot.slug)) return false;
  return (hashSlug(spot.slug) & 1) === 1;
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
