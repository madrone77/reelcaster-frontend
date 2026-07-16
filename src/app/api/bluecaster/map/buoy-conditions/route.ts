import { NextRequest, NextResponse } from "next/server";
import { fetchBuoyConditions } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/map/buoy-conditions
 *
 * Same-origin proxy to BlueCaster's `/api/v1/map/buoy-conditions`.
 * Serves the live-observations panel that opens when a weather-buoy
 * marker is clicked on the Explore map.
 *
 * Query params (passed through): sid=<NDBC station id> (e.g. 46088, SISW1)
 */
export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get("sid") ?? "";
  if (!/^[A-Za-z0-9]{4,6}$/.test(sid)) {
    return NextResponse.json({ error: "sid required" }, { status: 400 });
  }

  try {
    const data = await fetchBuoyConditions(sid);
    if (!data) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
