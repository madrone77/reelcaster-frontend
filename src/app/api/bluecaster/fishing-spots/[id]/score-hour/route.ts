import { NextRequest, NextResponse } from "next/server";
import { fetchSpotScoreHour } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/fishing-spots/[id]/score-hour?species=<uuid>&datetime=<utc-iso>
 *
 * Same-origin proxy to BlueCaster's score endpoint in SINGLE-HOUR mode —
 * "the spot's score for this species at the catch hour". Empty `stocks`
 * means the hour is outside the current forecast window (UI renders "—").
 * Kept separate from the existing /score proxy (multi-day mode) so the
 * spot-detail factor charts are untouched.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const species = sp.get("species");
  const datetime = sp.get("datetime");
  if (!species || !datetime || isNaN(Date.parse(datetime))) {
    return NextResponse.json(
      { error: "species and a valid datetime are required" },
      { status: 400 },
    );
  }
  try {
    const data = await fetchSpotScoreHour(id, species, datetime);
    if (!data) return NextResponse.json({ error: "score_failed" }, { status: 502 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
