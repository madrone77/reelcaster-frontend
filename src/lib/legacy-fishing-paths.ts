/**
 * The retired /fishing/<province>/... shape, translated to the new
 * /fishing/<country>/<state>/... one.
 *
 * This runs in middleware, so it cannot read the hierarchy: an edge function
 * gets no cheap way to resolve a city per request. It does not need to. The
 * old shape encoded everything the new one needs except the country, and the
 * country is a two-entry lookup:
 *
 *   /fishing/bc                            -> /fishing/ca/bc
 *   /fishing/bc/victoria-bc                -> /fishing/ca/bc/victoria
 *   /fishing/bc/vancouver-bc/chinook-salmon
 *                        -> /fishing/ca/bc/vancouver/species/chinook-salmon
 *
 * The city segment loses the province suffix because the state is now its own
 * segment, which is the same rule migration 169 used to fill cities.url_slug.
 *
 * ⚠️ That makes this a DERIVATION, not a lookup, so it agrees with url_slug
 * only for as long as url_slug stays derived. The column is hand-editable on
 * purpose. If a city is ever given a url_slug that is not "slug minus the
 * suffix", its old URL will redirect to a path that 404s, and the fix is to
 * add that city here as an explicit override rather than to guess.
 *
 * The spot page is deliberately NOT handled here: /explore/spot/<slug> carries
 * no city at all, so resolving it needs the hierarchy. That one is a route.
 */

/**
 * The old first segment was a province code doing duty as the whole place.
 * Anything not in here is already a country code, i.e. a new-shape URL.
 */
const COUNTRY_BY_LEGACY_PROVINCE: Record<string, string> = {
  bc: "ca",
  wa: "us",
};

/**
 * Segments that are countries in the new shape. Kept explicit so a new-shape
 * URL is never mistaken for a legacy one: `ca` is Canada here and California
 * one segment along, and only position tells them apart.
 */
const COUNTRY_SEGMENTS = new Set(Object.values(COUNTRY_BY_LEGACY_PROVINCE));

/**
 * Cities that were published under the old URLs and are not any more, keyed by
 * their legacy `<province>/<citySlug>` path.
 *
 * Everything else in this file is a derivation, which is what lets it run at
 * the edge with no data. Whether a city is still published is the one fact a
 * derivation cannot recover: middleware has no cheap way to read the hierarchy
 * per request, so a retirement has to be written down.
 *
 * Without an entry, an unpublished city's old URL redirects to its new path and
 * lands on a 404. That is honest but unhelpful: the reader wanted somewhere to
 * fish near there, and the state page is the nearest true answer.
 *
 * ⚠️ **Add a city here whenever you set its lifecycle back to `building`**, and
 * remove it if the city publishes again. Nothing enforces that, because nothing
 * at the edge can.
 *
 * The redirect covers everything BELOW the city too: its species guides were
 * live URLs and they are gone with it.
 */
const RETIRED_LEGACY_CITIES: Record<string, string> = {
  // Unpublished 2026-09-01. One home spot (Alden Bank) after Point Lawrence
  // was corrected to Friday Harbor, which is fewer than a city page should
  // carry. Took 4 species guides with it. See bluecaster migration 170.
  "wa/bellingham-wa": "/fishing/us/wa",
};

function stripProvinceSuffix(citySlug: string, province: string): string {
  const suffix = `-${province}`;
  return citySlug.endsWith(suffix)
    ? citySlug.slice(0, -suffix.length)
    : citySlug;
}

/**
 * The new path for a legacy /fishing URL, or null if `pathname` is not one.
 *
 * Null covers both "already new shape" and "not ours", so the caller can treat
 * a null as "carry on" without a second test.
 */
export function newFishingPath(pathname: string): string | null {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "fishing") return null;

  const first = parts[1];
  if (!first) return null;

  // Already new shape. Bail before the province lookup so a country code can
  // never be read as a province.
  if (COUNTRY_SEGMENTS.has(first)) return null;

  const country = COUNTRY_BY_LEGACY_PROVINCE[first];
  if (!country) return null;

  const province = first;
  const [, , citySlug, speciesSlug, ...rest] = parts;

  // /fishing/bc
  if (!citySlug) return `/fishing/${country}/${province}`;

  // A city that is no longer published has no page to point at, and neither do
  // its guides, so the whole subtree goes to the state index.
  const retired = RETIRED_LEGACY_CITIES[`${province}/${citySlug}`];
  if (retired) return retired;

  const city = stripProvinceSuffix(citySlug, province);

  // /fishing/bc/victoria-bc
  if (!speciesSlug) return `/fishing/${country}/${province}/${city}`;

  // Anything deeper than the guide never existed, so there is nothing to
  // translate and a guess would invent a URL.
  if (rest.length > 0) return null;

  // /fishing/bc/vancouver-bc/chinook-salmon
  return `/fishing/${country}/${province}/${city}/species/${speciesSlug}`;
}
