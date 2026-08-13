import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import {
  fetchHierarchyLight,
  fetchMapForecast14d,
  fetchMapSpots,
} from "@/lib/bluecaster";
import {
  stripViewportForecast,
  visibleForecastDays,
} from "@/lib/forecast-horizon";
import {
  buildExploreData,
  hasPreferredDefaultCity,
  PREFERRED_DEFAULT_CITY,
} from "./lib/explore-data";
import { openingBbox } from "./lib/viewport-bbox";
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

export default async function ExplorePage() {
  const hierarchy = await fetchHierarchyLight();

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
  const payload = hasPreferredDefaultCity(hierarchy)
    ? await fetchMapSpots({ city: PREFERRED_DEFAULT_CITY })
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
  // `openingBbox` is the same key the shell seeds itself with at mount, so the
  // client finds this payload already in hand instead of refetching it.
  //
  // Stripped to the ANONYMOUS horizon before it goes into the HTML. This page
  // is statically rendered and shared by every visitor, so it has no session to
  // read and no business carrying paid days: putting all 14 in the markup is
  // precisely the leak `resolveEntitlement` was written to close. The shell
  // renders days past this horizon as pending rather than locked until the
  // client learns the real tier — nothing is promised and nothing is withheld
  // on a guess.
  const initialBbox = openingBbox(data.spots, data.defaultCitySlug);
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
  // The indexable content lives on /fishing/[province]/[city] and
  // /explore/spot/[slug], both of which prerender fully; this route is the
  // interactive map app.
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreShell
        data={data}
        bbox={COVERED_BBOX_ALL}
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
