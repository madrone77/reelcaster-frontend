import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchHierarchy, fetchMapSpots, fetchSpotLivePage } from "@/lib/bluecaster";
import { breadcrumbJsonLd, DEFAULT_OG, SITE_URL, siteUrl } from "@/lib/site";
import { findCityForSpot } from "@/app/fishing/lib/fishing-data";
import { provinceCodeFromName } from "@/lib/regions";
import SpotDetailShell, { type SpotPageForClient } from "./spot-detail-shell";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";
import { spotHasFreshReports } from "@/app/explore/lib/fresh-catch-types";

/** Catch-report window. Must match FRESH_DAYS in the fresh-catches route. */
const FRESH_DAYS = 21;

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Drop the fields that must never cross into the client bundle.
 *
 * `catchSignals` carries verbatim third-party forum text and per-report detail;
 * `intelVerdict` is paid information. Everything handed to a client component
 * is serialized into the page for anyone to read, so the strip happens here.
 * The `void`s are the lint-visible way of saying "destructured to discard".
 */
function stripPaidIntel(raw: SpotPageInitial): SpotPageForClient {
  const { catchSignals, intelVerdict, ...rest } = raw;
  void catchSignals;
  void intelVerdict;
  return rest;
}

// Same extent /explore and the sitemap use (BC + WA + OR).
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

// Google renders roughly 60 characters of a <title> before truncating with an
// ellipsis. The root layout appends " | ReelCaster", so a page's own title has
// that much less to work with.
const TITLE_BUDGET = 60;
const BRAND_SUFFIX_LENGTH = " | ReelCaster".length;

// Google renders roughly 160 characters of a meta description before
// truncating. `seoIntro` is a full multi-paragraph spot write-up — around 1000
// characters on these pages — so passing it through verbatim shipped a snippet
// that got cut mid-sentence in the SERP and buried the spot's opening claim.
//
// The <h1>, the page body, and the Place JSON-LD all still carry the full
// prose; only the snippet is budgeted.
const DESCRIPTION_BUDGET = 160;

/**
 * Trim `text` to the snippet budget on a sentence boundary.
 *
 * Prefers ending on the last sentence that fits, so the snippet reads as a
 * complete thought. Falls back to a word boundary with an ellipsis when the
 * first sentence alone is already over budget.
 */
function snippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= DESCRIPTION_BUDGET) return clean;

  const sentenceEnd = clean.lastIndexOf(". ", DESCRIPTION_BUDGET);
  if (sentenceEnd > 0) return clean.slice(0, sentenceEnd + 1);

  const wordEnd = clean.lastIndexOf(" ", DESCRIPTION_BUDGET - 1);
  return `${clean.slice(0, wordEnd > 0 ? wordEnd : DESCRIPTION_BUDGET - 1)}…`;
}

// Prerender the published spots. On-demand rendering makes Next stream
// metadata, which lands <title> and the canonical at the end of the body
// instead of in <head>; prerendering resolves them before the first byte.
// Custom and newly-published spots still render on demand and then cache.
export async function generateStaticParams() {
  try {
    const payload = await fetchMapSpots({ bbox: COVERED_BBOX_ALL });
    return (payload?.spots ?? [])
      .filter((s) => s.slug)
      .map((s) => ({ slug: s.slug }));
  } catch {
    // Upstream down at build time — fall back to pure on-demand rendering
    // rather than failing the build.
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchSpotLivePage(slug).catch(() => null);

  // No server-side read means either "private custom spot" or "gone", and the
  // anonymous render can't tell which — see the page body for why both now
  // resolve to a real 404 instead of a 200 shell.
  //
  // Bail here rather than only in the body: metadata resolves before the body
  // streams, so bailing late can flush a 200 with 404 UI underneath it — the
  // exact soft-404 this change exists to remove. Same reason the province page
  // 404s from its generateMetadata.
  if (!page) notFound();


  const name = page.spot.name;
  // "Constance Bank Fishing · Victoria, BC" — the postal code keeps the common
  // case inside the ~60 characters Google renders before truncating, which the
  // old "· Victoria, British Columbia" form blew past on a third of these.
  const region = page.spot.region ? provinceCodeFromName(page.spot.region) : null;
  const where = [page.spot.city, region].filter(Boolean).join(", ");
  const compose = (spotName: string) =>
    `${spotName} Fishing${where ? ` · ${where}` : ""}`;

  // A handful of spots carry a parenthetical disambiguator — "Howe Sound (Pam
  // Rock / Worlcombe Island Area)" — long enough to push the title past the
  // budget on its own. Drop it only when the full form doesn't fit, so precise
  // names keep their qualifier and only the overlong ones get trimmed. The <h1>
  // and OG title always keep the full name.
  const full = compose(name);
  const title =
    full.length + BRAND_SUFFIX_LENGTH <= TITLE_BUDGET
      ? full
      : compose(name.replace(/\s*\([^)]*\)/g, ""));
  const description = page.spot.seoIntro
    ? snippet(page.spot.seoIntro)
    : `Live fishing forecast, conditions, and 14-day outlook for ${name}.`;

  return {
    // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
    title,
    description,
    alternates: { canonical: siteUrl(`/explore/spot/${slug}`) },
    openGraph: {
      title: `${title} | ReelCaster`,
      description,
      url: siteUrl(`/explore/spot/${slug}`),
      // A spot page is a place, not a piece of writing — `article` invited
      // article-shaped expectations (author, published date) it never meets.
      type: "website",
      ...DEFAULT_OG,
    },
    robots: { index: true, follow: true },
  };
}

