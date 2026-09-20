import { NextRequest, NextResponse } from "next/server";
import { fetchStationConditions } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/map/station-conditions
 *
 * Same-origin proxy to BlueCaster's `/api/v1/map/station-conditions`.
 * Serves the tide panel that opens when a tide-station donut is clicked
 * on the Explore map, without exposing the BlueCaster API key.
 *
 * Query params (passed through): source=chs|noaa · sid=<station id> ·
 * back_hours=<0..30> (how far behind now the curve starts; the city tide
 * section asks for 30 so it covers the whole local day)
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const source = sp.get("source");
  const sid = sp.get("sid") ?? "";

  if ((source !== "chs" && source !== "noaa") || !/^[A-Za-z0-9]{1,32}$/.test(sid)) {
    return NextResponse.json(
      { error: "source (chs|noaa) and sid required" },
      { status: 400 },
    );
  }

  const backRaw = sp.get("back_hours");
  const backHours = backRaw !== null && /^[0-9]{1,2}$/.test(backRaw) ? Number(backRaw) : undefined;

  try {
    const data = await fetchStationConditions(source, sid, { backHours });
    if (!data) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
