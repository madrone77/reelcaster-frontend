import { NextRequest, NextResponse } from "next/server";
import { fetchHierarchyLight } from "@/lib/bluecaster";
import { readEdgeGeoPoint } from "@/lib/edge-geo";
import { coveredCityPoints, nearestCityTo } from "@/lib/nearby-spots";
import { resolveLpCard } from "@/app/lp/_shared/lp-spot";
import {
  heroCardFromLp,
  NOT_LOCATED,
  type HeroCardPayload,
} from "@/lib/hero-card";

/**
 * GET /api/hero-card
 *
 * The homepage hero's score card, resolved for the caller's city: the nearest
 * covered city to their IP, and that city's representative spot with today's
 * real score, curve, window and catch count on it.
 *
 * WHY THIS IS A ROUTE AND NOT A SERVER RENDER
 *
 * The homepage is statically rendered with `revalidate = 3600`, and it has to
 * stay that way. Personalizing the document would mean a crawler indexing
 * whichever city its data centre happens to sit near, and the homepage is the
 * site's strongest ranking surface. So the static HTML keeps the hardcoded
 * Constance Bank demo — identical for every visitor and every crawler — and
 * this fills in after hydration or not at all. The same argument, and the same
 * shape, as /api/nearby-spots.
 *
 * A crawler asking for THIS gets `located: false`, because data-centre IPs
 * carry no geo headers.
 *
 * NO NEW BACKEND SURFACE. Everything here is a read the app already makes and
 * the Data Cache already holds: the hierarchy behind /explore's location tree,
 * and the two calls `resolveLpCard` folds for the /lp landing pages. A
 * homepage visit usually costs zero upstream round trips, and the hero can
 * never disagree with the map about a score.
 */

/** Node, not edge, for the reasons spelled out in /api/nearby-spots. */
export const dynamic = "force-dynamic";

/**
 * `private` because the body depends on the caller's IP: a shared cache would
 * hand one city's card to the next visitor from somewhere else. 15 minutes is
 * well inside the hour the scoring cron works on, and a not-located answer
 * holds for an hour since a missing header is a property of the connection
 * rather than of the data.
 */
function json(payload: HeroCardPayload, maxAge: number) {
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
    // thing to the caller: there is no card here worth swapping in.
    if (!near) return json(NOT_LOCATED, 3600);

    const card = await resolveLpCard(near.city.slug);
    // A covered city whose spots are all unscored today would swap a live-
    // looking demo for a card reading zero. Leaving the demo in place is the
    // better of the two.
    if (!card || card.score <= 0) return json(NOT_LOCATED, 900);

    return json({ located: true, card: heroCardFromLp(card) }, 900);
  } catch {
    // The hero keeps its demo card on a false, so a failure here costs the
    // visitor a personalization and never an error.
    return json(NOT_LOCATED, 60);
  }
}
