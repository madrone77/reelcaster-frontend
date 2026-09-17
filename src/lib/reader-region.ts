/**
 * Which market's customer quote a reader should see.
 *
 * Written by middleware, read by `<Testimonial>` in the paywall modals. The
 * modals are client-opened and know nothing about where the reader came from,
 * so the edge answers once and leaves the answer here.
 *
 * A reader is Washington if the edge places them in WA, or if they have
 * landed on a Washington page (a Seattle or Tacoma landing page, or anything
 * under /fishing/us/wa). The page counts because a WA ad or search result is
 * the stronger signal: somebody in Portland reading about Tacoma water wants
 * the Tacoma angler. The value sticks across later pages, so a reader who
 * arrived on a Seattle page and moved to Explore still gets it.
 *
 * Holds a state code and nothing else. No IP, no city.
 */

/** Read by `useReaderRegion`. Not httpOnly: the client is what reads it. */
export const READER_REGION_COOKIE = 'rc_mkt'

export const READER_REGION_MAX_AGE = 60 * 60 * 24 * 30

const WA_PATH = /^\/(?:fishing\/us\/wa|lp\/(?:seattle|tacoma))(?:\/|$)/

/**
 * The value to write, or null to leave the cookie as it is.
 *
 * Only ever writes WA. Anyone else is left alone rather than cleared, so a WA
 * page visit is not undone by the edge placing the same phone in BC a page
 * later.
 */
export function readerRegionFor(
  pathname: string,
  geo: { country: string | null; region: string | null },
): 'WA' | null {
  if (WA_PATH.test(pathname.toLowerCase())) return 'WA'
  if (geo.country?.toUpperCase() === 'US' && geo.region?.toUpperCase() === 'WA') return 'WA'
  return null
}

/** The stored region, or null. Safe where storage access throws. */
export function readReaderRegion(): string | null {
  if (typeof document === 'undefined') return null
  try {
    const hit = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${READER_REGION_COOKIE}=`))
    return hit ? decodeURIComponent(hit.slice(READER_REGION_COOKIE.length + 1)) : null
  } catch {
    // Safari with cookies blocked throws here. Bob's quote is a fine answer.
    return null
  }
}
