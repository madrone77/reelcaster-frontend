import { NextRequest, NextResponse } from "next/server";
import { fetchSpotScore } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import { createClient } from "@supabase/supabase-js";
import {
  stripSpotScorePastHorizon,
  visibleForecastDays,
} from "@/lib/forecast-horizon";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * GET /api/bluecaster/fishing-spots/[id]/score?species=<id>&days=<N>
 *
 * Same-origin proxy to BlueCaster's `/api/v1/fishing-spots/[id]/score` (multi-day
 * mode). Returns per-hour factor_contributions for a spot×species — powers the
 * spot-detail "Score explained" charts. Keeps the BlueCaster API key server-only.
 *
 * Every hour carries a score, so this is gated like the strips: hours past
 * the caller's horizon (signed out today, member 7 days, Pro 14) are cut.
 * It used to hand anyone all 14 days on request.
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
  const requested = Math.max(1, Math.min(14, Number(sp.get("days")) || 1));
  try {
    // Owner of a private custom spot must be able to read their own factors;
    // BlueCaster's visibility gate 404s this otherwise.
    const viewerId = await getUserIdFromRequest(request);
    const visibleDays = visibleForecastDays(
      !!viewerId,
      viewerId ? (await resolveEntitlement(supabaseAdmin, viewerId)).isPro : false,
    );
    // Upstream days are UTC dates; one more than the horizon covers the
    // Pacific evening of its last day. The hour cut below does the rest.
    const days = Math.min(requested, visibleDays + 1);
    const data = await fetchSpotScore(id, species, days, viewerId ?? undefined);
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(stripSpotScorePastHorizon(data, visibleDays), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
