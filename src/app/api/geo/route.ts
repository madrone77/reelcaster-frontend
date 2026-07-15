import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geo
 *
 * IP-based location approximation from Vercel's request geo headers —
 * the middle rung of the catch wizard's no-GPS fallback chain (EXIF →
 * browser geolocation → THIS → last-viewed city → default). Free on
 * Vercel; on localhost the headers are absent and lat/lng come back null,
 * so the caller falls through to the next rung.
 */
export async function GET(request: NextRequest) {
  const lat = parseFloat(request.headers.get("x-vercel-ip-latitude") ?? "");
  const lng = parseFloat(request.headers.get("x-vercel-ip-longitude") ?? "");
  const city = request.headers.get("x-vercel-ip-city");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { lat: null, lng: null, city: null, source: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { lat, lng, city: city ? decodeURIComponent(city) : null, source: "ip" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
