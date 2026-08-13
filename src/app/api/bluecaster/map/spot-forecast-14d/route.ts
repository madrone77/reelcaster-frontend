import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSpotsOutlook14d } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { resolveEntitlement } from "@/lib/entitlement";
import {
  stripSpotsOutlook,
  visibleForecastDays,
} from "@/lib/forecast-horizon";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/map/spot-forecast-14d.
 * Keeps BLUECASTER_API_KEY server-side. Backs the 14-day strip on spot
 * cards: one request per list, not one per card.
 *
 * Days past the caller's horizon are nulled server-side (anon 2, free
 * account 7, Pro 14 — see @/lib/forecast-horizon, shared with the viewport
 * strip proxy and the Explore page's prefetch), so a locked score never
 * reaches the browser. The `days` array stays whole; the strip draws its own
 * locked cells off the null. Per-caller, so the response is
 * private-cacheable only.
 */

/** Matches the upstream cap; keeps a hand-built URL from blowing the query. */
const MAX_SPOT_IDS = 120;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const spotIds = (sp.get("spots") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SPOT_IDS);
  const citySlug = sp.get("city") ?? undefined;
  const bbox = sp.get("bbox") ?? undefined;

  if (spotIds.length === 0 && !citySlug && !bbox) {
    return NextResponse.json(
      { error: "spots, city, or bbox required" },
      { status: 400 },
    );
  }

  const userId = await getUserIdFromRequest(request);
  const visibleDays = visibleForecastDays(
    !!userId,
    userId ? (await resolveEntitlement(supabaseAdmin, userId)).isPro : false,
  );

  // The id scope is the one that reaches a caller's own unpublished custom
  // spots, so it must not share a cache entry with the next request for the
  // same URL — passing the viewer id forces an uncached upstream fetch. City
  // and bbox scopes stay on the published set and keep their shared entry.
  const data = await fetchSpotsOutlook14d(
    { spotIds: spotIds.length ? spotIds : undefined, citySlug, bbox },
    spotIds.length && userId ? { viewerId: userId } : {},
  );
  if (!data) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  return NextResponse.json(stripSpotsOutlook(data, visibleDays), {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
