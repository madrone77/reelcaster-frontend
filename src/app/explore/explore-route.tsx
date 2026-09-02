import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import {
  fetchHierarchyLight,
  fetchMapForecast14d,
  fetchMapSpots,
  fetchSpotCoords,
  resolveHomeCity,
} from "@/lib/bluecaster";
import {
  stripViewportForecast,
  visibleForecastDays,
} from "@/lib/forecast-horizon";
import {
  buildExploreData,
  coveredCitySlug,
  hasPreferredDefaultCity,
  PREFERRED_DEFAULT_CITY,
} from "./lib/explore-data";
import { nearestOpeningCity, readVisitorPoint } from "./lib/opening-city";
import { HOME_SPOT_COOKIE, sanitizeHomeSpotSlug } from "./lib/home-spot-cookie";
import { HOME_CITY_COOKIE, sanitizeHomeCitySlug } from "./lib/home-city-cookie";
import { parseWall } from "@/lib/ad-mode";
import { ANGLES } from "@/app/lp/_shared/lp-angles";
import { openingBbox, spotViewBox } from "./lib/viewport-bbox";
import { PREVIEW_COOKIE, parsePreviewState } from "@/lib/preview-gate";
import ExploreShell from "./explore-shell";


// Covers BC + WA + OR — the same extent the old province pills spanned.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

/**
 * Both Explore routes, one implementation.
 *
 * `/explore` is the product's map. `/m/explore` is the same map behind the
 * paid-marketing frame that can take depth away (see @/lib/preview-gate). They
 * are deliberately not two components: this file is 250 lines of hard-won
 * opening-frame logic, and a hand-maintained second copy would be showing ad
 * traffic an older product than search traffic inside a month.
 */
