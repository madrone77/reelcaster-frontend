import { NextRequest, NextResponse } from "next/server";
import { fetchMapSpots } from "@/lib/bluecaster";
import { getUserIdFromRequest, hasBearer } from "@/lib/server-auth";
import { callerVisibleDays } from "@/lib/caller-horizon";
import { stripMapSpotsPastHorizon } from "@/lib/forecast-horizon";
import { localDateOf } from "@/lib/score-beats";

/**
 * GET /api/bluecaster/map/spots
 *
 * Same-origin proxy to BlueCaster's `/api/v1/map/spots` bulk reader.
 * Lets the Explore canvas refetch scores for a different date (forecast
 * day taps) without exposing the BlueCaster API key to the client.
 *
 * Auth is optional. With a valid session token the payload also carries that
 * angler's OWN custom spots, so they rank in the rail with everything else.
 * That response is per-user and must not be shared: it goes out `no-store`,
 * while the anonymous one stays cacheable.
 *
 * A `date` past the caller's forecast horizon (anon 1 day, free account 7,
 * Pro 14, the same rule the strip proxies apply) comes back with its spots but
 * without their scores — see `stripMapSpotsPastHorizon`. The strip was already
 * nulling those days; this is the payload that was still colouring the pins
 * under them.
 *
 * `own=0` asks for the published spots only, at the caller's horizon. The
 * angler's own custom spots are the one part of the body that differs per user,
 * and asking for them makes the upstream read personalized and uncached (about
 * a second). Without them the upstream read is the same shared, data-cached
 * body the anonymous request gets, and only the horizon strip is per caller.
 * This is what Explore's viewport loader sends for a signed-in angler on any
 * day past today: it colours the pins at close to anonymous speed with the
 * scores that angler is entitled to. The custom spots arrive on their own read.
 *
 * `shape=pins` asks for the slim map body (src/lib/map-pins.ts), which the
 * client expands. Forwarded as-is; the horizon strip blanks its `pins` the
 * same way it blanks `scores`.
 *
 * Query params (passed through): bbox=w,s,e,n · city=<slug> · date=YYYY-MM-DD · own=0 · shape=pins
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const bbox = sp.get("bbox") ?? undefined;
  const city = sp.get("city") ?? undefined;
  const date = sp.get("date") ?? undefined;
  // Id scope, forwarded verbatim. Upstream validates the ids, caps the list at
  // 120, and applies the published filter, so there is nothing to guard here —
  // an id a caller is not entitled to simply does not come back.
  const spotIds = (sp.get("spots") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const publishedOnly = sp.get("own") === "0";
  const signedIn = hasBearer(request);

  try {
    // Two reads of the same token: who is asking (their own spots ride along)
    // and how far ahead they may look. The second only costs a settings read
    // for a signed-in caller, and only matters when `date` is not today.
    // Published-only never needs the first, so the shared upstream read runs
    // alongside the horizon lookup instead of waiting on it.
    const scope = {
      spotIds: spotIds.length ? spotIds : undefined,
      bbox,
      city,
      date,
      shape: sp.get("shape") === "pins" ? ("pins" as const) : undefined,
    };
    const [viewerId, visibleDays, data] = publishedOnly
      ? await Promise.all([
          Promise.resolve(null),
          callerVisibleDays(request),
          fetchMapSpots(scope),
        ])
      : await (async () => {
          const [id, days] = await Promise.all([
            getUserIdFromRequest(request),
            callerVisibleDays(request),
          ]);
          return [id, days, await fetchMapSpots({ ...scope, viewerId: id ?? undefined })] as const;
        })();
    if (!data) {
      return NextResponse.json({ error: "unavailable" }, { status: 502 });
    }
    const body = stripMapSpotsPastHorizon(
      data,
      visibleDays,
      localDateOf(new Date()),
    );
    return NextResponse.json(body, {
      headers: {
        // Mirrors what BlueCaster sets on the same body. This proxy used to
        // answer with a bare `public, max-age=300`, which threw away the
        // upstream `s-maxage=600`: the shared edge cache fell back to the
        // browser TTL, so it re-fetched twice as often, and with no
        // `stale-while-revalidate` the angler who arrived on an expired entry
        // waited out a full cold origin read instead of being served the
        // slightly stale copy while the edge refreshed behind them.
        //
        // The viewer body carries that angler's own private spots and stays
        // out of any shared cache.
        // A signed-in body is stripped to THIS caller's horizon, so it is as
        // private as the viewer body. `own=0` is never shared either: the edge
        // keys on the URL alone, and an anonymous hit on the same URL must not
        // leave a stripped body there for the next Pro angler.
        "Cache-Control": viewerId || signedIn || publishedOnly
          ? "private, no-store"
          : "public, max-age=300, s-maxage=600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
