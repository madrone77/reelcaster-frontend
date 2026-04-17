import { fetchPublishedCities } from "@/lib/bluecaster";

export default async function sitemap() {
  const pages = await fetchPublishedCities();
  return pages.map((p: { slug: string; published_at?: string; created_at?: string }) => ({
    url: `https://reelcaster.com/fishing/bc/${p.slug}`,
    lastModified: p.published_at ?? p.created_at,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}