export default async function SpotDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchSpotLivePage(slug);

  // No server-side read doesn't mean "gone". A PRIVATE custom spot is 404 to
  // the anonymous server render even for its owner, whose session lives in the
  // browser as a Bearer token.
  //
  // Serving that case as a 200 made every unknown slug a soft 404: an
  // unpublished or deleted spot kept answering 200 forever, so Search Console
  // reported the whole route as soft-404 and stale URLs never left the index.
  // notFound() sends a real 404 and renders this segment's not-found.tsx —
  // which still hands off to OwnerSpotFallback, so an owner recovers their
  // private spot client-side. The status is honest for crawlers either way,
  // because no crawler carries the token that would turn it into a hit.
  if (!page) notFound();
  // Scraped catch reports. The raw `catchSignals` carry verbatim third-party
  // forum text and per-report detail — neither may reach the browser, and this
  // page is prerendered, so everything below the paywall is stripped here and
  // only a boolean survives. A Pro viewer's numbers are fetched client-side
  // from the gated route; keeping the static render locked is what lets this
  // page stay prerendered for search.
  const freshTracked = spotHasFreshReports(page.catchSignals, FRESH_DAYS);
  const pageForClient = stripPaidIntel(page);

  // Where this spot sits in the public directory, so the page can link back up
  // to its city and province. Null for custom spots and unpublished cities.
  const place = findCityForSpot(await fetchHierarchy().catch(() => null), slug);

  const crumbs = place
    ? breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: `Fishing in ${place.city.provinceName}`, path: place.provincePath },
        { name: place.city.name, path: place.cityPath },
        { name: page.spot.name, path: `/explore/spot/${slug}` },
      ])
    : null;

  // Place + geo. `containedInPlace` ties the spot to its city so the three
  // surfaces read as one hierarchy rather than three unrelated pages.
  const spotJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": siteUrl(`/explore/spot/${slug}#place`),
    name: page.spot.name,
    url: siteUrl(`/explore/spot/${slug}`),
    ...(page.spot.seoIntro ? { description: page.spot.seoIntro } : {}),
    geo: {
      "@type": "GeoCoordinates",
      latitude: page.spot.lat,
      longitude: page.spot.lng,
    },
    ...(page.spot.city || page.spot.region
      ? {
          address: {
            "@type": "PostalAddress",
            ...(page.spot.city ? { addressLocality: page.spot.city } : {}),
            ...(page.spot.region ? { addressRegion: page.spot.region } : {}),
            ...(page.spot.country ? { addressCountry: page.spot.country } : {}),
          },
        }
      : {}),
    ...(place
      ? {
          containedInPlace: {
            "@type": "City",
            name: place.city.name,
            url: siteUrl(place.cityPath),
          },
        }
      : {}),
    isAccessibleForFree: true,
    publicAccess: true,
    provider: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <>
      {crumbs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(spotJsonLd) }}
      />
      <SpotDetailShell
        page={pageForClient}
        freshTracked={freshTracked}
        slug={slug}
        // Narrowed to the four strings the breadcrumb needs — `place.city`
        // carries the city's whole spot roster, which has no business crossing
        // the server/client boundary on every spot page.
        cityLink={
          place
            ? {
                cityName: place.city.name,
                cityPath: place.cityPath,
                provinceName: place.city.provinceName,
                provincePath: place.provincePath,
              }
            : null
        }
      />
    </>
  );
}