export async function renderExplore({
  searchParams,
  marketing = false,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  /** True on /m/explore. The only surface a decline can strip. */
  marketing?: boolean;
}) {
  const [hierarchy, params, headerList, cookieStore] = await Promise.all([
    fetchHierarchyLight(),
    searchParams,
    headers(),
    cookies(),
  ]);

  // ── The city the URL asked for ───────────────────────────────────────────
  //
  // `?loc` is the Explore canvas's city param (see use-explore-state), and the
  // client has always honoured it: the shell resolves the slug, frames the
  // city, and lets the viewport load its spots. What it could not do was make
  // any of that happen before hydration. A deep link to Vancouver was served
  // Victoria's spots and Victoria's prefetched strip, discarded both on the
  // client because the URL named somewhere else, then flew to Vancouver's
  // centre and fetched the lot again — so the one arrival that names its
  // destination up front was the slowest one on the site.
  //
  // Reading it here costs the route its static render — see the note above the
  // return. The client behaviour is unchanged for every URL this cannot
  // resolve.
  // ── The ad frame ─────────────────────────────────────────────────────────
  //
  // `?ad=<wall>` turns this into a paid-traffic landing page: no way off the
  // page, an emptied top bar carrying the mark and one Start free trial
  // button, and the trial modal behind it. See @/lib/ad-mode, which owns the
  // wall vocabulary both frames share.
  //
  // The charge date used to be computed here and passed down, because the
  // pinned bar rendered it and reading a clock in a client render is how a
  // date becomes a hydration mismatch. The modal carries its own terms now, so
  // there is nothing left for this route to date.
  //
  // Read straight off searchParams here, with none of the ceremony the spot
  // page needed. That page is prerendered and a searchParams read would have
  // cost it its head tags, so the frame had to arrive by rewrite. This route
  // already reads searchParams (`?loc`, `?spot`), already bails out of static
  // rendering, and is already `robots: { index: false }` — there is nothing
  // left here for an ad parameter to spend.
  const adParam = typeof params.ad === "string" ? params.ad : null;
  const ad = adParam ? { wall: parseWall(adParam) } : null;

  // `?city=` is what every /lp link carries, and an ad link for this page will
  // be written by the same hand on the same afternoon. On a paid link it means
  // `?loc`. Accepted ONLY under `ad`, so the canvas's own vocabulary is
  // untouched everywhere else, and so a habit does not silently cost a
  // campaign its targeting: without this, `?ad=today&city=seattle-wa` opens on
  // the visitor's geo and reports a city the ad never chose.
  const locParam = typeof params.loc === "string" ? params.loc : null;
  const cityAlias = ad && typeof params.city === "string" ? params.city : null;
  const loc = locParam ?? cityAlias;
  const spot = typeof params.spot === "string" ? params.spot : null;

  /**
   * `?z` — an opening zoom, for links that know the frame they want.
   *
   * A city opens at zoom 9, which is the right default when the visitor picked
   * the city themselves. It is too wide for an ad link into Puget Sound, where
   * it pulls back past the water the ad is about. Clamped to the map's own
   * range so a typo cannot strand somebody in orbit or inside a sand grain.
   *
   * Deliberately loses to a restored view: somebody returning to Explore keeps
   * where they were, and only a cold arrival is framed by the URL.
   */
  const zParam = typeof params.z === "string" ? Number(params.z) : NaN;
  const initialZoomOverride =
    Number.isFinite(zParam) ? Math.min(16, Math.max(4, zParam)) : null;

  // ── The spot the URL asked for, which outranks the city ──────────────────
  //
  // `?spot` is the more specific frame — an "open in map" from a spot page, a
  // search hit, a link somebody shared of one piece of water — so it wins over
  // `?loc` when both are present.
  //
  // It had a longer version of the same problem `?loc` did, and a worse chain:
  // the shell could not find the slug in the default city's spots, so it asked
  // for the spot's coordinates alone, flew 800 ms to them, and only then did
  // the settled viewport pull in the spots that let the drawer open. Every leg
  // of that waited on the JS bundle first.
  //
  // Resolving the slug here is the extra hop `?loc` did not need: `map/spots`
  // takes a city or a bbox, never a spot, so a slug has to become coordinates
  // before it can become a payload. It is cached upstream for an hour — a spot
  // does not move — so the hop is a Data Cache read on all but the first ask.
  //
  // An unknown or unpublished slug resolves to nothing and simply falls through
  // to the `?loc` / default-city path below, which is where the client would
  // have ended up anyway.
  // ── The angler's own home city ───────────────────────────────────────────
  //
  // A pinned home spot is the strongest statement about where somebody fishes
  // that this product holds: they chose one piece of water out of every spot
  // we cover and pinned it. "Explore" from the dashboard, the bottom nav, or
  // anywhere else is a bare /explore, so before this the map answered that
  // statement with an IP guess — and an angler in Sooke whose phone exits
  // through Vancouver opened two hours up the coast from their own dock.
  //
  // Read from a cookie because it has to be answered here, in the first
  // render. The Supabase session lives in localStorage, so this route has no
  // way to ask who is asking; ./lib/home-spot-cookie mirrors the pin into a
  // cookie for exactly this read. A missing or malformed cookie is simply no
  // pin, and the geo tier below runs as before.
  //
  // Skipped outright when the URL names a destination — `?loc` and `?spot`
  // are somebody asking for a specific frame right now, which outranks a
  // standing preference — so the extra fetch only happens on the arrivals it
  // can actually change.
  // ── The preview gate ─────────────────────────────────────────────────────
  //
  // Read on the server, beside the home-spot cookie above and safe for exactly
  // the same reason: this route is `ƒ` (it awaits `searchParams`), so there is
  // no shared CDN entry for one visitor's answer to leak into another's. Doing
  // it here rather than after hydration is also the better experience — a
  // visitor who declined would otherwise watch the depth map paint and then
  // disappear on every single load.
  const previewState = parsePreviewState(cookieStore.get(PREVIEW_COOKIE)?.value);

  // The angler's own answer, when they have given one. Read straight from its
  // own cookie rather than derived, which is the whole point of the setting:
  // every consumer of the home SPOT except the dashboard hero only ever wanted
  // the city it sat in, and inferring one from the other made a guessable
  // question depend on an unguessable one.
  const homeCityCookie =
    loc || spot
      ? null
      : sanitizeHomeCitySlug(cookieStore.get(HOME_CITY_COOKIE)?.value);

  // The pin stays as the fallback, so every angler who set one before this
  // shipped keeps their opening frame without a backfill. Skipped entirely
  // once the city is known, which also skips its hierarchy read.
  const homeSpotSlug =
    loc || spot || homeCityCookie
      ? null
      : sanitizeHomeSpotSlug(cookieStore.get(HOME_SPOT_COOKIE)?.value);
  // Started before the spot-coords await below so the two overlap; both are
  // Data Cache reads on all but the first request (the place tree is cached
  // for an hour and shared by every visitor, so this adds no upstream load).
  const homeCityPromise = homeSpotSlug ? resolveHomeCity(homeSpotSlug) : null;

  const spotCoords = spot
    ? (await fetchSpotCoords([spot]))?.find((s) => s.slug === spot) ?? null
    : null;
  const spotBox = spotCoords ? spotViewBox(spotCoords) : null;

  // Null when the pin no longer resolves — an unpublished or deleted spot —
  // which reads as no pin rather than as an error.
  const homeCity = homeCityPromise ? await homeCityPromise : null;
  // `coveredCitySlug` below gates whichever of the two we end up with, so an
  // unpublished or retired city reads as no preference rather than as an error.
  const homeCitySlug = homeCityCookie ?? homeCity?.slug;

  // ── Ship the opening city's spots, not three provinces' worth ────────────
  //
  // This used to fetch COVERED_BBOX_ALL — every published spot in BC, WA and
  // OR — and serialize the lot into the document: 685 KB of JSON, 91 KB over
  // the wire, for a map that opens on one city. Everything past the opening
  // viewport was paid for at boot and read only if the angler happened to pan
  // there. The shell now loads spots as the map moves (see `loadedSpots`), so
  // the first response only has to cover the frame the page actually opens on.
  //
  // The wide fetch stays as the fallback: `defaultCitySlug` prefers Victoria
  // but falls back to the best-scoring city, and "best-scoring" cannot be known
  // without scores for every city. When the pilot city is covered — which is
  // the shipped configuration — the narrow path is the one that runs.
  //
  // ── Open on the visitor's nearest city, not on Victoria ──────────────────
  //
  // Four tiers, most specific first:
  //   1. `?loc`, which is somebody naming a destination.
  //   2. The city of the angler's own pinned home spot — a standing statement
  //      about where they fish, which beats any guess made from their IP. See
  //      the home-city block above.
  //   3. The covered city the visitor's IP would send them to — the nearest one
  //      when they are near any of them, the nearest hub when they are not.
  //      Seattle for an arrival from Seattle or from New York, Vancouver for
  //      one from Calgary, Prince Rupert for one from Anchorage.
  //   4. Victoria, for the arrivals that carry no position at all: `next dev`,
  //      crawlers, uptime checks, anything on a data-centre IP.
  //
  // Tier 3 replaced a world where everyone got tier 4, so a Seattle angler's
  // first frame was water in another country and the product's opening move was
  // to make them pan out of it. See ./lib/opening-city.ts for why this reads an
  // IP header rather than asking the browser, and why it carries no distance
  // cap where the homepage's near-you section does.
  //
  // This costs nothing upstream: `readVisitorPoint` reads a header already on
  // the request, and the snap runs against the hierarchy this page fetches
  // anyway. It costs nothing at the CDN either — the route is already `ƒ` for
  // reading `searchParams` (see the note above the return), so there is no
  // shared cache entry here for one visitor's city to leak into another's,
  // which is what makes the cookie tier safe too: Vercel's CDN keys on the URL
  // and ignores cookies, so a per-angler opening frame would leak straight
  // into the next visitor's HTML on any route that WAS shared-cached.
  // The fetches below stay keyed by city in the Data Cache, where Seattle's
  // payload being shared between everyone who lands on Seattle is the point.
  const visitor = readVisitorPoint(headerList, {
    lat: typeof params.geo_lat === "string" ? params.geo_lat : null,
    lng: typeof params.geo_lng === "string" ? params.geo_lng : null,
  });

  const openingCity =
    coveredCitySlug(hierarchy, loc) ??
    coveredCitySlug(hierarchy, homeCitySlug) ??
    nearestOpeningCity(hierarchy, visitor) ??
    (hasPreferredDefaultCity(hierarchy) ? PREFERRED_DEFAULT_CITY : null);

  const payload = spotBox
    ? await fetchMapSpots({ bbox: spotBox })
    : openingCity
      ? await fetchMapSpots({ city: openingCity })
      : await fetchMapSpots({ bbox: COVERED_BBOX_ALL });

  const data = buildExploreData(hierarchy, payload);

  // ── Prefetch the 14-day strip for the box this page opens on ─────────────
  //
  // The strip used to be a purely client-side fetch, which meant it could not
  // start until ~750 KB of JS had downloaded, parsed and hydrated. Measured on
  // prod: 1.7 s to paint on a fast desktop, but 5.0 s at 1.5 Mbps and 5.2 s on
  // a 4x-throttled CPU — and 4.2 s of that 5.0 s was spent before the request
  // was even made. The payload is 4.7 KB. It belongs in the first response.
  //
  // On a city frame `openingBbox` is the same key the shell seeds itself with
  // at mount, so the client finds this payload already in hand instead of
  // refetching it. A spot frame cannot reach that equality — its box comes from
  // the real viewport, which is a browser fact — so there the prefetch is a
  // seed that paints immediately and is replaced once the camera reports. That
  // is still far better than the alternative, which was an empty strip until
  // the bundle landed.
  //
  // Stripped to the ANONYMOUS horizon before it goes into the HTML. This page
  // still reads no session: the home-spot cookie names a piece of water, not a
  // tier, and nothing here verifies who anybody is — so it has no business
  // carrying paid days:
  // putting all 14 in the markup is precisely the leak `resolveEntitlement` was
  // written to close. The shell renders days past this horizon as pending
  // rather than locked until the client learns the real tier — nothing is
  // promised and nothing is withheld on a guess.
  //
  // `framedCity` is the city the payload is about, and it is what the shell is
  // told. On the wide fallback `openingCity` is null but the box is still one
  // city's, so passing the raw `openingCity` there would have the client throw
  // away a prefetch that was perfectly good. On a spot frame it is read back off
  // the payload — the spot knows its own home city, so this costs no extra
  // fetch — and it is what scopes the rail and names the location pill while
  // the map is still booting.
  const framedCity = spotBox
    ? data.spots.find((s) => s.slug === spot)?.citySlug ?? null
    : openingCity ?? data.defaultCitySlug;

  const initialBbox = spotBox ?? openingBbox(data.spots, framedCity);
  const forecast = initialBbox ? await fetchMapForecast14d(initialBbox) : null;
  const initialForecast = forecast
    ? stripViewportForecast(forecast, visibleForecastDays(false, false))
    : null;

  // The Explore canvas is driven by `useSearchParams()` (?loc/?spot/?day/?stn),
  // which forces a client-render bailout and so must sit under a Suspense
  // boundary. This surfaced only once AuthGate stopped returning a spinner for
  // every server render — the bailout was previously masked because the tree
  // below the gate never executed on the server at all.
  //
  // ── Why this route is `ƒ` and not `○` ────────────────────────────────────
  //
  // Reading `searchParams` above opts the route out of static rendering: it
  // used to prerender once and serve from the CDN, and now every request runs
  // the function. There is no way around that in this Next version — a dynamic
  // read anywhere bails the whole route, Suspense included, and PPR (which is
  // exactly the feature that would let the shell stay static with a dynamic
  // hole) is canary-only in 15.3.
  //
  // The cost is bounded on purpose. Both fetches above go through the Data
  // Cache (300 s for spots, 120 s for the strip), so a warm render is
  // assembly, not round trips — measured locally at ~15 ms against ~3 ms for
  // the prerendered file. And `coveredCitySlug` gates `?loc` against the
  // covered-city tree, so the number of distinct cache entries is the number
  // of covered cities, not the number of strings a caller can invent.
  //
  // The indexable content lives on /fishing/[province]/[city] and
  // /explore/spot/[slug], both of which prerender fully; this route is the
  // interactive map app, already `robots: { index: false }`, so nothing about
  // this trade touches what Google sees.
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreShell
        data={data}
        bbox={COVERED_BBOX_ALL}
        initialCitySlug={framedCity}
        initialSpot={spotCoords}
        initialZoomOverride={initialZoomOverride}
        initialForecast={initialForecast}
        initialForecastBbox={initialBbox}
        marketing={marketing}
        initialPreview={previewState}
        ad={
          ad
            ? {
                wall: ad.wall,
                // Shared with the /lp angles so the two kinds of ad can be
                // compared on one axis. An unknown value counts as no angle
                // rather than inventing one, matching how the campaign
                // counter validates it.
                angle: ANGLES.some((a) => a.id === params.a)
                  ? (params.a as string)
                  : "",
              }
            : null
        }
      />
    </Suspense>
  );
}

function ExploreLoading() {
  return (
    <div className="h-dvh flex items-center justify-center bg-rc-panel">
      <p className="font-rc-mono text-[11px] tracking-[0.14em] uppercase text-rc-ink-mute">
        Loading map…
      </p>
    </div>
  );
}
