import { fetchPublishedCities, fetchPublishedSpots } from "@/lib/bluecaster";

export default async function sitemap() {
  const [cities, spots] = await Promise.all([
    fetchPublishedCities(),
    fetchPublishedSpots(),
  ]);

  const cityEntries = cities.map(
    (p: { slug: string; published_at?: string; created_at?: string }) => ({
      url: `https://reelcaster.com/fishing/bc/${p.slug}`,
      lastModified: p.published_at ?? p.created_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  );

  const spotEntries = spots.map((s) => ({
    url: `https://reelcaster.com/fishing/${s.province_code}/${s.city_slug}/${s.slug}`,
    lastModified: s.published_at ?? undefined,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [...cityEntries, ...spotEntries];
}
