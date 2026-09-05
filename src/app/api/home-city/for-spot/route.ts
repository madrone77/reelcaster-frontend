/**
 * GET /api/home-city/for-spot?spot=<slug>
 *
 * The city a spot lives under. One question, asked at one moment: when an
 * angler pins a home spot, the pin writes their home city through to match it,
 * and the client has no way to work out which city that is.
 *
 * Server-side because the answer needs the full place hierarchy, which is
 * already in this server's Data Cache. Public because it is: the hierarchy is
 * a published sitemap, and this returns one row of it. No identity is read and
 * nothing is written.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveHomeCity } from "@/lib/bluecaster";

export const runtime = "nodejs";

/** Slugs only. The value is interpolated into an upstream lookup. */
const SLUG = /^[a-z0-9-]{1,120}$/;

export async function GET(request: NextRequest) {
  const spot = request.nextUrl.searchParams.get("spot");
  const city = spot && SLUG.test(spot) ? await resolveHomeCity(spot) : null;

  return NextResponse.json(
    { city },
    {
      // Same answer for everybody who asks about this spot, and it changes
      // only when a spot is re-homed. Cheap to hold, but short: a spot that
      // moves city should not stay wrong for an hour.
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300" },
    },
  );
}
