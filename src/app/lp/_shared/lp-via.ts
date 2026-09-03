/**
 * Which landing page sent this visit to Explore.
 *
 * Every landing page's button now opens Explore in the ad frame
 * (`/explore?loc=<city>&ad=day2`), the same frame an ad opens it in, so the
 * campaign counter could no longer tell "came from our landing page" from
 * "came straight from an ad" by the wall, and bluecaster's Analytics fell
 * back to guessing from the parameters. This is the stamp that ends the
 * guessing: the button carries `via=<its own landing key>`, Explore records
 * it on the arrival, and the report can say which page sent whom.
 *
 * It rides in the counter's `angle` column as `lp:<landing>`. On a landing
 * page row `angle` is the pitch the ad link asked for; on an Explore arrival
 * that column was always empty, and "what the link asked for" is the same
 * question from the other side. No migration, no new column, and the value
 * is in the counter's key so each landing page gets its own row.
 *
 * Deliberately NOT a utm parameter. A utm on the button would rewrite what
 * Plausible and GA think the session's source is, and would read to the
 * attribution cookies as a fresh touch. `via` is ours alone and nothing else
 * looks at it.
 */

export const VIA_PARAM = "via";

/** The landing keys the campaign counter accepts, minus spot and explore. */
const VIA_SHAPE = /^lp[a-z0-9]{1,24}$/;

/** The angle an arrival carries when a landing page stamped it. */
export const VIA_ANGLE_PREFIX = "lp:";
export const VIA_ANGLE_SHAPE = /^lp:lp[a-z0-9]{1,24}$/;

/** The landing key from a `?via=` value, or null for anything malformed. */
export function parseVia(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return VIA_SHAPE.test(v) ? v : null;
}

/** What the counter stores for a stamped arrival. */
export function viaAngle(via: string): string {
  return `${VIA_ANGLE_PREFIX}${via}`;
}

/**
 * The landing page's button link: the city, the frame, and the stamp. One
 * function so the nav, the hero and the close cannot disagree, and so no page
 * can forget the stamp.
 */
export function exploreHrefFrom(citySlug: string, landing: string): string {
  const params = new URLSearchParams({ loc: citySlug, ad: "day2" });
  const via = parseVia(landing);
  if (via) params.set(VIA_PARAM, via);
  return `/explore?${params.toString()}`;
}
