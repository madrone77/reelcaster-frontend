import { NextRequest, NextResponse } from "next/server";
import { fetchSpotLivePage } from "@/lib/bluecaster";

/**
 * GET /api/bluecaster/spots/[slug]/spot-page
 *
 * Same-origin proxy to BlueCaster's `/api/v1/spots/[slug]/spot-page` (the
 * today-only live payload). Lets the Explore spot drawer lazy-fetch the rich
 * intel (catch signals, score drivers, regulations, season, water temp)
 * client-side without exposing the BlueCaster API key.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const data = await fetchSpotLivePage(slug);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
