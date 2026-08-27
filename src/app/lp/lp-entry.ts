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

import {
  forwardedQuery,
  resolveLpCity,
  DEFAULT_LP_CITY,
  type LpSearchParams,
} from '@/lib/lp-routing';

// The pure half of this file now lives in src/lib/lp-routing.ts, because
// middleware answers this same doorway on the landing host and cannot import
// `next/navigation`. Re-exported so the pages that already import these names
// from here keep working, and so there is one obvious place to look.
export {
  resolveLpCity,
  DEFAULT_LP_CITY,
  DEFAULT_US_LP_CITY,
  LP_FALLBACK_CITY,
  type LpSearchParams,
} from '@/lib/lp-routing';

/**
 * Never returns: always redirects to the cached city page for this variant.
 *
 * `fallbackCity` lets a market-specific variant land somewhere sensible when
 * the link carries no city. /lp/6 passes the Seattle default; everything else
 * takes the pilot city.
 *
 * Only ever runs on www. On try.reelcaster.com middleware answers the doorway
 * before this route is reached, because a `redirect()` inside a rewritten
 * request is not sent as a 307 at all: Next serialises it into the RSC payload
 * and answers 200, so the reader would get an empty page and a client-side hop
 * on the one navigation every single ad click has to make. See
 * src/lib/landing-host.ts.
 */
export function enterLp(
  variant: string,
  searchParams: LpSearchParams,
  fallbackCity: string = DEFAULT_LP_CITY,
): never {
  const city = resolveLpCity(searchParams.city, fallbackCity);
  redirect(`/lp/${variant}/${city}${forwardedQuery(searchParams)}`);
}
