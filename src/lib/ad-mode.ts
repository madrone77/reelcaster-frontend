/**
 * Ad mode: the spot page as a paid-traffic landing page.
 *
 * The destination for a Meta or Google ad is the spot page itself, not a
 * separate /lp variant. An ad that promises "today's bite at Constance Bank"
 * and lands on a page arguing that a forecast is useful has to persuade twice;
 * landing on the forecast itself skips the argument. What changes is the
 * frame, never the data: same payload, same components, same entitlement.
 *
 * Reached as `/explore/spot/<slug>?ad=<wall>`, which src/middleware.ts rewrites
 * to the `/ad` segment beside the public page. The query param is deliberately
 * NOT read by the public page's own `page.tsx`: awaiting `searchParams` there
 * would opt the whole route out of static generation, and that prerender is
 * what keeps its <title> and canonical in <head> instead of streamed into the
 * body. One ad parameter would cost the SEO page its head tags. The rewrite
 * keeps the ad URL and the prerender both.
 */

/**
 * Where the paywall sits on an ad page.
 *
 * A knob rather than a constant because which wall converts is an empirical
 * question, and one ad set per wall answers it in a week. It rides on the URL
 * so the answer costs an ad-set edit rather than a deploy.
 *
 * - `today`  one day open, the rest locked. The ad promised today; the page
 *            delivers today and sells the next thirteen days.
 * - `day2`   what a signed-out visitor already gets on the public page. The
 *            honest control: no tightening, just the ad frame.
 * - `open`   nothing tightened at all. Still two days of forecast, because the
 *            horizon is enforced server-side by entitlement, not here. What
 *            "open" opens is the REST of the page.
 */
export type AdWall = "today" | "day2" | "open";

export const AD_WALLS: readonly AdWall[] = ["today", "day2", "open"] as const;

/**
 * Tightest wall by default. An ad click is the most expensive traffic on the
 * site, so the default is the one that asks for the card soonest; a looser wall
 * has to be chosen deliberately.
 */
export const DEFAULT_AD_WALL: AdWall = "today";

export interface AdMode {
  wall: AdWall;
  /** The pitch the link asked for (`?a=`), shared with the /lp angles so a
   *  spot ad and a landing-page ad can be compared on the same axis. */
  angle: string;
  /**
   * The date the first charge lands, rendered on the server.
   *
   * Computed there and passed down because reading a clock during a client
   * render is what turns a date into a hydration mismatch, which this page has
   * already paid for once. Safe from staleness: the ad frame renders per
   * request, so this is never served out of a cache older than today.
   */
  chargeDate: string;
}

/**
 * `?ad=today` picks a wall; `?ad=1` (or any other value) takes the default.
 *
 * One parameter rather than two because it is typed into an ad platform by
 * hand, and a link that carries `ad=1` without a `wall=` would silently be a
 * fourth variant nobody meant to run.
 */
export function parseWall(raw: string | null | undefined): AdWall {
  const v = (raw ?? "").trim().toLowerCase();
  return (AD_WALLS as readonly string[]).includes(v)
    ? (v as AdWall)
    : DEFAULT_AD_WALL;
}

/** Is this an ad request? Presence of `ad`, whatever its value. */
export function isAdParam(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value !== "";
}
