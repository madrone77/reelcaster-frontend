import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSpotForecast14d } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import type { Forecast14dPayload } from "@/lib/bluecaster/live-spot-types";

/**
 * GET /api/bluecaster/spots/[slug]/forecast-14d
 *
 * Same-origin proxy to BlueCaster's `/api/v1/spots/[slug]/forecast-14d`.
 * Lets the browser-side `LiveSpotPage` lazy-fetch the 14-day extended
 * grid without exposing the BlueCaster API key to the client. Matches
 * the rest of this app's BC integration: server-only key, single env
 * var (BLUECASTER_API_KEY).
 *
 * Days past the free horizon are Boat Pro: for anonymous / free callers
 * the locked days' data is stripped server-side (scores, conditions,
 * daily summary) while the day entries themselves stay in place so the
 * client strip still renders its locked tiles. Pro subscribers (Bearer
 * token, same pattern as /api/spot-page) get the full payload.
 */

/** Server-side mirror of FREE_STRIP_DAYS in src/app/explore/lib/forecast-strip.ts. */
const FREE_FORECAST_DAYS = 10;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function callerIsPaid(request: NextRequest): Promise<boolean> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return false;

  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  const tier: string = settings?.subscription_tier ?? "free";
  const status: string = settings?.subscription_status ?? "none";
  return (
    tier.startsWith("pro") && (status === "active" || status === "trialing")
  );
}

/**
 * Null out the forecast data for days past the free horizon. Day entries
 * are kept (iso/dow/date) — the client's `buildForecastDays` maps over
 * `daily14` and needs the full 14 entries to render the locked tiles;
 * `peakOf` on an emptied hour array yields a null score, which the locked
 * `DayCell` never displays anyway.
 */
function stripLockedDays(data: Forecast14dPayload): Forecast14dPayload {
  const locked = (i: number) => i >= FREE_FORECAST_DAYS;
  return {
    ...data,
    daily14: data.daily14.map((d, i) =>
      locked(i) ? { ...d, glyph: null, score: null, high: null, low: null } : d,
    ),
    hourlyScoreGrid: Object.fromEntries(
      Object.entries(data.hourlyScoreGrid).map(([speciesId, days]) => [
        speciesId,
        days.map((hours, i) => (locked(i) ? [] : hours)),
      ]),
    ),
    hourlyConditionsGrid: data.hourlyConditionsGrid.map((hours, i) =>
      locked(i) ? [] : hours,
    ),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const [data, isPaid] = await Promise.all([
      fetchSpotForecast14d(slug),
      callerIsPaid(request),
    ]);
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(isPaid ? data : stripLockedDays(data), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
