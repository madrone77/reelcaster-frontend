// JSON-LD for the live-spot route, synthesized from the LiveSpot payload +
// URL params. Replaces the previous SpotJsonLd, which read from the thin
// /api/v1/spots/<slug>/page response — that meant SSR had to fetch BOTH the
// thin /page endpoint AND the heavy /spot-page endpoint just to render
// structured data. Killing the redundant fetch saves a full BlueCaster
// roundtrip per SSR.
//
// Trade-off: we lose the FAQPage schema (FAQ content lives on /page, not
// on /spot-page) and the per-article published/modified dates (also /page-
// only). Breadcrumb, Place, and Article remain — those are the structured
// types Google actually surfaces on a spot SERP. If the FAQ schema becomes
// load-bearing for an SEO ask, the right move is to add it to the live
// payload, not to bring back the second fetch.

import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";

const SITE_URL = "https://reelcaster.com";

export default function LiveSpotJsonLd({
  data,
  provinceCode,
  citySlug,
}: {
  data: SpotPageInitial;
  provinceCode: string;
  citySlug: string;
}) {
  const { spot } = data;
  const provCodeLower = provinceCode.toLowerCase();
  const url = `${SITE_URL}/fishing/${provCodeLower}/${citySlug}/${spot.slug}`;

  const description =
    spot.seoIntro?.trim() ||
    `Live fishing forecast, conditions, and seasonal patterns for ${spot.name}${
      spot.city ? ` near ${spot.city}` : ""
    }.`;
  const headline = `Fishing ${spot.name}${spot.city ? ` near ${spot.city}` : ""} | ReelCaster`;

  // Walk the geo hierarchy → breadcrumb. We synthesize the labels from the
  // live payload's denormalized city/region/country strings + the URL slugs.
  // Country label falls back to "Canada" since the only province code we
  // emit today is `bc`; expand the fallback if/when we ship beyond Canada.
  const breadcrumbItems: Array<{ label: string; href: string }> = [
    { label: spot.country ?? "Canada", href: `/fishing/${provCodeLower}` },
    {
      label: spot.region ?? "British Columbia",
      href: `/fishing/${provCodeLower}`,
    },
  ];
  if (spot.city) {
    breadcrumbItems.push({
      label: spot.city,
      href: `/fishing/${provCodeLower}/${citySlug}`,
    });
  }
  breadcrumbItems.push({ label: spot.name, href: `/fishing/${provCodeLower}/${citySlug}/${spot.slug}` });

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      item: `${SITE_URL}${crumb.href}`,
    })),
  };

  const place = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: spot.name,
    description,
    url,
    geo: {
      "@type": "GeoCoordinates",
      latitude: spot.lat,
      longitude: spot.lng,
    },
    ...(spot.city && {
      address: {
        "@type": "PostalAddress",
        addressLocality: spot.city,
        addressRegion: provCodeLower.toUpperCase(),
        addressCountry: "CA",
      },
    }),
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    // The wizard stamps seo_intro_generated_at when it (re)writes seoIntro,
    // so use it as a proxy for "when the page content was last refreshed."
    ...(spot.seoIntroGeneratedAt && {
      dateModified: spot.seoIntroGeneratedAt,
    }),
    author: { "@type": "Organization", name: "ReelCaster" },
    publisher: {
      "@type": "Organization",
      name: "ReelCaster",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.ico`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(place) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
    </>
  );
}
