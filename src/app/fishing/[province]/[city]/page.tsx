import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCityPage,
  fetchHierarchy,
  fetchMapSpots,
} from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { buildExploreData } from "../../../explore/lib/explore-data";
import { getFishingCity, getFishingProvince } from "../../lib/fishing-data";
import CityShell from "./city-shell";

// Scores refresh through the day — keep the page fresh-ish without going
// fully dynamic (the hierarchy behind it is cached 1h regardless).
export const revalidate = 900;

// Prerender every published city. On-demand renders make Next stream metadata,
// which puts <title> and the canonical at the END of the body rather than in
// <head>; prerendering resolves them before the first byte. Cities added after
// a deploy still render on demand and then cache (the default
// `dynamicParams: true`), so this is a head start, not an allow list.
export async function generateStaticParams() {
  try {
    const hierarchy = await fetchHierarchy();
    return COVERED_PROVINCES.flatMap((code) => {
      const province = getFishingProvince(hierarchy, code);
      return (province?.cities ?? []).map((city) => ({
        province: code.toLowerCase(),
        city: city.slug,
      }));
    });
  } catch {
    // Upstream down at build time — fall back to pure on-demand rendering
    // rather than failing the build.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ province: string; city: string }>;
}): Promise<Metadata> {
  const { province: provinceParam, city: citySlug } = await params;
  const province = getFishingProvince(await fetchHierarchy(), provinceParam);
  const city = getFishingCity(province, citySlug);
  // 404 here, not just in the page — metadata resolves before the body
  // streams, so bailing late would send a 200 with 404 UI (soft-404).
  if (!province || !city) notFound();

  const cityPage = await fetchCityPage(citySlug);
  // A CMS-authored title already carries its own brand suffix, so it opts out
  // of the layout template via `absolute`; the generated fallback is bare and
  // lets the template append.
  const cmsTitle = cityPage?.page.seo.title;
  // "Victoria, BC Fishing — 17 Spots". Leading with the place puts the words
  // someone actually searched at the front of the result, and dropping the old
  // "with Live Scores" tail brings every city inside the ~60 characters Google
  // renders before truncating. The scores are the description's job — nobody
  // searches for them by name.
  const fallbackTitle = `${city.name}, ${city.provinceCode} Fishing: ${city.spots.length} Spots`;
  const description =
    cityPage?.page.seo.meta_description ??
    `Explore ${city.spots.length} saltwater fishing spots around ${city.name}, ${province.name} on a live map: RC scores, wind, sea, and tide conditions for every spot.`;
  const canonical = siteUrl(
    `/fishing/${provinceParam.toLowerCase()}/${citySlug}`,
  );
  const ogImage = cityPage?.page.seo.og_image_url ?? undefined;
  return {
    title: cmsTitle ? { absolute: cmsTitle } : fallbackTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: cmsTitle ?? `${fallbackTitle} | ReelCaster`,
      description,
      url: canonical,
      type: "website",
      // The CMS hero when the city has one, otherwise the site-wide generated
      // card (src/app/opengraph-image.tsx). A page-level `openGraph` block
      // REPLACES the inherited one, so the fallback has to be named here —
      // omitting it left these pages with no og:image at all.
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
        : DEFAULT_OG),
    },
    robots: { index: true, follow: true },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ province: string; city: string }>;
}) {
  const { province: provinceParam, city: citySlug } = await params;

  const [hierarchy, payload, cityPage] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ city: citySlug }),
    fetchCityPage(citySlug),
  ]);

  const province = getFishingProvince(hierarchy, provinceParam);
  const city = getFishingCity(province, citySlug);
  if (!province || !city) notFound();

  // Same derivation Explore uses (scores joined onto the hierarchy tree),
  // narrowed to this city's members.
  const data = buildExploreData(hierarchy, payload);
  const spots = data.spots.filter((s) => s.citySlug === citySlug);

  const provincePath = `/fishing/${provinceParam.toLowerCase()}`;

  // Mirrors the visible breadcrumb CityShell renders.
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `Fishing in ${city.provinceName}`, path: provincePath },
    { name: city.name, path: `${provincePath}/${citySlug}` },
  ]);

  // The spot roster as an ItemList of Places, ranked as the rail ranks them.
  // Coordinates come from the same payload the map pins render from.
  const spotList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Fishing spots near ${city.name}, ${city.provinceCode}`,
    numberOfItems: spots.length,
    itemListElement: spots.map((spot, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: spot.name,
        url: siteUrl(`/explore/spot/${spot.slug}`),
        geo: {
          "@type": "GeoCoordinates",
          latitude: spot.lat,
          longitude: spot.lng,
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(spotList) }}
      />
      <CityShell
        city={city}
        provincePath={provincePath}
        spots={spots}
        species={data.species}
        date={data.date}
        intro={cityPage?.page.seo.meta_description ?? null}
      />
    </>
  );
}
