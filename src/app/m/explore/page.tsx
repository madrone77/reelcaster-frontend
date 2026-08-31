import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { renderExplore } from "@/app/explore/explore-route";

/**
 * /m/explore — Explore behind the paid-marketing frame.
 *
 * Ads point at /lp/<n> and its CTA carries people through to here with the
 * whole map open. When the click count says they are actually using it they
 * are asked, once, to create a free account; if they decline, the depth layers
 * go and the map keeps a visible way back. See @/lib/preview-gate for why
 * depth is the only thing at stake, and src/app/explore/explore-route.tsx for
 * why this is a mode rather than a copy.
 *
 * `noindex` with a canonical pointing at /explore. A marketing surface that can
 * strip itself is the last page that should be answering a search, and the two
 * routes render the same map, so search has exactly one place to send people.
 */
export const metadata: Metadata = {
  title: "Explore the Fishing Map",
  description:
    "Interactive fishing map: browse covered spots on the BC and Washington coasts with live scores, conditions, and the day's best windows.",
  alternates: { canonical: `${SITE_URL}/explore` },
  robots: { index: false, follow: false },
};

export default async function MarketingExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderExplore({ searchParams, marketing: true });
}
