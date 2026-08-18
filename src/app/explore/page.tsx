import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import {
  fetchHierarchyLight,
  fetchMapForecast14d,
  fetchMapSpots,
  fetchSpotCoords,
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
import { openingBbox, spotViewBox } from "./lib/viewport-bbox";
import ExploreShell from "./explore-shell";


// Covers BC + WA + OR — the same extent the old province pills spanned.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  // Spelling it out here rendered "Explore | ReelCaster | ReelCaster".
  title: "Explore the Fishing Map",
  description:
    "Interactive fishing map: browse covered spots in BC, WA, and OR with live scores, conditions, and the day's best windows.",
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    title: "Explore the Fishing Map | ReelCaster",
    description:
      "Interactive fishing map: browse covered spots and see live RC scores.",
    url: `${SITE_URL}/explore`,
    siteName: "ReelCaster",
    type: "website",
    ...DEFAULT_OG,
    locale: "en_CA",
  },
  // The map is a client app: `useSearchParams()` forces a client-render
  // bailout, so all a crawler ever receives is the "Loading map…" fallback —
  // about 70 characters of text, and no <h1>. Asking to be indexed on that
  // earns a thin-content / soft-404 flag and spends crawl budget that should
  // go to the city and spot pages, which prerender in full.
  //
  // `follow` stays on: this page links out to every spot, so it still passes
  // discovery and link equity down to the surfaces that do have content.
  robots: { index: false, follow: true },
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [hierarchy, params, headerList] = await Promise.all([
    fetchHierarchyLight(),
    searchParams,
    headers(),
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
  const loc = typeof params.loc === "string" ? params.loc : null;
  const spot = typeof params.spot === "string" ? params.spot : null;

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
  const spotCoords = spot
    ? (await fetchSpotCoords([spot]))?.find((s) => s.slug === spot) ?? null
    : null;
  const spotBox = spotCoords ? spotViewBox(spotCoords) : null;

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
  // Three tiers, most specific first:
  //   1. `?loc`, which is somebody naming a destination.
  //   2. The covered city the visitor's IP would send them to — the nearest one
  //      when they are near any of them, the nearest hub when they are not.
  //      Seattle for an arrival from Seattle or from New York, Vancouver for
  //      one from Calgary, Prince Rupert for one from Anchorage.
  //   3. Victoria, for the arrivals that carry no position at all: `next dev`,
  //      crawlers, uptime checks, anything on a data-centre IP.
  //
  // Tier 2 is the new one. Everyone used to get tier 3, so a Seattle angler's
  // first frame was water in another country and the product's opening move was
  // to make them pan out of it. See ./lib/opening-city.ts for why this reads an
  // IP header rather than asking the browser, and why it carries no distance
  // cap where the homepage's near-you section does.
  //
  // This costs nothing upstream: `readVisitorPoint` reads a header already on
  // the request, and the snap runs against the hierarchy this page fetches
  // anyway. It costs nothing at the CDN either — the route is already `ƒ` for
  // reading `searchParams` (see the note above the return), so there is no
  // shared cache entry here for one visitor's city to leak into another's.
  // The fetches below stay keyed by city in the Data Cache, where Seattle's
  // payload being shared between everyone who lands on Seattle is the point.
  const visitor = readVisitorPoint(headerList, {
    lat: typeof params.geo_lat === "string" ? params.geo_lat : null,
    lng: typeof params.geo_lng === "string" ? params.geo_lng : null,
  });

  const openingCity =
    coveredCitySlug(hierarchy, loc) ??
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
  // reads no session — it renders per request now, but off `?loc`/`?spot`
  // alone, which is not identity — so it has no business carrying paid days:
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
        initialForecast={initialForecast}
        initialForecastBbox={initialBbox}
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
