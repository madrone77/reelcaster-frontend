import { fetchCityGuides, fetchHierarchy, fetchMapSpots } from "@/lib/bluecaster";

import { siteUrl } from "@/lib/site";
import {
  getFishingCountries,
  locationOf,
} from "./fishing/lib/fishing-data";
import { guidePath } from "@/lib/paths";

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
//
// This is injected by next.config.ts and inlined at compile time. It must not
// become `new Date()` here: this route is dynamic, so module scope runs on every
// serverless cold start, and the timestamp would drift forward on its own — the
// same "always says now" signal scoredLastModified() exists to avoid. The
// fallback only applies in environments that skip the Next build (unit tests).
const BUILD_TIME = process.env.BUILD_TIMESTAMP
  ? new Date(process.env.BUILD_TIMESTAMP)
  : new Date();

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
  // Licence guide. Static content whose figures are hand-verified against DFO
  // and gov.bc.ca, so BUILD_TIME is an honest lastmod: the copy genuinely can
  // only change on a deploy. Yearly is the real cadence (fees reset April 1),
  // but monthly leaves room for the mid-year rule changes that do happen —
  // the 2026 move of freshwater licensing into WILD being the example.
  {
    url: siteUrl("/fishing-licence/bc"),
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: siteUrl("/fishing-licence/wa"),
    changeFrequency: "monthly",
    priority: 0.7,
  },
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
  // `payload` is read for its scoring day alone now; the URL list is the
  // hierarchy's, because only the hierarchy knows a spot's home city.
  const [hierarchy, payload] = await Promise.all([
    fetchHierarchy().catch(() => null),
    fetchMapSpots({ bbox: COVERED_BBOX_ALL }).catch(() => null),
  ]);

  const scoredAt = scoredLastModified(payload?.date);

  // The directory, walked once from the same lifecycle-gated tree the pages
  // render, so the sitemap cannot drift from what actually resolves.
  //
  // Every URL here is a DESTINATION. The retired /fishing/<province>/... and
  // /explore/spot/<slug> URLs 308 to these, and a sitemap that lists a
  // redirect source is asking a crawler to discover the redirect it is already
  // being told about, on every fetch.
  //
  // `payload` is still read, but only for its scoring day: the spot list now
  // comes from the hierarchy, which is the only source that knows a spot's
  // home city and therefore its URL. That also removes the old orphan problem
  // for free, since the tree only contains spots a crawler could reach by
  // walking the site.
  for (const country of getFishingCountries(hierarchy)) {
    entries.push({
      url: siteUrl(`/fishing/${country.code.toLowerCase()}`),
      lastModified: scoredAt,
      changeFrequency: "weekly",
      priority: 0.7,
    });

    for (const province of country.provinces) {
      entries.push({
        url: siteUrl(province.path),
        lastModified: scoredAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });

      for (const city of province.cities) {
        entries.push({
          url: siteUrl(city.path),
          lastModified: scoredAt,
          changeFrequency: "daily",
          priority: 0.8,
        });

        // Only published guides for species that still have spots behind them
        // come back, so this matches the links the city page renders.
        const guides = await fetchCityGuides(city.slug);
        for (const guide of guides?.guides ?? []) {
          entries.push({
            url: siteUrl(guidePath(locationOf(city), guide.species_slug)),
            // The prose is stable; the regulation block and the per-spot
            // scores move with the scoring day, same as the city page.
            lastModified: scoredAt,
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }

        // `city.spots` is already the spots this city is the HOME of, so a
        // shared spot is listed once, under the one URL that serves it. The
        // other city paths 308 here and belong in no sitemap.
        for (const spot of city.spots) {
          entries.push({
            url: siteUrl(spot.path),
            lastModified: scoredAt,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      }
    }
  }

  return entries;
}
