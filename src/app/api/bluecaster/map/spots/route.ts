import { NextRequest, NextResponse } from "next/server";
import { fetchMapSpots } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

/**
 * GET /api/bluecaster/map/spots
 *
 * Same-origin proxy to BlueCaster's `/api/v1/map/spots` bulk reader.
 * Lets the Explore canvas refetch scores for a different date (forecast
 * day taps) without exposing the BlueCaster API key to the client.
 *
 * Auth is optional. With a valid session token the payload also carries that
 * angler's OWN custom spots, so they rank in the rail with everything else.
 * That response is per-user and must not be shared: it goes out `no-store`,
 * while the anonymous one stays cacheable.
 *
 * Query params (passed through): bbox=w,s,e,n · city=<slug> · date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const bbox = sp.get("bbox") ?? undefined;
  const city = sp.get("city") ?? undefined;
  const date = sp.get("date") ?? undefined;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const viewerId = await getUserIdFromRequest(request);

  try {
    const data = await fetchMapSpots({ bbox, city, date, viewerId: viewerId ?? undefined });
    if (!data) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": viewerId ? "private, no-store" : "public, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
