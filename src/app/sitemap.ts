import { fetchSpeciesList } from "@/lib/bluecaster";

const SITE = "https://reelcaster.com";

export default async function sitemap() {
  const species = await fetchSpeciesList({ limit: 200 });

  // Static + index entries
  const staticEntries = [
    { url: `${SITE}/`, changeFrequency: "weekly" as const, priority: 1.0 },
    { url: `${SITE}/species`, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${SITE}/regulations`, changeFrequency: "daily" as const, priority: 0.6 },
    { url: `${SITE}/pricing`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/about`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/faq`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "monthly" as const, priority: 0.4 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  const speciesEntries = species.map((s) => ({
    url: `${SITE}/species/${s.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...speciesEntries];
}
