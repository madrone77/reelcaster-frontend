import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/bluecaster/wind/field?bbox=w,s,e,n&cols=&rows=&time=
 *
 * Same-origin proxy to BlueCaster's animated surface-wind grid
 * (`/api/map/wind/field` — auth-free, not under /api/v1). Sibling of the
 * currents proxy next door; same payload shape and same params, so the day/hour
 * scrubber drives both overlays identically. Cached a little longer than
 * currents because wind is hourly-model data, not a continuous tidal prediction.
 */
export async function GET(req: NextRequest) {
  const base = process.env.BLUECASTER_API_URL;
  if (!base) return new NextResponse("BLUECASTER_API_URL not set", { status: 500 });

  const src = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  for (const k of ["bbox", "cols", "rows", "time"]) {
    const v = src.get(k);
    if (v) qs.set(k, v);
  }

  const apiKey = process.env.BLUECASTER_API_KEY;
  try {
    const r = await fetch(`${base}/api/map/wind/field?${qs.toString()}`, {
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
      cache: "no-store",
    });
    if (!r.ok) return new NextResponse("upstream error", { status: 502 });
    const body = await r.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
}
