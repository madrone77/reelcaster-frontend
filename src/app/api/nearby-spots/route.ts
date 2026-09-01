import { NextRequest, NextResponse } from "next/server";
import { fetchHierarchy, fetchHierarchyLight, fetchMapSpots } from "@/lib/bluecaster";
import { readEdgeGeoPoint } from "@/lib/edge-geo";
import {
  coveredCityPoints,
  nearestCityTo,
  rankNearbySpots,
  NOT_LOCATED,
  type NearbyPayload,
} from "@/lib/nearby-spots";
import { spotPathIndex } from "@/app/fishing/lib/fishing-data";

/**
 * GET /api/nearby-spots
 *
 * Feeds the homepage's "near you" section: the nearest covered city to the
 * caller's IP, plus that city's best-scoring spots today.
 *
 * The homepage itself stays static and identical for everyone — this is the
 * only personalized byte on it, fetched after hydration. A crawler asking for
 * the page gets HTML with no city in it; a crawler asking for THIS gets
 * `located: false`, because data-centre IPs carry no geo headers.
 *
 * Location comes from Vercel's edge geo headers via `readEdgeGeoPoint`, the
 * same rung `/api/geo` reads and the same reader `/api/hero-card` uses.
 * Deliberately NOT `navigator.geolocation`: no permission prompt is ever
 * raised, and the answer is a metro-area guess by design. Outside production
 * that reader also honours a `?geo_lat=&geo_lng=` override, which is how this
 * section is exercised on localhost and on previews.
 *
 * No new backend surface. Both reads are ones the app already makes and the
 * Data Cache already holds — the hierarchy for `/explore`'s location tree, and
 * `map/spots` for the map itself — so a homepage visit usually costs zero
 * upstream round trips and can never disagree with the map about a score.
 */

/**
 * Node, not edge, despite edge being the obvious home for a header read.
 *
 * Nothing in the repo runs on edge today, and the two upstream reads earn
 * their keep through the Data Cache rather than through proximity, so edge
 * would trade a proven path for latency this route does not spend. If that
 * changes, `@/lib/bluecaster` imports only types and is edge-safe as written.
 */
export const dynamic = "force-dynamic";

/**
 * `private` because the body depends on the caller's IP: a shared cache would
 * hand one city's list to the next visitor from somewhere else. 15 minutes is
 * well inside the hour the scoring cron works on, and a not-located answer
 * holds for an hour since a missing header is a property of the connection
 * rather than of the data.
 */
function json(payload: NearbyPayload, maxAge: number) {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": `private, max-age=${maxAge}` },
  });
}

export async function GET(request: NextRequest) {
  const geo = readEdgeGeoPoint(request.headers, request.nextUrl.searchParams);
  if (!geo) return json(NOT_LOCATED, 3600);

  try {
    const hierarchy = await fetchHierarchyLight();
    const near = nearestCityTo(geo.lat, geo.lng, coveredCityPoints(hierarchy));
    // Too far, or we could not read the city list at all. Both mean the same
    // thing to the caller: there is nothing near you worth a section.
    if (!near) return json(NOT_LOCATED, 3600);

    const payload = await fetchMapSpots({ city: near.city.slug });
    // The homepage is indexable, so these links are part of the crawl graph
    // and have to be the spots' own URLs. rankNearbySpots gets no place tree,
    // so the paths are joined on here.
    const paths = spotPathIndex(await fetchHierarchy().catch(() => null));
    const spots = rankNearbySpots(payload).map((s) => ({
      ...s,
      path: paths.get(s.slug) ?? null,
    }));
    // A covered city whose spots are all unscored today has nothing to rank.
    if (spots.length === 0) return json(NOT_LOCATED, 900);

    return json(
      {
        located: true,
        city: { slug: near.city.slug, name: near.city.name },
        spots,
      },
      900,
    );
  } catch {
    // The homepage renders nothing on a false, so a failure here costs the
    // visitor a section and never an error.
    return json(NOT_LOCATED, 60);
  }
}
