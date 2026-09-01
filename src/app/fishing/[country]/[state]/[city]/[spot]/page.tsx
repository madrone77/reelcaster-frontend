import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { fetchHierarchy, fetchSpotLivePage } from "@/lib/bluecaster";
import { breadcrumbJsonLd, SITE_URL, siteUrl } from "@/lib/site";
import { provinceCodeFromName } from "@/lib/regions";
import SpotDetailShell from "./spot-detail-shell";
import { loadSpotPage } from "./load-spot-page";
import {
  findCityForSpot,
  getFishingCountries,
} from "@/app/fishing/lib/fishing-data";
import { spotPath } from "@/lib/paths";

// `spot` is the DIRECTORY name, so it is the param Next fills. Destructured
// as `slug` below because that is what the spot payload calls it, and because
// getting these two out of step is invisible to the typechecker: the param
// would simply arrive undefined at runtime.
type PageProps = {
  params: Promise<{
    country: string;
    state: string;
    city: string;
    spot: string;
  }>;
};





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

// The card title is a question, so it has to survive a long spot name without
// running past what Facebook and iMessage render.
const OG_TITLE_BUDGET = 65;

/** ["A", "B", "C"] -> "A, B and C" */
function listSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Card-length species label, e.g. "Chinook Salmon" -> "Chinook".
 *
 * Only the trailing "Salmon" comes off. "Crab" stays, unlike the catch form's
 * pill label: a pill sits under a heading that already says crab, while a share
 * card is read cold by people who would not recognise "Dungeness" alone.
 */
function cardSpeciesName(name: string): string {
  return name.replace(/\s+Salmon$/i, "");
}

/**
 * Trim `text` to the snippet budget on a sentence boundary.
 *
 * Prefers ending on the last sentence that fits, so the snippet reads as a
 * complete thought. Falls back to a word boundary with an ellipsis when the
 * first sentence alone is already over budget.
 *
 * Only the SERP description uses this now. The share card took a widened
 * budget for a while so its text would stop cutting mid-phrase; it no longer
 * derives from `seoIntro` at all, so the budget went with it.
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
    // The hierarchy, not the map payload. A spot's path needs its home city,
    // and /map/spots is bbox-scoped with no place chain on it: it can say a
    // spot exists but not where its URL goes. Walking the lifecycle-gated tree
    // also means only spots that HAVE a public home are prerendered, which is
    // the same set the sitemap lists.
    const countries = getFishingCountries(await fetchHierarchy());
    return countries.flatMap((country) =>
      country.provinces.flatMap((province) =>
        province.cities.flatMap((city) =>
          city.spots.map((spot) => ({
            country: country.code.toLowerCase(),
            state: province.code.toLowerCase(),
            city: city.urlSlug,
            spot: spot.slug,
          })),
        ),
      ),
    );
  } catch {
    // Upstream down at build time — fall back to pure on-demand rendering
    // rather than failing the build.
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { spot: slug } = await params;
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

  // The canonical has to be the spot's HOME path, never the path that was
  // requested. This route accepts any city segment, so echoing the request
  // back would have every duplicate URL declare itself canonical, which is
  // precisely the self-certifying duplicate the tag exists to prevent.
  const place = findCityForSpot(await fetchHierarchy().catch(() => null), slug);
  // No public home means no public page here; the body 404s for the same
  // reason and metadata must agree, or the 404 ships under a 200.
  if (!place) notFound();

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
  const fallbackDescription = `Live fishing forecast, conditions, and 14-day outlook for ${name}.`;
  const description = page.spot.seoIntro
    ? snippet(page.spot.seoIntro)
    : fallbackDescription;
  // The share card deliberately does NOT reuse the SEO prose. The intro
  // describes the place ("mixed bottom in 15 to 65 feet"), which is what a
  // search result should say and the least persuasive thing to put in front of
  // someone deciding whether to tap a link a friend sent them.
  //
  // Everything here is evergreen on purpose. Facebook caches a scrape per URL
  // and does not re-poll, so today's score would freeze at whatever it was the
  // first time anyone shared the page. A stale 90 on a blown-out day is worse
  // than no number at all.
  const roster = page.species.slice(0, 4).map((s) => cardSpeciesName(s.name));
  const ogDescription = roster.length
    ? `${listSentence(roster)}, scored hour by hour on tides, weather, water conditions, and regulations. Know before you go.`
    : "Scored hour by hour on tides, weather, water conditions, and regulations. Know the bite before you go.";

  // Strip the parenthetical qualifier only when the full name blows the budget,
  // same rule the <title> uses.
  const askable = `Is ${name} worth fishing today?`.length <= OG_TITLE_BUDGET
    ? name
    : name.replace(/\s*\([^)]*\)/g, "");
  const ogTitle = `Is ${askable} worth fishing today?`;

  return {
    // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
    title,
    description,
    alternates: { canonical: siteUrl(place.spot.path) },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      // A page declaring its own `openGraph` block replaces the inherited one
      // rather than merging into it, so without this the card loses the site
      // label and Facebook falls back to printing the bare domain.
      siteName: "ReelCaster",
      url: siteUrl(place.spot.path),
      // A spot page is a place, not a piece of writing — `article` invited
      // article-shaped expectations (author, published date) it never meets.
      type: "website",
      // No `images` here on purpose. This route has its own
      // `opengraph-image.tsx`, and an explicit `images` entry in metadata beats
      // the file convention, so spreading DEFAULT_OG would pin every spot back
      // to the one site-wide card this route exists to replace.
    },
    robots: { index: true, follow: true },
  };
}

export default async function SpotDetailPage({ params }: PageProps) {
  const { country, state, city, spot: slug } = await params;
  // Shared with the ad frame at ./ad — see ad-mode.ts. Both renderers load
  // through one function so a gate can never be applied to only one of them.
  const { page, freshTracked, cityLink, canonicalPath, tz, serverNowMs } =
    await loadSpotPage(slug);

  // A spot has exactly ONE home city, so every other city that reaches this
  // route is a second URL for the same page. Nothing links those, but a
  // four-segment dynamic route accepts any combination somebody types or a
  // scraper invents, and left alone that is 274 spots times 20 cities of
  // duplicate content. Redirect rather than 404: the wrong city in the path is
  // usually a stale link or a hand edit, and the right page exists.
  if (!canonicalPath) notFound();
  const requested = spotPath(
    { countryCode: country, stateCode: state, cityUrlSlug: city },
    slug,
  );
  if (requested !== canonicalPath) permanentRedirect(canonicalPath);
  const place = cityLink;

  const crumbs = place
    ? breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: `Fishing in ${place.provinceName}`, path: place.provincePath },
        { name: place.cityName, path: place.cityPath },
        { name: page.spot.name, path: canonicalPath },
      ])
    : null;

  // Place + geo. `containedInPlace` ties the spot to its city so the three
  // surfaces read as one hierarchy rather than three unrelated pages.
  const spotJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": siteUrl(`${canonicalPath}#place`),
    name: page.spot.name,
    url: siteUrl(canonicalPath),
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
            name: place.cityName,
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
        page={page}
        freshTracked={freshTracked}
        slug={slug}
        tz={tz}
        serverNowMs={serverNowMs}
        cityLink={cityLink}
      />
    </>
  );
}
