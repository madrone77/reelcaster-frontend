import type { Metadata } from "next";
import { fetchHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import ExploreCanvas, { type ExploreSpot, type ExploreProvince } from "./explore-canvas";

const SITE_URL = "https://reelcaster.com";

export const metadata: Metadata = {
  title: "Explore | ReelCaster",
  description:
    "Interactive fishing canvas — browse covered spots in BC, WA, and OR. Open any pin for live conditions and the RC score breakdown.",
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    title: "Explore | ReelCaster",
    description:
      "Interactive fishing canvas — browse covered spots and see live RC scores.",
    url: `${SITE_URL}/explore`,
    siteName: "ReelCaster",
    type: "website",
    locale: "en_CA",
  },
  robots: { index: true, follow: true },
};

export default async function ExplorePage() {
  const hierarchy = await fetchHierarchy();

  const provinces: ExploreProvince[] = [];
  const spots: ExploreSpot[] = [];

  if (hierarchy) {
    for (const country of hierarchy.countries) {
      for (const sp of country.states_provinces) {
        const isCovered = COVERED_PROVINCES.includes(sp.code as "BC" | "WA" | "OR");
        provinces.push({
          code: sp.code,
          name: sp.name,
          country_code: country.code,
          is_covered: isCovered,
        });
        if (!isCovered) continue;

        for (const region of sp.regions) {
          for (const city of region.cities) {
            for (const spot of city.spots) {
              if (!spot.is_published) continue;
              spots.push({
                id: spot.id,
                slug: spot.slug,
                name: spot.name,
                lat: spot.lat,
                lng: spot.lng,
                city_slug: city.slug,
                city_name: city.name,
                province_code: sp.code,
                region_slug: region.slug,
              });
            }
          }
        }
      }
    }
  }

  return <ExploreCanvas spots={spots} provinces={provinces} />;
}
