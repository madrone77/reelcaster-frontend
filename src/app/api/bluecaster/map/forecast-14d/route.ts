import { NextRequest, NextResponse } from "next/server";
import { fetchMapForecast14d } from "@/lib/bluecaster";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/map/forecast-14d.
 * Keeps BLUECASTER_API_KEY server-side; the explore shell's viewport
 * forecast strip calls this with the current map bbox.
 */
export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get("bbox");
  if (!bbox) {
    return NextResponse.json({ error: "bbox required" }, { status: 400 });
  }
  const data = await fetchMapForecast14d(bbox);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=120" },
  });
}
