import { NextRequest, NextResponse } from "next/server";
import { fetchSpotsByCoordinates } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/spots/by-coordinates?lat=&lng=&radius_km=
 *
 * Same-origin proxy to BlueCaster's `/api/v1/spots/by-coordinates` — nearest
 * city + nearby spots + tide station for a GPS point. Powers Explore's
 * "Near me" geolocation jump without exposing the API key.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radiusKm = sp.get("radius_km") ? Number(sp.get("radius_km")) : 50;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchSpotsByCoordinates(lat, lng, radiusKm);
    if (!data) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
