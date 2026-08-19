/**
 * Shared entry logic for /lp/<variant>?city=...
 *
 * Ad links are generated as `/lp/1?city=victoria-bc&utm_source=...`, with the
 * variant in the path and everything else in the query, because that is the
 * shape the ad platforms' macro substitution produces most reliably: one
 * template per variant, every other value filled in by the network.
 *
 * The page itself lives at `/lp/<variant>/[city]`, so this redirects rather
 * than rendering. That looks like a wasted hop and is not: the city page is
 * ISR-cached (revalidate 900) and reading `city` from searchParams would opt
 * the whole route out of that cache, putting four upstream fetches on the
 * critical path of every single ad click. One redirect against four uncached
 * round trips is not a close call, and cold paid traffic is exactly the
 * audience least willing to wait.
 *
 * The full query string rides along, because the attribution parameters are
 * read client-side after the redirect lands. Dropping them here would make
 * every ad click look like direct traffic.
 */

import { redirect } from 'next/navigation';

/**
 * Where an untagged or unroutable link goes. Victoria is the pilot city and
 * the one guaranteed to have scored spots to show.
 */
export const DEFAULT_LP_CITY = 'victoria-bc';

/**
 * Fallback for the US-market variant. A Seattle page must not answer an
 * untagged link with a Canadian city: the whole variant is built around
 * American water, down to the flag in the header.
 */
export const DEFAULT_US_LP_CITY = 'seattle-wa';

/** City slugs are lowercase kebab, e.g. "victoria-bc", "friday-harbor-wa". */
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type LpSearchParams = Record<string, string | string[] | undefined>;

/**
 * Reduce `?city=` to a routable slug.
 *
 * Lower-cased before matching because Vercel resolves paths case-insensitively:
 * left alone, `?city=Victoria-BC` would produce a second URL for the same page
 * and split its cache entry and its analytics.
 *
 * Anything that isn't slug-shaped falls back to the default rather than
 * throwing. A malformed tag is a mistake in a link we wrote, and the cost of
 * being strict about it is a 404 served to traffic we already paid for.
 */
export function resolveLpCity(
  raw: string | string[] | undefined,
  fallback: string = DEFAULT_LP_CITY,
): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const slug = (first ?? '').trim().toLowerCase();
  return SLUG_SHAPE.test(slug) ? slug : fallback;
}

/**
 * Rebuild the query string minus `city`, which has been promoted into the path
 * and would otherwise appear twice.
 */
function forwardedQuery(searchParams: LpSearchParams): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'city' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) out.append(key, v);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Never returns: always redirects to the cached city page for this variant.
 *
 * `fallbackCity` lets a market-specific variant land somewhere sensible when
 * the link carries no city. /lp/6 passes the Seattle default; everything else
 * takes the pilot city.
 */
export function enterLp(
  variant: string,
  searchParams: LpSearchParams,
  fallbackCity: string = DEFAULT_LP_CITY,
): never {
  const city = resolveLpCity(searchParams.city, fallbackCity);
  redirect(`/lp/${variant}/${city}${forwardedQuery(searchParams)}`);
}
