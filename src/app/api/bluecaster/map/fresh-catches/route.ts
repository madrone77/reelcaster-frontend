import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchFreshCatches } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import type { RailFreshCatch } from "@/app/explore/lib/fresh-catch-types";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/map/fresh-catches.
 * Keeps BLUECASTER_API_KEY server-side; the explore shell calls this once and
 * joins the result onto the rail by spot id.
 *
 * Also the Pro gate. Everyone learns that a spot IS being tracked; only Pro
 * learns how it's fishing. The verdict and the counts are stripped HERE,
 * server-side — a locked card has nothing to reveal in the network tab.
 *
 * Gated at the route rather than in the component on purpose: the client's
 * `useSubscription().isPaid` does not implement the grace window, so a user in
 * grace reads as free client-side. `resolveEntitlement` is the load-bearing one.
 */

const FRESH_DAYS = 21;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function callerIsPro(request: NextRequest): Promise<boolean> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return false;
  const { isPro } = await resolveEntitlement(supabaseAdmin, userId);
  return isPro;
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") ?? undefined;
  // Single-spot reads (the spot page) narrow the same payload rather than
  // adding a second endpoint — it's counts-only and small either way.
  const only = request.nextUrl.searchParams.get("spot");

  const [data, isPro] = await Promise.all([
    fetchFreshCatches({ city, days: FRESH_DAYS }),
    callerIsPro(request),
  ]);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  const spots: Record<string, RailFreshCatch> = {};
  for (const [spotId, s] of Object.entries(data.spots)) {
    if (only && spotId !== only) continue;
    spots[spotId] = isPro
      ? {
          locked: false,
          verdict: s.verdict,
          count: s.count,
          positive: s.positive,
          latestDate: s.latest_date,
          species: s.species,
        }
      : { locked: true };
  }

  return NextResponse.json(
    { since: data.since, days: data.days, unlocked: isPro, spots },
    // Two different bodies share this URL, so it must never reach a shared
    // cache — a Pro body served to a stranger is the failure mode here.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
