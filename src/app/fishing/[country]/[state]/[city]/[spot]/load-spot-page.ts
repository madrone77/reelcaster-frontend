import { notFound } from "next/navigation";
import { fetchHierarchy, fetchSpotLivePage } from "@/lib/bluecaster";
import { findCityForSpot } from "@/app/fishing/lib/fishing-data";
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

export async function loadSpotPage(slug: string): Promise<LoadedSpotPage> {
  const page = await fetchSpotLivePage(slug);

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
  const place = findCityForSpot(await fetchHierarchy().catch(() => null), slug);

  return {
    page: stripPaidIntel(page),
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
