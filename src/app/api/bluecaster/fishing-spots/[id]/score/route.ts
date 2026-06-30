import { NextRequest, NextResponse } from "next/server";
import { fetchSpotScore } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/fishing-spots/[id]/score?species=<id>&days=<N>
 *
 * Same-origin proxy to BlueCaster's `/api/v1/fishing-spots/[id]/score` (multi-day
 * mode). Returns per-hour factor_contributions for a spot×species — powers the
 * spot-detail "Score explained" charts. Keeps the BlueCaster API key server-only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const species = sp.get("species");
  if (!species) {
    return NextResponse.json(
      { error: "species query parameter is required" },
      { status: 400 },
    );
  }
  const days = Math.max(1, Math.min(14, Number(sp.get("days")) || 1));
  try {
    const data = await fetchSpotScore(id, species, days);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
