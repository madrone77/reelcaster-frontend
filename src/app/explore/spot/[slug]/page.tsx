import type { Metadata } from "next";
import { fetchHierarchy, fetchMapSpots, fetchSpotLivePage } from "@/lib/bluecaster";
import { breadcrumbJsonLd, DEFAULT_OG, SITE_URL, siteUrl } from "@/lib/site";
import { findCityForSpot } from "@/app/fishing/lib/fishing-data";
import SpotDetailShell from "./spot-detail-shell";
import OwnerSpotFallback from "./owner-spot-fallback";

type PageProps = { params: Promise<{ slug: string }> };

// Same extent /explore and the sitemap use (BC + WA + OR).
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

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

  // No server-side read means either "private custom spot" or "gone" — the
  // anonymous render can't tell which. Either way this response is the
  // OwnerSpotFallback shell, which has no public content, so keep it out of
  // the index rather than letting a generic title get crawled.
  if (!page) {
    return { title: "Spot", robots: { index: false, follow: false } };
  }

  const name = page.spot.name;
  const where = [page.spot.city, page.spot.region].filter(Boolean).join(", ");
  const title = `${name}${where ? ` · ${where}` : ""}`;
  const description =
    page.spot.seoIntro ??
    `Live fishing forecast, conditions, and 14-day outlook for ${name}.`;

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
  // browser as a Bearer token. Hand off to the client, which can prove who it
  // is; a genuine miss renders "not found" there.
  if (!page) return <OwnerSpotFallback slug={slug} />;

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
        page={page}
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
