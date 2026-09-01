/**
 * GET /api/home-city/suggest?from=<arrival url>
 *
 * What to put in front of somebody when we ask "Fishing in Seattle?".
 *
 * Two signals, best first:
 *
 *   1. **The arrival URL.** An ad click lands on /lp/1/victoria-bc, organic
 *      search lands on /fishing/ca/bc/victoria or a spot beneath it, a shared
 *      link names a city in ?loc. Someone who arrived on a city page was
 *      almost certainly looking for that city.
 *   2. **The IP fix**, from the same Vercel edge headers the Explore opening
 *      frame reads. Weaker: it reports the exit of whatever network they are
 *      on, which for a phone on cell data can be a long way off.
 *
 * The alternates exist because the guess will sometimes be wrong and a wrong
 * guess with no visible way out is worse than no guess. They are the nearest
 * other covered cities to whatever position we have, or the biggest ones when
 * we have no position at all, and the modal puts a typeahead behind them for
 * anyone none of it fits.
 *
 * Resolution lives here rather than in the client because matching a URL to a
 * city needs the full place hierarchy, which is already in this server's Data
 * Cache and is 58 KB nobody should ship to a phone to answer one question. It
 * also means a new URL shape that names a city starts working without a client
 * release.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchHierarchyLight } from "@/lib/bluecaster";
import { coveredCityPoints, haversineKm } from "@/lib/nearby-spots";
import {
  asSuggestion,
  cityFromArrival,
  type HomeCitySuggestResponse,
} from "./suggestion";
import { nearestOpeningCity } from "@/app/explore/lib/opening-city";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many alternates to offer under the suggestion. */
const ALTERNATE_COUNT = 3;

function readPoint(request: NextRequest): { lat: number; lng: number } | null {
  const lat = parseFloat(request.headers.get("x-vercel-ip-latitude") ?? "");
  const lng = parseFloat(request.headers.get("x-vercel-ip-longitude") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function GET(request: NextRequest) {
  const arrival = request.nextUrl.searchParams.get("from");
  const hierarchy = await fetchHierarchyLight();
  const cities = coveredCityPoints(hierarchy);

  const empty: HomeCitySuggestResponse = {
    suggested: null,
    source: null,
    alternates: [],
    all: [],
  };
  if (!cities.length) {
    return NextResponse.json(empty, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const point = readPoint(request);
  const fromArrival = cityFromArrival(arrival, cities);

  // When we have no city from the URL, snap the IP fix to the nearest city we
  // actually cover. There is no distance cap: somebody in Nanaimo or Calgary
  // still gets an answer, because the alternative is a blank question.
  //
  // Deliberately `nearestOpeningCity` rather than a plain sort by distance.
  // That helper carries a second tier for far arrivals which this needs for
  // exactly the same reason Explore's opening frame does: at continental range
  // the covered cities are one destination and the gaps between them are noise.
  // From New York, Bellingham measures 3,863 km and Seattle 3,866 km, so plain
  // nearest would ask a visitor from the eastern seaboard "Fishing in
  // Bellingham?" on a 3 km margin inside the error of the fix itself.
  const ipSlug = nearestOpeningCity(hierarchy, point);
  const fromIp = ipSlug ? (cities.find((c) => c.slug === ipSlug) ?? null) : null;

  const suggested = fromArrival ?? fromIp ?? null;

  // Alternates are ranked around whatever position we have — the suggested
  // city's own coordinates when it came from the URL, the visitor's otherwise
  // — so the second choice is the next place along the coast rather than an
  // alphabetical accident. With no position at all, fall back to the cities
  // with the most water in them, which are the likeliest to be right.
  const anchor = suggested ?? (point ? { lat: point.lat, lng: point.lng } : null);
  const rest = cities.filter((c) => c.slug !== suggested?.slug);
  const alternates = (
    anchor
      ? [...rest].sort(
          (a, b) =>
            haversineKm(anchor.lat, anchor.lng, a.lat, a.lng) -
            haversineKm(anchor.lat, anchor.lng, b.lat, b.lng),
        )
      : [...rest].sort((a, b) => b.spotCount - a.spotCount)
  ).slice(0, ALTERNATE_COUNT);

  const body: HomeCitySuggestResponse = {
    suggested: suggested ? asSuggestion(suggested) : null,
    source: fromArrival ? "arrival" : fromIp ? "ip" : null,
    alternates: alternates.map(asSuggestion),
    // Sorted by name: this is the typeahead's corpus, read by a human.
    all: [...cities]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(asSuggestion),
  };

  return NextResponse.json(body, {
    // Keyed on an IP fix and a per-visitor arrival URL. Never shared-cached.
    headers: { "Cache-Control": "private, no-store" },
  });
}
