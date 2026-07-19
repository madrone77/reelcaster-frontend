import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCityPage,
  fetchHierarchy,
  fetchMapSpots,
} from "@/lib/bluecaster";
import { buildExploreData } from "../../../explore/lib/explore-data";
import { getFishingCity, getFishingProvince } from "../../lib/fishing-data";
import CityShell from "./city-shell";

const SITE_URL = "https://reelcaster.com";

// Scores refresh through the day — keep the page fresh-ish without going
// fully dynamic (the hierarchy behind it is cached 1h regardless).
export const revalidate = 900;

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
  const title =
    cityPage?.page.seo.title ??
    `Fishing in ${city.name}, ${city.provinceCode} — ${city.spots.length} Spots with Live Scores | ReelCaster`;
  const description =
    cityPage?.page.seo.meta_description ??
    `Explore ${city.spots.length} saltwater fishing spots around ${city.name}, ${province.name} on a live map — RC scores, wind, sea, and tide conditions for every spot.`;
  const canonical = `${SITE_URL}/fishing/${provinceParam.toLowerCase()}/${citySlug}`;
  const ogImage = cityPage?.page.seo.og_image_url ?? undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ReelCaster",
      type: "website",
      locale: "en_CA",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
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

  return (
    <CityShell
      city={city}
      provincePath={`/fishing/${provinceParam.toLowerCase()}`}
      spots={spots}
      species={data.species}
      date={data.date}
      intro={cityPage?.page.seo.meta_description ?? null}
    />
  );
}
