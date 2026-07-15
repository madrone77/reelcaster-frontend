import { NextRequest, NextResponse } from "next/server";
import { fetchNearestSpots } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/spots/by-coordinates?lat=&lng=&radius_m=&limit=
 *
 * Same-origin proxy to BlueCaster's nearest-spot lookup — powers the catch
 * wizard's map picker (400 m spot matching on every pin move). Keeps the
 * BlueCaster API key server-only.
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
  const radiusM = Number(sp.get("radius_m")) || 400;
  const limit = Number(sp.get("limit")) || 5;
  try {
    const data = await fetchNearestSpots(lat, lng, radiusM, limit);
    if (!data) return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
