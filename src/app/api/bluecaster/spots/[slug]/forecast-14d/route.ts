import { NextRequest, NextResponse } from "next/server";
import { fetchSpotForecast14d } from "@/lib/bluecaster";
import { getUserIdFromRequest } from "@/lib/server-auth";
import { callerVisibleDays } from "@/lib/caller-horizon";
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
 * Days past the caller's horizon are stripped server-side (scores,
 * conditions, daily summary) while the day entries themselves stay in
 * place so the client strip still renders its locked tiles. Horizon:
 * anonymous 2 days, free account 7, Pro 14 (Bearer token, same pattern
 * as /api/spot-page).
 */

/**
 * Null out the forecast data for days past the free horizon. Day entries
 * are kept (iso/dow/date) — the client's `buildForecastDays` maps over
 * `daily14` and needs the full 14 entries to render the locked tiles;
 * `peakOf` on an emptied hour array yields a null score, which the locked
 * `DayCell` never displays anyway.
 */
function stripLockedDays(
  data: Forecast14dPayload,
  visibleDays: number,
): Forecast14dPayload {
  const locked = (i: number) => i >= visibleDays;
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
    // Forward the verified viewer so an owner can read their OWN private
    // custom spot. Without it BlueCaster's visibility gate 404s the whole
    // payload, the client never receives days 1..13, and the chart silently
    // keeps showing today — which reads as "the tide doesn't change when I
    // switch days", on custom spots only.
    const viewerId = await getUserIdFromRequest(request);
    const [data, visibleDays] = await Promise.all([
      fetchSpotForecast14d(slug, viewerId ?? undefined),
      callerVisibleDays(request),
    ]);
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      visibleDays >= 14 ? data : stripLockedDays(data, visibleDays),
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
