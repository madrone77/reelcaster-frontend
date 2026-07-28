import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import { fetchHierarchy, fetchMapSpots } from "@/lib/bluecaster";
import { buildExploreData } from "./lib/explore-data";
import ExploreShell from "./explore-shell";


// Covers BC + WA + OR — the same extent the old province pills spanned.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  // Spelling it out here rendered "Explore | ReelCaster | ReelCaster".
  title: "Explore the Fishing Map",
  description:
    "Interactive fishing map — browse covered spots in BC, WA, and OR with live scores, conditions, and the day's best windows.",
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    title: "Explore the Fishing Map | ReelCaster",
    description:
      "Interactive fishing map — browse covered spots and see live RC scores.",
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
  const [hierarchy, payload] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ bbox: COVERED_BBOX_ALL }),
  ]);

  const data = buildExploreData(hierarchy, payload);

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
      <ExploreShell data={data} bbox={COVERED_BBOX_ALL} />
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
