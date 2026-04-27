import type { BlueCasterSpotPage } from "@/lib/bluecaster";

const SITE_URL = "https://reelcaster.com";

export default function SpotJsonLd({ data }: { data: BlueCasterSpotPage }) {
  const { page, spot, hierarchy } = data;
  const provCode = hierarchy?.province.code ?? "bc";
  const citySlug = hierarchy?.city.slug ?? "";
  const url = `${SITE_URL}/fishing/${provCode}/${citySlug}/${page.slug}`;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: page.hero.breadcrumb.map((crumb, i) => ({
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
    description: page.seo.meta_description,
    url,
    geo: {
      "@type": "GeoCoordinates",
      latitude: spot.lat,
      longitude: spot.lng,
    },
    ...(hierarchy && {
      address: {
        "@type": "PostalAddress",
        addressLocality: hierarchy.city.name,
        addressRegion: hierarchy.province.code.toUpperCase(),
        addressCountry: hierarchy.country.code.toUpperCase(),
      },
    }),
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.seo.title,
    description: page.seo.meta_description,
    url,
    ...(page.published_at && { datePublished: page.published_at }),
    ...(page.last_edited_at && { dateModified: page.last_edited_at }),
    ...(page.hero.image_url && { image: page.hero.image_url }),
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

  const faqPage =
    page.faq && page.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: page.faq.map((qa) => ({
            "@type": "Question",
            name: qa.q,
            acceptedAnswer: { "@type": "Answer", text: qa.a },
          })),
        }
      : null;

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
      {faqPage && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
        />
      )}
    </>
  );
}
