/**
 * try.reelcaster.com, the host paid traffic lands on.
 *
 * Every ad we buy points here rather than at www. The pages are the same
 * `/lp/*` routes on the same Vercel project; only the hostname and the visible
 * path differ, so this is a presentation choice and not a second deployment.
 *
 * Why a separate host at all:
 *
 *   - An ad's display URL is the hostname. `try.reelcaster.com` reads as an
 *     offer; `www.reelcaster.com/lp/7` reads as a deep link into an app, which
 *     is not what somebody who has never heard of us is being sold.
 *   - It keeps the paid surface nameable in one word when talking to an ad
 *     platform, a reviewer, or ourselves.
 *
 * Why it is NOT what it might look like: this does not isolate the main domain
 * from ad-policy risk. Meta and Google score the registrable domain, so a flag
 * raised against try.reelcaster.com lands on reelcaster.com and everything
 * under it. Only a separate registrable domain would do that, and it would
 * cost a duplicated checkout path to get. If that ever becomes the goal, this
 * file is the wrong tool.
 *
 * A constant rather than an env var, matching src/lib/site.ts and
 * src/lib/plausible.ts: the value ships in the ad links we generate and in
 * every redirect below, so it is worth reading in a diff.
 */
export const LANDING_HOST = "try.reelcaster.com";

/** `https://try.reelcaster.com`, for building an absolute ad link. */
export const LANDING_ORIGIN = `https://${LANDING_HOST}`;

/**
 * Is this request on the landing host?
 *
 * The Host header carries the port in local development and the case is not
 * guaranteed, so neither is trusted. Preview deployments answer on their own
 * `*.vercel.app` hostname and are deliberately NOT landing hosts: a preview
 * should behave like www so the whole app stays clickable while reviewing it.
 */
export function isLandingHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.split(":")[0].toLowerCase() === LANDING_HOST;
}

/**
 * The prefix `/lp` routes are reached by on this host.
 *
 * On www the pages live where they always have, at `/lp/<variant>`. On the
 * landing host the `/lp` segment is dropped, because a host that exists to
 * make the URL read cleanly and then puts an internal folder name in it has
 * only moved the problem. Middleware rewrites the short form back onto the
 * real route; this is how server-side redirects inside those pages know which
 * shape to emit so the browser never sees the `/lp` they were rewritten from.
 */
/**
 * ⚠ What the rewrite costs, and why it is still the right trade.
 *
 * Middleware serves the short paths by rewriting them onto `/lp/*`. A rewrite
 * changes what Next does with the two control-flow escapes a page can raise:
 * `redirect()` and `notFound()` are NOT sent as 307 and 404 from a rewritten
 * request. Next serialises them into the RSC payload and answers 200, leaving
 * the browser to act on them after it parses the response. Both middleware
 * rewrites and next.config rewrites behave this way (checked against Next
 * 15.3.6, both routes, before settling on this shape).
 *
 * Two places that matters, and what is done about each:
 *
 *   - The doorway (`/7?city=…`), which every ad click passes through. NOT left
 *     to the page: middleware answers it with a real 307 before the rewrite
 *     happens. This is the correctness fix, not a performance one.
 *
 *   - `notFound()` on an unknown city slug, which answers 200 with the
 *     not-found body instead of a 404. A soft 404, which this codebase has
 *     deliberately removed everywhere else. It is tolerable HERE and only
 *     here, because a status code is a message to a crawler and no crawler is
 *     admitted: this host serves `Disallow: /` and every page on it is
 *     noindex. The reader still sees the right page. If that robots rule is
 *     ever relaxed, this becomes a real defect and the rewrite has to go.
 *
 * The one redirect left behind a rewrite is /lp/6/[city]'s coercion of a
 * Canadian city onto Seattle, which costs a client-side hop on a hand-built
 * mistargeted link. It still cannot render the contradiction it guards
 * against, which is what that guard is for.
 */
export function lpPrefix(host: string | null | undefined): string {
  return isLandingHost(host) ? "" : "/lp";
}

/**
 * City-first landing routes, which do not fit the `<variant>[/<city>]` shape.
 *
 * Hand-kept, and it has to be: `/lp/seattle/1` is a folder pair rather than a
 * number, so no pattern distinguishes it from an ordinary two-segment app path
 * like `/plans/checkout`. A variant of this shape that ships without a row
 * here answers 404 on the landing host, which is the same failure the link
 * builder's VARIANTS list already warns about in the other direction.
 */
const CITY_FIRST_LANDINGS = new Set(["/seattle/1"]);

/** `/7`: the doorway an ad link points at, carrying `?city=`. */
const VARIANT_DOORWAY = /^\/([0-9]{1,2})$/;

/**
 * The variant number if this path is a doorway, otherwise null.
 *
 * Middleware answers the doorway on this host instead of letting the page do
 * it, so it needs the variant out of the path. See the comment at the call
 * site for why that is a correctness fix and not a shortcut.
 */
export function landingDoorwayVariant(pathname: string): string | null {
  return VARIANT_DOORWAY.exec(pathname)?.[1] ?? null;
}

/** `/7/seattle-wa`: the cached city page a doorway redirects to. */
const VARIANT_CITY = /^\/[0-9]{1,2}\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Does this path name a landing page, in the short form the landing host
 * serves?
 *
 * Deliberately an allow list rather than "prefix everything with /lp and see
 * what sticks". A blanket prefix would send `/plans/checkout` to
 * `/lp/plans/checkout` and answer a 404 to somebody halfway through buying.
 */
export function isLandingPath(pathname: string): boolean {
  return (
    VARIANT_DOORWAY.test(pathname) ||
    VARIANT_CITY.test(pathname) ||
    CITY_FIRST_LANDINGS.has(pathname)
  );
}
