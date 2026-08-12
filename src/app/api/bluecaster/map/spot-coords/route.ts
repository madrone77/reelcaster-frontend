import { NextRequest, NextResponse } from "next/server";
import { fetchSpotCoords } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/map/spot-coords?slugs=a,b,c
 *
 * Same-origin proxy → BlueCaster `GET /api/v1/map/spot-coords`. Keeps
 * BLUECASTER_API_KEY server-side.
 *
 * This is the dashboard's first-paint read: the saved-spot map knows its
 * favourites by slug from localStorage immediately, and needs only their
 * coordinates to draw. It used to wait on the bulk `map/spots` payload — every
 * published spot with a 24-hour score strip each — for the four numbers it
 * actually needed.
 *
 * No identity, no per-viewer content, so it stays cacheable: the slug list in
 * the URL is the whole cache key.
 */
export const dynamic = "force-dynamic";

/** Matches the upstream cap; more than this is a caller bug, not a big set. */
const MAX_SLUGS = 100;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SLUGS);

  if (slugs.length === 0) {
    return NextResponse.json({ spots: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const spots = await fetchSpotCoords(slugs);
  if (!spots) {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  return NextResponse.json(
    { spots },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } },
  );
}
