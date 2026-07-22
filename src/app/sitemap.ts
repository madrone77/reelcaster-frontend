import { fetchHierarchy, fetchMapSpots } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvince } from "./fishing/lib/fishing-data";

const SITE = "https://reelcaster.com";

// Same extent /explore fetches (BC + WA + OR) — keeps the sitemap's spot
// list identical to what the explore surface actually renders.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

type SitemapEntry = {
  url: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
};

const STATIC_ENTRIES: SitemapEntry[] = [
  { url: `${SITE}/`, changeFrequency: "weekly", priority: 1.0 },
  { url: `${SITE}/explore`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE}/pricing`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE}/faq`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE}/contact`, changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const entries = [...STATIC_ENTRIES];

  // /fishing directory — province indexes + city explorers, derived from
  // the same lifecycle-gated hierarchy those pages render, so the sitemap
  // can't drift from what actually resolves.
  try {
    const hierarchy = await fetchHierarchy();
    for (const code of COVERED_PROVINCES) {
      const province = getFishingProvince(hierarchy, code);
      if (!province || province.cities.length === 0) continue;
      const provPath = `${SITE}/fishing/${code.toLowerCase()}`;
      entries.push({ url: provPath, changeFrequency: "weekly", priority: 0.8 });
      for (const city of province.cities) {
        entries.push({
          url: `${provPath}/${city.slug}`,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
    }
  } catch {
    // Directory entries are additive — static + spot entries still serve.
  }

  // Spot pages are the content-rich indexable surface (/explore/spot/[slug]
  // sets robots index:true + a canonical). Sourced from the same map-spots
  // payload /explore renders from; on any failure fall back to the static
  // list — a sitemap must never 500.
  try {
    const payload = await fetchMapSpots({ bbox: COVERED_BBOX_ALL });
    for (const spot of payload?.spots ?? []) {
      if (!spot.slug) continue;
      entries.push({
        url: `${SITE}/explore/spot/${spot.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // fetchMapSpots already swallows most failures (returns null); this
    // guard keeps the sitemap serving the static set no matter what.
  }

  return entries;
}
