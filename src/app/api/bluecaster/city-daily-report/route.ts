import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCityDailyReport, resolveHomeCity } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/cities/[slug]/daily-report,
 * for the daily report card on the Pro dashboard.
 *
 * Pro-only, and gated HERE rather than in the component: the client's
 * `useSubscription().isPaid` doesn't implement the grace window, so a user
 * in grace reads as free client-side. `resolveEntitlement` is the
 * load-bearing check — same reasoning as the fresh-catches route.
 *
 * A free caller gets `{ locked: true }` with no report body at all, so a
 * locked card has nothing to reveal in the network tab.
 *
 * The city comes from the caller's own home spot, resolved server-side —
 * it is deliberately NOT a query parameter. Letting the browser name the
 * city would turn a Pro dashboard card into a way to read every city's
 * report by iterating slugs.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json(
      { locked: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { isPro } = await resolveEntitlement(supabaseAdmin, userId);
  if (!isPro) {
    return NextResponse.json(
      { locked: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // The home spot lives in auth metadata, so read it with the caller's own
  // identity rather than trusting anything from the request body.
  const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
  const prefs = userRecord?.user?.user_metadata?.preferences as
    | { homeSpotSlug?: string }
    | undefined;
  const homeSpotSlug = prefs?.homeSpotSlug ?? null;

  const city = await resolveHomeCity(homeSpotSlug);
  if (!city) {
    // No home spot pinned, or it no longer resolves to a published city.
    // The card renders its own "pin a home spot" empty state.
    return NextResponse.json(
      { locked: false, city: null, status: "no_home_city", report: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const data = await fetchCityDailyReport(city.slug);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  return NextResponse.json(
    { locked: false, ...data },
    // Per-reader body behind a Pro gate — never shared-cached.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
