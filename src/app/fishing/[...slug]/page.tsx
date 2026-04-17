import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchCityPage, type BlueCasterCityPage } from "@/lib/bluecaster";
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

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [, citySlug] = slug;
  if (!citySlug) return {};

  try {
    const data = await fetchCityPage(citySlug);
    if (!data || data.page.status !== "published") return {};

    const canonical = `https://reelcaster.com/fishing/${slug.join("/")}`;
    return {
      title: data.page.seo.title,
      description: data.page.seo.meta_description,
      alternates: { canonical },
      openGraph: {
        title: data.page.seo.title,
        description: data.page.seo.meta_description,
        url: canonical,
        siteName: "ReelCaster",
        images: data.page.seo.og_image_url
          ? [{ url: data.page.seo.og_image_url, alt: data.page.hero.image_alt ?? data.page.hero.h1 }]
          : [],
        type: "article",
        locale: "en_CA",
      },
      twitter: {
        card: "summary_large_image",
        title: data.page.seo.title,
        description: data.page.seo.meta_description,
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return {};
  }
}

export default async function FishingCityPage({ params }: PageProps) {
  const { slug } = await params;
  const [provinceCode, citySlug, ...rest] = slug;

  if (!provinceCode || !citySlug || rest.length > 0) {
    notFound();
  }

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
