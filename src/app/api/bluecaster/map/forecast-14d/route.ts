import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMapForecast14d } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import {
  stripViewportForecast,
  visibleForecastDays,
} from "@/lib/forecast-horizon";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/map/forecast-14d.
 * Keeps BLUECASTER_API_KEY server-side. The Explore shell's viewport strip
 * calls this with the current map bbox; a city page calls it with `city`, and
 * gets that city's whole roster rather than whatever a rectangle caught.
 *
 * Day peaks past the caller's horizon are stripped server-side (anon 2
 * days, free account 7, Pro 14 — see @/lib/forecast-horizon, which the
 * Explore page's prefetch and the per-spot outlook share); the day entries
 * stay so the strip renders its locked tiles. Upstream fetch is cached by
 * bbox; the strip is applied per-request, so the response is
 * private-cacheable only.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function callerVisibleDays(request: NextRequest): Promise<number> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return visibleForecastDays(false, false);

  const { isPro } = await resolveEntitlement(supabaseAdmin, userId);
  return visibleForecastDays(true, isPro);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const bbox = sp.get("bbox");
  // A city page asks by roster, not by rectangle — see fetchMapForecast14d.
  // Upstream gives `city` precedence over `bbox`; this route only requires
  // that one of them is present, because with neither the answer would be
  // every published spot in the product.
  const city = sp.get("city");
  if (!bbox && !city) {
    return NextResponse.json({ error: "bbox or city required" }, { status: 400 });
  }
  const [data, visibleDays] = await Promise.all([
    fetchMapForecast14d({ bbox: bbox ?? undefined, city: city ?? undefined }),
    callerVisibleDays(request),
  ]);
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
  return NextResponse.json(stripViewportForecast(data, visibleDays), {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
