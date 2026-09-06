/**
 * Where a Meta click on a landing page goes: the city's /5 page, or the map.
 *
 * Every Meta ad still points at a /lp page, because re-pointing an ad in
 * Meta restarts its learning. The edge decides what the click actually
 * reads. From 2026-09-06 every Meta click went straight on to
 * `/explore?loc=<city>&ad=day2`: the ad-framed Explore, opened on the city
 * the landing page was about, with the two-day wall the landing pages' own
 * CTA already links to (src/app/lp/_shared/lp-via.ts builds the same href).
 * Now that is one arm of a split (src/lib/lp-splits.ts, `meta_lp5_explore`):
 * the other arm reads the city's /5 landing page, and the two are compared
 * on the same ad and the same audience. Google traffic is left alone and
 * still reads the landing page.
 *
 * WHY A REDIRECT AND NOT A REWRITE: the same reasons as src/lib/lp-splits.ts.
 * The address bar, the pixel's page view and our first-touch cookie all name
 * the page the visitor actually saw, and the request that follows the hop is
 * the one middleware counts and stamps. The query string rides along, so
 * fbclid, utm_* and `?a=` survive.
 *
 * Pure and edge-safe: no imports, no environment. Decided from the request
 * alone, so nothing here needs a database round trip.
 */

/**
 * `utm_source` values that mean Meta. Compared lower-cased. The link builder
 * writes `meta`; the rest cover hand-typed links.
 */
const META_SOURCES = new Set(['meta', 'facebook', 'instagram', 'fb', 'ig']);

/** Referrer hosts owned by Meta. Matched on the host or any subdomain of it. */
const META_REFERRER_HOSTS = ['facebook.com', 'instagram.com', 'fb.com'];

/** Where each city-first landing page family opens the map. */
const CITY_FIRST_LANDINGS: Record<string, string> = {
  seattle: 'seattle-wa',
  vancouver: 'vancouver-bc',
  tacoma: 'tacoma-wa',
};

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const META_HOP_WALL = 'day2';

function referrerHost(referrer: string): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Did Meta send this visit?
 *
 * Three signals, any one of which is enough: the click id Meta appends to
 * every ad click, the `utm_source` the link builder puts on every Meta link,
 * and the referrer for a click that lost its query string somewhere in an
 * in-app browser. Google's own markers are never consulted, so a link that
 * carries both is read as Meta only when a Meta signal is actually present.
 */
export function isMetaTraffic(input: { search: string; referrer: string }): boolean {
  const params = new URLSearchParams(input.search);
  if (params.get('fbclid')) return true;
  const source = (params.get('utm_source') ?? '').trim().toLowerCase();
  if (META_SOURCES.has(source)) return true;
  const host = referrerHost(input.referrer);
  if (!host) return false;
  return META_REFERRER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * The city a landing-page URL is about, or null when the URL names none.
 *
 *   /lp/seattle/5            → seattle-wa   (city-first family)
 *   /lp/5/seattle-wa         → seattle-wa   (variant-first, city in the path)
 *   /lp/5?city=seattle-wa    → seattle-wa   (the doorway, city in the query)
 *   /lp/5                    → null         (the doorway would pick a default)
 */
export function lpCityFor(pathname: string, search: string): string | null {
  const path = pathname.replace(/\/+$/, '');
  const m = path.match(/^\/lp\/([^/]+)(?:\/([^/]+))?$/);
  if (!m) return null;
  const [, first, second] = m;

  const pinned = CITY_FIRST_LANDINGS[first];
  if (pinned) return pinned;

  if (!/^[0-9]{1,2}$/.test(first)) return null;
  if (second) return SLUG_SHAPE.test(second) ? second : null;

  const city = (new URLSearchParams(search).get('city') ?? '').trim().toLowerCase();
  return SLUG_SHAPE.test(city) ? city : null;
}

/** Is this a landing-page URL at all? Only /lp pages are ever hopped. */
export function isLpPath(pathname: string): boolean {
  return /^\/lp(\/|$)/.test(pathname);
}

/**
 * The city's /5 landing page, for a Meta click that landed on a city-first
 * page at another number: `/lp/vancouver/4` → `/lp/vancouver/5`. Null when
 * the click is already on a /5 page, or on a page with no city-first family
 * (the doorway and the variant-first pages read as they are: they have no
 * "/5 for this city" the ad could have pointed at). The query rides along.
 */
export function lpFiveHop(pathname: string, search: string): string | null {
  const path = pathname.replace(/\/+$/, '');
  const m = path.match(/^\/lp\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  const [, city, variant] = m;
  if (!CITY_FIRST_LANDINGS[city]) return null;
  if (variant === '5') return null;
  return `/lp/${city}/5${search}`;
}

/** Is this a request the Meta split decides at all: a Meta click on a landing page? */
export function isMetaLpArrival(input: {
  pathname: string;
  search: string;
  referrer: string;
}): boolean {
  return isLpPath(input.pathname) && isMetaTraffic(input);
}

/**
 * Where a Meta click on a landing page goes, given its arm, as a path plus
 * query, or null when this request should read the page it asked for.
 *
 * Arm `b` is the map (metaExploreHop below). Arm `a` is the city's /5
 * landing page, which is a hop only when the ad pointed at another number.
 */
export function metaLpDestination(input: {
  pathname: string;
  search: string;
  referrer: string;
  arm: 'a' | 'b';
}): string | null {
  if (!isMetaLpArrival(input)) return null;
  if (input.arm === 'b') return metaExploreHop(input);
  return lpFiveHop(input.pathname, input.search);
}

/**
 * Where a Meta click on a landing page goes instead, as a path plus query, or
 * null when this request should read the landing page.
 *
 * The landing page's own query is carried whole (click id, utm_*, `?a=`) and
 * `city` is dropped, because it has become `loc`. A landing page with no city
 * still hops: Explore opens on the visitor's own geo in that case, which is
 * the city the doorway would have guessed at anyway.
 */
export function metaExploreHop(input: {
  pathname: string;
  search: string;
  referrer: string;
}): string | null {
  if (!isLpPath(input.pathname)) return null;
  if (!isMetaTraffic(input)) return null;

  const params = new URLSearchParams(input.search);
  const city = lpCityFor(input.pathname, input.search);
  params.delete('city');
  params.delete('loc');
  params.delete('ad');
  if (city) params.set('loc', city);
  params.set('ad', META_HOP_WALL);
  return `/explore?${params.toString()}`;
}
