import type { MetadataRoute } from "next";
import { fetchHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvince } from "./fishing/lib/fishing-data";

const SITE = "https://reelcaster.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/pricing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // /fishing directory — province indexes, city explorers, and every
  // published spot page, derived from the same hierarchy those pages render
  // so the sitemap can't drift from what actually resolves. API down →
  // static entries only.
  const fishingEntries: MetadataRoute.Sitemap = [];
  const hierarchy = await fetchHierarchy();
  for (const code of COVERED_PROVINCES) {
    const province = getFishingProvince(hierarchy, code);
    if (!province || province.cities.length === 0) continue;
    const provPath = `${SITE}/fishing/${code.toLowerCase()}`;
    fishingEntries.push({
      url: provPath,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const city of province.cities) {
      fishingEntries.push({
        url: `${provPath}/${city.slug}`,
        changeFrequency: "daily",
        priority: 0.8,
      });
      for (const spot of city.spots) {
        fishingEntries.push({
          url: `${SITE}/explore/spot/${spot.slug}`,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
  }

  return [...staticEntries, ...fishingEntries];
}
