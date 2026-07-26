import { NextRequest, NextResponse } from "next/server";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";

/**
 * GET /api/bluecaster/spots/[slug]/spot-page
 *
 * Same-origin proxy to BlueCaster's `/api/v1/spots/[slug]/spot-page` (the
 * today-only live payload). Lets the Explore spot drawer lazy-fetch the rich
 * intel (catch signals, score drivers, regulations, season, water temp)
 * client-side without exposing the BlueCaster API key.
 *
 * Auth is OPTIONAL and only ever widens what you can see. Anonymous callers
 * get curated + public spots; BlueCaster 404s private custom spots to them.
 * A caller who sends a valid Supabase access token additionally gets their
 * OWN private spots — we verify the token here and vouch for that user id
 * downstream. The id is never taken from client-supplied headers, so this
 * cannot be used to read someone else's private spot.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // Optional: absent/!invalid token simply means "anonymous", not an error.
  const userId = await getUserIdFromRequest(request);
  try {
    const data = await fetchSpotLivePage(slug, userId ?? undefined);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
