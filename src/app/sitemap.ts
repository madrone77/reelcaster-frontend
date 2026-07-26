import { fetchHierarchy, fetchMapSpots } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { siteUrl } from "@/lib/site";
import { getFishingProvince } from "./fishing/lib/fishing-data";

// Same extent /explore fetches (BC + WA + OR) — keeps the sitemap's spot
// list identical to what the explore surface actually renders.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
};

// `lastModified` is the only one of the three optional fields Google actually
// consumes — it drives recrawl scheduling. `changeFrequency`/`priority` are
// ignored by Google but still read by Bing, so they stay.
//
// Scored surfaces genuinely change on every scoring run, so "now" is honest for
// them. Static pages get the build time, which is the last moment their copy
// could have changed.
const BUILD_TIME = new Date();

const STATIC_ENTRIES: Omit<SitemapEntry, "lastModified">[] = [
  { url: siteUrl("/"), changeFrequency: "weekly", priority: 1.0 },
  { url: siteUrl("/explore"), changeFrequency: "daily", priority: 0.9 },
  { url: siteUrl("/pricing"), changeFrequency: "monthly", priority: 0.5 },
  { url: siteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
  { url: siteUrl("/faq"), changeFrequency: "monthly", priority: 0.5 },
  { url: siteUrl("/contact"), changeFrequency: "monthly", priority: 0.4 },
  { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
  { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const now = new Date();
  const entries: SitemapEntry[] = STATIC_ENTRIES.map((e) => ({
    ...e,
    lastModified: BUILD_TIME,
  }));

  // /fishing directory — province indexes + city explorers, derived from
  // the same lifecycle-gated hierarchy those pages render, so the sitemap
  // can't drift from what actually resolves.
  try {
    const hierarchy = await fetchHierarchy();
    for (const code of COVERED_PROVINCES) {
      const province = getFishingProvince(hierarchy, code);
      if (!province || province.cities.length === 0) continue;
      const provPath = `/fishing/${code.toLowerCase()}`;
      entries.push({
        url: siteUrl(provPath),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const city of province.cities) {
        entries.push({
          url: siteUrl(`${provPath}/${city.slug}`),
          lastModified: now,
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
        url: siteUrl(`/explore/spot/${spot.slug}`),
        lastModified: now,
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
