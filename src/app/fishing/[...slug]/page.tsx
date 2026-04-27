import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchCityPage,
  fetchSpotPage,
  type BlueCasterCityPage,
  type BlueCasterSpotPage,
} from "@/lib/bluecaster";
import CityHero from "@/components/fishing/city-hero";
import CityConditionsStrip from "@/components/fishing/city-conditions-strip";
import CityAbout from "@/components/fishing/city-about";
import CityTechniques from "@/components/fishing/city-techniques";
import CityScoreCta from "@/components/fishing/city-score-cta";
import CitySpeciesTable from "@/components/fishing/city-species-table";
import CitySeasonalGuide from "@/components/fishing/city-seasonal-guide";
import CityLocalIntel from "@/components/fishing/city-local-intel";
import CityAccessPoints from "@/components/fishing/city-access-points";
import CityLocalExperts from "@/components/fishing/city-local-experts";
import CityFaq from "@/components/fishing/city-faq";
import CityJsonLd from "@/components/fishing/city-json-ld";
import SpotHero from "@/components/fishing/spot-hero";
import SpotScoreCta from "@/components/fishing/spot-score-cta";
import SpotForecastStrip from "@/components/fishing/spot-forecast-strip";
import SpotSeasonalAbundance from "@/components/fishing/spot-seasonal-abundance";
import SpotAccessPoints from "@/components/fishing/spot-access-points";
import SpotLocalExperts from "@/components/fishing/spot-local-experts";
import SpotJsonLd from "@/components/fishing/spot-json-ld";
import SpotBreakdownPanel from "@/components/fishing/spot-breakdown-panel";
import SpotPaywallTeaser from "@/components/fishing/spot-paywall-teaser";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

const SITE_URL = "https://reelcaster.com";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [, citySlug, spotSlug] = slug;
  if (!citySlug) return {};

  try {
    if (spotSlug) {
      const data = await fetchSpotPage(spotSlug);
      if (!data || data.page.status !== "published") return {};
      const canonical = `${SITE_URL}/fishing/${slug.join("/")}`;
      return buildMetadata(
        data.page.seo.title,
        data.page.seo.meta_description,
        canonical,
        data.page.seo.og_image_url ?? data.page.hero.image_url,
        data.page.hero.image_alt ?? data.page.hero.h1,
      );
    }

    const data = await fetchCityPage(citySlug);
    if (!data || data.page.status !== "published") return {};
    const canonical = `${SITE_URL}/fishing/${slug.join("/")}`;
    return buildMetadata(
      data.page.seo.title,
      data.page.seo.meta_description,
      canonical,
      data.page.seo.og_image_url,
      data.page.hero.image_alt ?? data.page.hero.h1,
    );
  } catch {
    return {};
  }
}

function buildMetadata(
  title: string,
  description: string,
  canonical: string,
  ogImage: string | null,
  ogAlt: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ReelCaster",
      images: ogImage ? [{ url: ogImage, alt: ogAlt }] : [],
      type: "article",
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function FishingPage({ params }: PageProps) {
  const { slug } = await params;
  const [provinceCode, citySlug, spotSlug, ...rest] = slug;

  if (!provinceCode || !citySlug || rest.length > 0) {
    notFound();
  }

  if (spotSlug) {
    return <SpotPage spotSlug={spotSlug} />;
  }

  return <CityPage citySlug={citySlug} />;
}

async function CityPage({ citySlug }: { citySlug: string }) {
  let data: BlueCasterCityPage | null;
  try {
    data = await fetchCityPage(citySlug);
  } catch {
    notFound();
  }

  if (!data || data.page.status !== "published") {
    notFound();
  }

  return (
    <>
      <CityJsonLd data={data} />
      <article>
        <CityHero data={data} />
        <CityConditionsStrip conditions={data.conditions_now} />
        <CityAbout md={data.page.about_md} cityName={data.hierarchy.city.name} />
        <CityTechniques techniques={data.page.techniques} />
        <CityScoreCta score={data.rc_score_today} citySlug={data.page.slug} />
        <CitySpeciesTable
          rows={data.species_table}
          regulatoryAreas={data.regulatory_areas}
        />
        <CitySeasonalGuide quarters={data.seasonal_guide} />
        <CityLocalIntel md={data.page.local_intel_md} />
        <CityAccessPoints points={data.access_points} />
        <CityLocalExperts charters={data.charters} />
        <CityFaq faq={data.page.faq} />
      </article>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-stone-200 text-center">
        <p className="text-xs text-slate-400">
          Data provided by ReelCaster. Regulations are reference only &mdash; always verify with DFO.
        </p>
      </footer>
    </>
  );
}

async function SpotPage({ spotSlug }: { spotSlug: string }) {
  let data: BlueCasterSpotPage | null;
  try {
    data = await fetchSpotPage(spotSlug);
  } catch {
    notFound();
  }

  if (!data || data.page.status !== "published") {
    notFound();
  }

  // Species options for the forecast filter — derived from the seasonal_abundance
  // list so the dropdown matches the species table the user just looked at.
  const speciesOptions = data.seasonal_abundance.map((r) => ({
    id: r.species_id,
    name: r.species_name,
  }));

  return (
    <>
      <SpotJsonLd data={data} />
      <article>
        <SpotHero data={data} />
        <CityAbout md={data.page.about_md} cityName={data.spot.name} />
        <CityTechniques techniques={data.page.techniques} />
        <SpotScoreCta score={data.rc_score_now} spotSlug={data.page.slug} />
        <SpotForecastStrip
          forecast={data.forecast}
          speciesOptions={speciesOptions}
        />
        <SpotBreakdownPanel scoreNow={data.rc_score_now} />
        <SpotPaywallTeaser
          spotSlug={data.page.slug}
          speciesSlug={
            speciesOptions.length > 0
              ? data.seasonal_abundance.find(
                  (r) => r.species_id === speciesOptions[0].id,
                )?.species_slug ?? null
              : null
          }
        />
        <CitySpeciesTable rows={data.species_table} regulatoryAreas={[]} />
        <SpotSeasonalAbundance rows={data.seasonal_abundance} />
        <CityLocalIntel md={data.page.local_intel_md} />
        <SpotAccessPoints points={data.access_points} />
        <SpotLocalExperts experts={data.local_experts} />
        <CityFaq faq={data.page.faq} />
      </article>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-stone-200 text-center">
        <p className="text-xs text-slate-400">
          Data provided by ReelCaster. Regulations are reference only &mdash; always verify with DFO.
        </p>
      </footer>
    </>
  );
}
