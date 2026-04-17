import type { BlueCasterCityPage } from "@/lib/bluecaster";

function BreadcrumbLD({ data }: { data: BlueCasterCityPage }) {
  const items = data.page.hero.breadcrumb;
  if (!items || items.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `https://reelcaster.com${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function PlaceLD({ data }: { data: BlueCasterCityPage }) {
  const city = data.hierarchy?.city;
  if (!city) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: city.name,
    geo: {
      "@type": "GeoCoordinates",
      latitude: city.lat,
      longitude: city.lng,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: city.name,
      addressRegion: data.hierarchy.province.name,
      addressCountry: data.hierarchy.country.code,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function ArticleLD({ data }: { data: BlueCasterCityPage }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.page.seo?.title ?? `Fishing ${data.hierarchy.city.name}`,
    description: data.page.seo?.meta_description ?? "",
    author: {
      "@type": "Organization",
      name: "ReelCaster",
      url: "https://reelcaster.com",
    },
    publisher: {
      "@type": "Organization",
      name: "ReelCaster",
      url: "https://reelcaster.com",
    },
    about: data.species_table?.map((s) => ({
      "@type": "Thing",
      name: s.species_name,
    })),
    mainEntityOfPage: data.page.seo?.canonical_url
      ? `https://reelcaster.com${data.page.seo.canonical_url}`
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function FaqLD({ data }: { data: BlueCasterCityPage }) {
  if (!data.page.faq || data.page.faq.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.page.faq.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.a,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function LocalBusinessLD({ data }: { data: BlueCasterCityPage }) {
  if (!data.charters || data.charters.length === 0) return null;

  return (
    <>
      {data.charters.map((charter) => {
        const schema = {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: charter.name,
          ...(charter.phone && { telephone: charter.phone }),
          ...(charter.website && { url: charter.website }),
          ...(charter.rating != null && {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: charter.rating,
              reviewCount: charter.review_count ?? 0,
            },
          }),
          address: {
            "@type": "PostalAddress",
            addressLocality: data.hierarchy.city.name,
            addressRegion: data.hierarchy.province.name,
            addressCountry: data.hierarchy.country.code,
          },
        };

        return (
          <script
            key={charter.id}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        );
      })}
    </>
  );
}

export default function CityJsonLd({ data }: { data: BlueCasterCityPage }) {
  return (
    <>
      <BreadcrumbLD data={data} />
      <PlaceLD data={data} />
      <ArticleLD data={data} />
      <FaqLD data={data} />
      <LocalBusinessLD data={data} />
    </>
  );
}
