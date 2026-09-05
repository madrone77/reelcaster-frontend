/**
 * GET /api/bluecaster/nearby-reports
 *
 * The daily reports for the covered cities NEXT TO the angler's home city, for
 * the block under their own city's report on the dashboard.
 *
 * Anglers here fish across a boundary. Somebody in Victoria runs to Sidney and
 * out to Sooke without thinking of it as travelling, and somebody in Seattle
 * crosses to Friday Harbor. Their own city's report answers "what is happening
 * at home"; this answers "and what about the next bay over", which on a slow
 * week at home is the more useful of the two.
 *
 * Nearest by distance, but the angler's OWN COUNTRY first.
 *
 * Friday Harbor's two nearest covered cities are Sidney and Victoria, both in
 * British Columbia — a licence, a set of regulations and a border crossing
 * away from a Washington angler, which makes them poor suggestions however
 * close they measure. Same-country cities are exhausted before any
 * cross-border one is offered, and a cross-border entry that does get through
 * carries its province so nobody reads "Victoria" as local water.
 *
 * Within a country it is still plain distance: Victoria gives Sidney and
 * Sooke, Seattle gives Friday Harbor.
 *
 * ⚠️ The cities are chosen HERE and are deliberately not query parameters, the
 * same rule ../city-daily-report follows. Letting the browser name a city would
 * turn one Pro card into a way to read every city's report by iterating slugs,
 * and this route would be the hole the other one was careful not to leave.
 *
 * Pro-only, gated on `resolveEntitlement` rather than the client's
 * `useSubscription`, which skips the grace window.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCityDailyReport, fetchHierarchyLight } from "@/lib/bluecaster";
import { coveredCityPoints, haversineKm } from "@/lib/nearby-spots";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import {
  readHomeCityPrefs,
  resolveEffectiveHomeCity,
} from "@/lib/home-city-server";

/**
 * How many neighbours to carry.
 *
 * Two. This block sits under a report the angler came for, and a third city is
 * where "nearby" stops meaning nearby: from Victoria the third is Friday
 * Harbor, across an international border and a ferry.
 */
const NEARBY_COUNT = 2;

/**
 * Flattened on purpose.
 *
 * Upstream nests the body under `.report` and carries a `status`, and a city
 * whose report is `pending` or whose window holds no posts has nothing to say.
 * Deciding that here means the client cannot render a named city with an empty
 * body under it, which is what a broken card looks like.
 */
export interface NearbyCityReport {
  city: { slug: string; name: string };
  distanceKm: number;
  headline: string | null;
  reportsMd: string;
  windowDays: number;
  /** Set only when the city is in a different country from the angler's own,
   *  so the client can name the province rather than imply local water. */
  foreignProvince: string | null;
  /** The report's own date, `YYYY-MM-DD`. Shown, because these are not
   *  guaranteed daily and an undated headline reads as current. */
  reportDate: string;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: NextRequest) {
  const locked = NextResponse.json(
    { locked: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );

  const userId = await getUserIdFromRequest(request);
  if (!userId) return locked;

  const { isPro } = await resolveEntitlement(supabaseAdmin, userId);
  if (!isPro) return locked;

  // The angler's own identity, never the request body. Same resolver and same
  // three tiers as ../city-daily-report, so the neighbours are always the
  // neighbours of the city whose report sits above them.
  const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
  const home = await resolveEffectiveHomeCity(
    request,
    readHomeCityPrefs(userRecord?.user?.user_metadata),
  );

  if (!home) {
    return NextResponse.json(
      { locked: false, cities: [] as NearbyCityReport[] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const covered = coveredCityPoints(await fetchHierarchyLight());
  const origin = covered.find((c) => c.slug === home.slug);
  if (!origin) {
    return NextResponse.json(
      { locked: false, cities: [] as NearbyCityReport[] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  // Country first, then distance. A stable two-key sort rather than two passes:
  // same-country cities all rank ahead of every foreign one, and within each
  // group the nearest wins. Cross-border cities are therefore only ever fill,
  // which is what makes Friday Harbor open on Seattle instead of on Sidney.
  const neighbours = covered
    .filter((c) => c.slug !== origin.slug)
    .map((c) => ({
      city: { slug: c.slug, name: c.name },
      distanceKm: haversineKm(origin.lat, origin.lng, c.lat, c.lng),
      foreign: c.country !== origin.country,
      province: c.province,
    }))
    .sort((a, b) =>
      a.foreign === b.foreign
        ? a.distanceKm - b.distanceKm
        : a.foreign
          ? 1
          : -1,
    )
    .slice(0, NEARBY_COUNT);

  // Concurrent, and each failure isolated: one city whose report is missing
  // must not blank the other. `fetchCityDailyReport` carries a 300s revalidate,
  // so on all but the first request of the window these are Data Cache reads
  // shared by every angler in the same neighbourhood.
  const settled = await Promise.all(
    neighbours.map(async (n) => ({
      ...n,
      payload: await fetchCityDailyReport(n.city.slug).catch(() => null),
    })),
  );

  const cities: NearbyCityReport[] = [];
  for (const { city, distanceKm, foreign, province, payload } of settled) {
    const r = payload?.report;
    // Prose present and the report ready. Same test the main card applies, and
    // deliberately NOT `reports_signal_count > 0`.
    //
    // That field reads like the right gate — its own doc says zero means there
    // is nothing current to say — but it is not populated for the Washington
    // cities. Friday Harbor comes back `ready` with a real headline and a count
    // of 0, and so does Seattle itself, so gating on it hid the whole WA market
    // from this block while Victoria and Sidney sailed through. Checked against
    // live upstream data, not inferred from the type.
    if (!payload || payload.status !== "ready" || !r?.reports_md) continue;
    cities.push({
      city,
      distanceKm,
      headline: r.headline,
      reportsMd: r.reports_md,
      windowDays: r.reports_window_days,
      reportDate: r.report_date,
      foreignProvince: foreign ? province : null,
    });
  }

  return NextResponse.json(
    { locked: false, cities },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
