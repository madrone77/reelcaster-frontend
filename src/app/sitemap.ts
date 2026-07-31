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
// Static pages get the build time, which is the last moment their copy could
// have changed.
const BUILD_TIME = new Date();

/**
 * The scoring day the current map payload describes, as the `lastModified` for
 * every scored surface.
 *
 * This used to be `new Date()` evaluated per request, which told Google that
 * all 87 scored URLs changed in the same instant it asked — on every single
 * fetch. Google detects a `lastmod` that always says "just now" and then
 * discounts the whole file, so the pages that genuinely did change lost the
 * recrawl signal along with the ones that didn't.
 *
 * `payload.date` is the local scoring day (YYYY-MM-DD, America/Vancouver). It
 * is stable within a day and advances exactly when the scores behind these
 * pages do, which is the claim the field is supposed to make.
 */
function scoredLastModified(date: string | undefined): Date {
  if (!date) return BUILD_TIME;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? BUILD_TIME : parsed;
}

// `/explore` is deliberately absent: it renders as a client-side map, so a
// crawler only ever sees "Loading map…". It is noindex for the same reason
// (see src/app/explore/page.tsx) and a noindex URL has no business in a
// sitemap — the file is a list of pages we want indexed.
const STATIC_ENTRIES: Omit<SitemapEntry, "lastModified">[] = [
  { url: siteUrl("/"), changeFrequency: "weekly", priority: 1.0 },
  // /pricing 308s to /plans (see next.config.ts) — a sitemap must list the
  // destination, never the redirect.
  { url: siteUrl("/plans"), changeFrequency: "monthly", priority: 0.6 },
  { url: siteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
  { url: siteUrl("/faq"), changeFrequency: "monthly", priority: 0.5 },
  { url: siteUrl("/contact"), changeFrequency: "monthly", priority: 0.4 },
  { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
  { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = STATIC_ENTRIES.map((e) => ({
    ...e,
    lastModified: BUILD_TIME,
  }));

  // A sitemap must never 500, so both reads degrade to null rather than throw.
  const [hierarchy, payload] = await Promise.all([
    fetchHierarchy().catch(() => null),
    fetchMapSpots({ bbox: COVERED_BBOX_ALL }).catch(() => null),
  ]);

  const scoredAt = scoredLastModified(payload?.date);

  // Every spot slug reachable from a published city page. The hierarchy is the
  // lifecycle gate — it carries only published cities, each with the exact
  // spot links its page renders — so this set is precisely the internal link
  // graph a crawler can walk.
  const linkedSpotSlugs = new Set<string>();

  // /fishing directory — province indexes + city explorers, derived from the
  // same lifecycle-gated hierarchy those pages render, so the sitemap can't
  // drift from what actually resolves.
  if (hierarchy) {
    for (const code of COVERED_PROVINCES) {
      const province = getFishingProvince(hierarchy, code);
      if (!province || province.cities.length === 0) continue;
      const provPath = `/fishing/${code.toLowerCase()}`;
      entries.push({
        url: siteUrl(provPath),
        lastModified: scoredAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const city of province.cities) {
        entries.push({
          url: siteUrl(`${provPath}/${city.slug}`),
          lastModified: scoredAt,
          changeFrequency: "daily",
          priority: 0.8,
        });
        for (const spot of city.spots) {
          if (spot.slug) linkedSpotSlugs.add(spot.slug);
        }
      }
    }
  }

  // Spot pages are the content-rich indexable surface (/explore/spot/[slug]
  // sets robots index:true + a canonical).
  //
  // The map payload is bbox-scoped, not lifecycle-gated, so on its own it also
  // returns spots in cities that aren't published yet. Those pages render, but
  // no city page links them and findCityForSpot() gives them no breadcrumb —
  // they were seven orphans in the sitemap, which is exactly the "indexable,
  // linked from nowhere" shape that reads as low value. Intersecting with the
  // link graph keeps the sitemap to spots a crawler could also reach by
  // walking the site.
  //
  // If the hierarchy read failed we have no link graph to intersect with, so
  // fall back to the full payload: stale orphans beat an empty sitemap.
  for (const spot of payload?.spots ?? []) {
    if (!spot.slug) continue;
    if (hierarchy && !linkedSpotSlugs.has(spot.slug)) continue;
    entries.push({
      url: siteUrl(`/explore/spot/${spot.slug}`),
      lastModified: scoredAt,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  return entries;
}
