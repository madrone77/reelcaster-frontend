import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/bluecaster/currents/point?lat=&lng=&from=&to=&step_min=
 *
 * Same-origin proxy to BlueCaster's `/api/v1/currents/point` — the predicted
 * tidal-current time series at a location for any date. Feeds the spot page's
 * CURRENT chart row and RIGHT NOW tile with real water movement (the same
 * constituent fields the scoring path reads), replacing the tide-derived
 * pseudo-current. Cacheable: predictions are deterministic per (point, range).
 */
export async function GET(req: NextRequest) {
  const base = process.env.BLUECASTER_API_URL;
  if (!base) return new NextResponse("BLUECASTER_API_URL not set", { status: 500 });

  const src = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  for (const k of ["lat", "lng", "from", "to", "step_min"]) {
    const v = src.get(k);
    if (v) qs.set(k, v);
  }

  const apiKey = process.env.BLUECASTER_API_KEY;
  try {
    const r = await fetch(`${base}/api/v1/currents/point?${qs.toString()}`, {
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
      cache: "no-store",
    });
    if (!r.ok) return new NextResponse("upstream error", { status: r.status === 404 ? 404 : 502 });
    const body = await r.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
}
