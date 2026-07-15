import { NextResponse } from "next/server";
import { fetchBlueCasterSpecies } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/species
 *
 * Same-origin proxy to BlueCaster's species list — the species-picker's
 * fallback options when no spot is matched. Cacheable: the list changes
 * rarely.
 */
export async function GET() {
  try {
    const species = await fetchBlueCasterSpecies();
    if (!species) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    return NextResponse.json(
      { species },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
