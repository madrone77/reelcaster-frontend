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
  // Id scope, forwarded verbatim. Upstream validates the ids, caps the list at
  // 120, and applies the published filter, so there is nothing to guard here —
  // an id a caller is not entitled to simply does not come back.
  const spotIds = (sp.get("spots") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const viewerId = await getUserIdFromRequest(request);

  try {
    const data = await fetchMapSpots({
      spotIds: spotIds.length ? spotIds : undefined,
      bbox,
      city,
      date,
      viewerId: viewerId ?? undefined,
    });
    if (!data) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    return NextResponse.json(data, {
      headers: {
        // Mirrors what BlueCaster sets on the same body. This proxy used to
        // answer with a bare `public, max-age=300`, which threw away the
        // upstream `s-maxage=600`: the shared edge cache fell back to the
        // browser TTL, so it re-fetched twice as often, and with no
        // `stale-while-revalidate` the angler who arrived on an expired entry
        // waited out a full cold origin read instead of being served the
        // slightly stale copy while the edge refreshed behind them.
        //
        // The viewer body carries that angler's own private spots and stays
        // out of any shared cache.
        "Cache-Control": viewerId
          ? "private, no-store"
          : "public, max-age=300, s-maxage=600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
