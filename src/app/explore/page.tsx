import type { Metadata } from "next";
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import { renderExplore } from "./explore-route";

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  // Spelling it out here rendered "Explore | ReelCaster | ReelCaster".
  title: "Explore the Fishing Map",
  description:
    "Interactive fishing map: browse covered spots on the BC and Washington coasts with live scores, conditions, and the day's best windows.",
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    // The card is a different channel from the SERP. Search wants the page
    // described; a person glancing at a link in a text thread wants a reason to
    // tap. The `description` above keeps the search wording, this replaces only
    // what a share preview renders.
    title: "See where the fish are biting today",
    description:
      "Every fishing spot on the BC and Washington coasts, scored hour by hour on tides, weather, water conditions, and regulations. Pick your spot, then your window.",
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
  // The product's own map: never the marketing frame, so a decline can never
  // strip THIS route for a visitor who simply found it through search.
  // A visitor who declined on /m/explore does lose depth here too — that is the
  // gate following the browser rather than the route — but the ask itself only
  // ever happens on /m/explore.
  return renderExplore({ searchParams, marketing: false });
}
