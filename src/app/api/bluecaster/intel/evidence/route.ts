import { NextRequest, NextResponse } from "next/server";
import { fetchIntelEvidence } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/intel/evidence?fishing_spot_id=<uuid>&species_id=<uuid>
 *
 * Same-origin proxy to BlueCaster's `/api/v1/intel/evidence` — the data
 * sources + algo-variable confidence behind a spot×species score ("why this
 * score"). Keeps the API key server-only. (`spot_id` accepted as an alias.)
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const spotId = sp.get("fishing_spot_id") ?? sp.get("spot_id");
  const speciesId = sp.get("species_id");
  if (!spotId || !speciesId) {
    return NextResponse.json(
      { error: "fishing_spot_id and species_id required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchIntelEvidence(spotId, speciesId);
    if (!data) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
