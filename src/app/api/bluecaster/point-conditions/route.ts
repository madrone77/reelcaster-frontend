import { NextRequest, NextResponse } from "next/server";
import { fetchPointConditions } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/point-conditions?lat=<n>&lng=<n>
 *
 * Same-origin proxy to BlueCaster's `/api/map/point-conditions`. Surfaces the
 * extended now-conditions the spot-page payload omits (barometric pressure +
 * 3h trend, minutes-to-slack, moon) for the spot-detail RIGHT NOW tiles.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng query parameters are required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchPointConditions(lat, lng);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=120" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
