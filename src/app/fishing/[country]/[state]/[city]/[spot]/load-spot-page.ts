import { notFound, permanentRedirect } from "next/navigation";
import {
  fetchHierarchy,
  fetchSpotLivePageWithCacheControl,
} from "@/lib/bluecaster";
import { findCityForSpot, spotPathIndex } from "@/app/fishing/lib/fishing-data";
import { timezoneFor } from "@/lib/regions";
import { spotHasFreshReports } from "@/app/explore/lib/fresh-catch-types";
import { stripPaidIntel } from "./strip-paid-intel";
import type { SpotCityLink, SpotPageForClient } from "./spot-detail-shell";

/**
 * Everything both spot renderers need, loaded once.
 *
 * The public page and the ad page (see ad-mode.ts) are the same page in two
 * frames, so they must not be two loaders. A gate applied in one and forgotten
 * in the other is how verbatim forum text ends up in an ad page's HTML.
 */

/** Catch-report window. Must match FRESH_DAYS in the fresh-catches route. */
export const FRESH_DAYS = 21;

export interface LoadedSpotPage {
  /** Paid intel already stripped. This is what may cross to the client. */
  page: SpotPageForClient;
  freshTracked: boolean;
  cityLink: SpotCityLink | null;
  /**
   * The spot's ONE public path, or null when it has no public home.
   *
   * Null means a private custom spot or a city that is not published yet.
   * Those keep the legacy /explore/spot/<slug> URL, which is why that route
   * still renders rather than redirecting unconditionally.
   */
  canonicalPath: string | null;
  /** The spot's IANA timezone, resolved from its region. */
  tz: string;
  /** One instant, baked into the HTML, from which every time-dependent string
   *  derives until the client mounts. See `useSpotClock`. */
  serverNowMs: number;
}

/**
 * Send a merged-away spot to the spot it became, permanently.
 *
 * Two rows for one mark means two indexed URLs splitting the same traffic, and
 * a search engine consolidates them only when the retired one REDIRECTS. A 404
 * tells it to drop the page and everything the page had earned instead — for
 * T-10, the URL that was archived was the one carrying three times the
 * impressions of the survivor, so the 404 would have thrown away most of the
 * reason for merging.
 *
 * 308 rather than 302 (permanentRedirect) because a merge is an editorial
 * decision that does not get taken back on a schedule, and only a permanent
 * redirect moves the standing across.
 *
 * Returns instead of redirecting when the survivor has no public home, since
 * there is nowhere to send anyone; the caller then 404s as it always did.
 */
async function redirectToSurvivor(mergedIntoSlug: string): Promise<void> {
  const place = findCityForSpot(
    await fetchHierarchy().catch(() => null),
    mergedIntoSlug,
  );
  if (place?.spot.path) permanentRedirect(place.spot.path);
}

export async function loadSpotPage(slug: string): Promise<LoadedSpotPage> {
  const { data: page, mergedIntoSlug } =
    await fetchSpotLivePageWithCacheControl(slug);

  // Read before the 404 below, and off the SAME response rather than a second
  // request: a merged spot is the one kind of "no page here" that has
  // somewhere to send the reader. Every route that renders a spot comes
  // through this loader, so the public page, its ad frame, the share-card page
  // and the retired /explore/spot URL all redirect from this one place.
  if (mergedIntoSlug) await redirectToSurvivor(mergedIntoSlug);

  // No server-side read doesn't mean "gone". A PRIVATE custom spot is 404 to
  // the anonymous server render even for its owner, whose session lives in the
  // browser as a Bearer token.
  //
  // Serving that case as a 200 made every unknown slug a soft 404: an
  // unpublished or deleted spot kept answering 200 forever, so Search Console
  // reported the whole route as soft-404 and stale URLs never left the index.
  // notFound() sends a real 404 and renders this segment's not-found.tsx —
  // which still hands off to OwnerSpotFallback, so an owner recovers their
  // private spot client-side. The status is honest for crawlers either way,
  // because no crawler carries the token that would turn it into a hit.
  if (!page) notFound();

  // Scraped catch reports. The raw `catchSignals` carry verbatim third-party
  // forum text and per-report detail — neither may reach the browser, and the
  // public page is prerendered, so everything below the paywall is stripped
  // here and only a boolean survives. A Pro viewer's numbers are fetched
  // client-side from the gated route; keeping the static render locked is what
  // lets that page stay prerendered for search.
  const freshTracked = spotHasFreshReports(page.catchSignals, FRESH_DAYS);

  // Where this spot sits in the public directory, so the page can link back up
  // to its city and province. Null for custom spots and unpublished cities.
  const hierarchy = await fetchHierarchy().catch(() => null);
  const place = findCityForSpot(hierarchy, slug);

  // BlueCaster builds `nearbySpots[].href` itself, and it still emits the
  // retired /explore/spot/<slug> shape. Rewriting here rather than changing the
  // payload keeps the API out of the frontend's routing: the neighbour list is
  // the spot page's main way out, and on an indexable page a whole rail of
  // links to a redirect is the crawl budget spent twice.
  //
  // A neighbour with no public home (unpublished city) keeps the retired URL,
  // which is where it actually renders.
  const spotPaths = spotPathIndex(hierarchy);
  const nearbySpots = page.nearbySpots?.map((n) => {
    const neighbourSlug = n.href?.split("/").filter(Boolean).pop();
    const canonical = neighbourSlug ? spotPaths.get(neighbourSlug) : undefined;
    return canonical ? { ...n, href: canonical } : n;
  });

  return {
    page: stripPaidIntel({ ...page, ...(nearbySpots ? { nearbySpots } : {}) }),
    freshTracked,
    // Narrowed to the five strings the breadcrumb needs — `place.city` carries
    // the city's whole spot roster, which has no business crossing the
    // server/client boundary on every spot page.
    canonicalPath: place?.spot.path ?? null,
    cityLink: place
      ? {
          cityName: place.city.name,
          cityPath: place.cityPath,
          provinceName: place.city.provinceName,
          provincePath: place.provincePath,
          countryName: place.city.countryName,
        }
      : null,
    // The spot's own clock, derived from the region the same way the regulator
    // is, and resolved here so the server and the client cannot disagree about
    // which timezone the page is talking about.
    tz: timezoneFor(place?.city.provinceName ?? page.spot.region),
    serverNowMs: Date.now(),
  };
}
