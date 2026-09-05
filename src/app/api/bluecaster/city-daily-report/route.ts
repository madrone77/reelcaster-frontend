import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCityDailyReport } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import {
  readHomeCityPrefs,
  resolveEffectiveHomeCity,
} from "@/lib/home-city-server";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/cities/[slug]/daily-report,
 * for the daily report card on the Pro dashboard.
 *
 * Pro-only, and gated HERE rather than in the component: the client's
 * `useSubscription().isPaid` doesn't implement the grace window, so a user
 * in grace reads as free client-side. `resolveEntitlement` is the
 * load-bearing check — same reasoning as the fresh-catches route.
 *
 * A free caller gets `{ locked: true }` with the resolved city and the
 * report's headline and date, and nothing else: no prose, no outlook, no tips,
 * so a locked card has no body to reveal in the network tab. The headline is
 * free for the same reason it is free on the public city page (see
 * ../city-report): it is the line that says a real report exists for this
 * water, and a member who cannot see that it exists cannot be sold on it. The
 * gate sits on the body, not on the city.
 *
 * The city is resolved server-side from the caller's own account — it is
 * deliberately NOT a query parameter. Letting the browser name the city would
 * turn a Pro dashboard card into a way to read every city's report by
 * iterating slugs. See @/lib/home-city-server for the three tiers.
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

  // The preferences live in auth metadata, so read them with the caller's own
  // identity rather than trusting anything from the request body.
  const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
  const prefs = readHomeCityPrefs(userRecord?.user?.user_metadata);

  // Stated city, then the city under a pinned spot, then the nearest covered
  // city to the request's own IP fix. The last tier is why this route almost
  // never returns `no_home_city` any more: somebody who closed the modal
  // without choosing is owed a report about real water, not a link telling
  // them to go and answer a question they already declined.
  const city = await resolveEffectiveHomeCity(request, prefs);
  if (!city) {
    // No answer, no pin, and no position: a crawler, or a data-centre IP. The
    // card renders its own empty state.
    return NextResponse.json(
      { locked: false, city: null, status: "no_home_city", report: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const data = await fetchCityDailyReport(city.slug);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  if (!isPro) {
    // The city and the headline, and no more. Same tier-to-tier shape as the
    // public city page: the body is not sent and hidden, it is not sent.
    const r = data.report;
    return NextResponse.json(
      {
        locked: true,
        city: data.city,
        citySource: city.source,
        status: data.status,
        report:
          data.status === "ready" && r
            ? {
                headline: r.headline,
                report_date: r.report_date,
                generated_at: r.generated_at,
              }
            : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    // `citySource` after the spread: the upstream payload names the city, and
    // the card has to be able to tell a city the angler chose from one we
    // picked for them.
    { locked: false, ...data, citySource: city.source },
    // Per-reader body behind a Pro gate — never shared-cached.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
