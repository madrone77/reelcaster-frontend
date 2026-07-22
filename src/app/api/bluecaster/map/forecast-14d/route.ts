import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMapForecast14d } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import type { MapForecast14dPayload } from "@/lib/bluecaster";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/map/forecast-14d.
 * Keeps BLUECASTER_API_KEY server-side; the explore shell's viewport
 * forecast strip calls this with the current map bbox.
 *
 * Day peaks past the caller's horizon are stripped server-side (anon 2
 * days, free account 7, Pro 14 — same tiers as the spot forecast route);
 * the day entries stay so the strip renders its locked tiles. Upstream
 * fetch is cached by bbox; the strip is applied per-request, so the
 * response is private-cacheable only.
 */

/** Server-side mirrors of ANON_STRIP_DAYS / FREE_STRIP_DAYS in
 *  src/app/explore/lib/forecast-strip.ts. */
const ANON_FORECAST_DAYS = 2;
const FREE_FORECAST_DAYS = 7;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function callerVisibleDays(request: NextRequest): Promise<number> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return ANON_FORECAST_DAYS;

  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  const tier: string = settings?.subscription_tier ?? "free";
  const status: string = settings?.subscription_status ?? "none";
  const isPaid =
    tier.startsWith("pro") && (status === "active" || status === "trialing");
  return isPaid ? 14 : FREE_FORECAST_DAYS;
}

function stripLockedDays(
  data: MapForecast14dPayload,
  visibleDays: number,
): MapForecast14dPayload {
  const locked = (i: number) => i >= visibleDays;
  return {
    ...data,
    best: data.best.map((cell, i) => (locked(i) ? null : cell)),
    by_species: Object.fromEntries(
      Object.entries(data.by_species).map(([speciesId, cells]) => [
        speciesId,
        cells.map((cell, i) => (locked(i) ? null : cell)),
      ]),
    ),
  };
}

export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get("bbox");
  if (!bbox) {
    return NextResponse.json({ error: "bbox required" }, { status: 400 });
  }
  const [data, visibleDays] = await Promise.all([
    fetchMapForecast14d(bbox),
    callerVisibleDays(request),
  ]);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
  return NextResponse.json(
    visibleDays >= 14 ? data : stripLockedDays(data, visibleDays),
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
