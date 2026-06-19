import { NextRequest, NextResponse } from "next/server";
import { fetchPoolIntelligence } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/pool/intelligence?spot_id=<uuid>&species_id=<uuid>&time_window=
 *
 * Same-origin proxy to BlueCaster's `/api/v1/pool/intelligence` — anonymized
 * community catch-rate aggregates (by tide phase / time of day / moon / depth /
 * lure). BlueCaster suppresses n<5 buckets; the reelcaster app key reads the
 * public aggregate (no per-angler reciprocity gate). Key stays server-only.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const spotId = sp.get("spot_id");
  const speciesId = sp.get("species_id");
  if (!spotId || !speciesId) {
    return NextResponse.json(
      { error: "spot_id and species_id required" },
      { status: 400 },
    );
  }
  const w = sp.get("time_window");
  const timeWindow =
    w === "month" || w === "week" || w === "season" ? w : "season";
  try {
    const data = await fetchPoolIntelligence(spotId, speciesId, timeWindow);
    if (!data) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
