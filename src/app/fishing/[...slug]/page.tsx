import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchCityPage,
  fetchSpotPage,
  fetchSpotLivePage,
  fetchSpecies,
  type BlueCasterCityPage,
  type SpotPageInitial,
} from "@/lib/bluecaster";
import MarketingHeader from "@/app/components/marketing/marketing-header";
import MarketingFooter from "@/app/components/marketing/marketing-footer";
import CityHero from "@/components/fishing/city-hero";
import CityConditionsStrip from "@/components/fishing/city-conditions-strip";
import CityAbout from "@/components/fishing/city-about";
import CityTechniques from "@/components/fishing/city-techniques";
import CityScoreCta from "@/components/fishing/city-score-cta";
import CitySpots from "@/components/fishing/city-spots";
import CitySpeciesTable from "@/components/fishing/city-species-table";
import CitySeasonalGuide from "@/components/fishing/city-seasonal-guide";
import CityLocalIntel from "@/components/fishing/city-local-intel";
import CityAccessPoints from "@/components/fishing/city-access-points";
import CityLocalExperts from "@/components/fishing/city-local-experts";
import CityFaq from "@/components/fishing/city-faq";
import CityJsonLd from "@/components/fishing/city-json-ld";
import CityRegulationAlerts from "@/components/fishing/city-regulation-alerts";
import CityCatchReports from "@/components/fishing/city-catch-reports";
import LiveSpotJsonLd from "@/components/fishing/live-spot-json-ld";
import LiveSpotPage from "@/components/fishing/live-spot-page";

// ISR: rebuild at most every 60s. Vercel issues `Cache-Control: s-maxage=60,
// stale-while-revalidate=...` on the rendered HTML, so warm cache hits at
// the edge are ~10ms vs. ~1-3s cold SSR. Forecast data is generated hourly
// in BC; 60s freshness is well inside that cadence.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

const SITE_URL = "https://reelcaster.com";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [, citySlug, spotSlug, speciesSlug] = slug;
  if (!citySlug) return {};

  try {
    // 4 segments: spot + species filter — species-tailored meta
    if (spotSlug && speciesSlug) {
      const [spotData, speciesData] = await Promise.all([
        fetchSpotPage(spotSlug),
        fetchSpecies(speciesSlug),
      ]);
      if (!spotData || spotData.page.status !== "published" || !speciesData) return {};
      const canonical = `${SITE_URL}/fishing/${slug.join("/")}`;
      const speciesName = speciesData.species.name;
      const spotTitle = `${speciesName} Fishing at ${spotData.spot.name} | ReelCaster`;
      const description = `When and where to catch ${speciesName} at ${spotData.spot.name}. Seasonal abundance, regulations, and local conditions from ReelCaster.`;
      return buildMetadata(
        spotTitle,
        description,
        canonical,
        spotData.page.seo.og_image_url ?? spotData.page.hero.image_url,
        spotData.page.hero.image_alt ?? spotData.page.hero.h1,
      );
    }

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
  const [provinceCode, citySlug, spotSlug, speciesSlug, ...rest] = slug;

  if (!provinceCode || !citySlug || rest.length > 0) {
    notFound();
  }

  if (spotSlug) {
    return (
      <SpotPage
        provinceCode={provinceCode}
        citySlug={citySlug}
        spotSlug={spotSlug}
        speciesSlug={speciesSlug ?? null}
      />
    );
  }

  return <CityPage citySlug={citySlug} />;
}

// ── City branch ─────────────────────────────────────────────────────────
// Renders inside the dark `rc-*` marketing chrome (header + footer). This
// wrapping used to live in `fishing/layout.tsx` but moved here so the spot
// branch can opt out and bring its own light editorial layout.

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
    <div className="min-h-screen bg-rc-bg-darkest text-rc-text flex flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <CityJsonLd data={data} />
        <article>
          <CityHero data={data} />
          <CityConditionsStrip conditions={data.conditions_now} />
          <CityRegulationAlerts regulatoryAreas={data.regulatory_areas} />
          <CityAbout md={data.page.about_md} cityName={data.hierarchy.city.name} />
          <CityTechniques techniques={data.page.techniques} />
          <CityScoreCta score={data.rc_score_today} citySlug={data.page.slug} />
          <CitySpots
            citySlug={data.hierarchy.city.slug}
            cityName={data.hierarchy.city.name}
            provinceCode={data.hierarchy.province.code}
          />
          <CitySpeciesTable
            rows={data.species_table}
            regulatoryAreas={data.regulatory_areas}
          />
          <CitySeasonalGuide quarters={data.seasonal_guide} />
          <CityCatchReports
            citySlug={data.hierarchy.city.slug}
            cityName={data.hierarchy.city.name}
          />
          <CityLocalIntel md={data.page.local_intel_md} />
          <CityAccessPoints points={data.access_points} />
          <CityLocalExperts charters={data.charters} />
          <CityFaq faq={data.page.faq} />
        </article>

        <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-rc-bg-light text-center">
          <p className="text-xs text-rc-text-muted">
            Data provided by ReelCaster. Regulations are reference only &mdash; always verify with DFO.
          </p>
        </footer>
      </main>
      <MarketingFooter />
    </div>
  );
}

// ── Spot branch ─────────────────────────────────────────────────────────
// Renders the live-spot UI ported from BlueCaster's /test/oak-bay-flats-spot
// reference page. Light editorial theme, owns its own top nav (back-to-map +
// ReelCaster mark + action buttons + species chip bar + units selector) and
// its own footer ("Tight Lines!" + brand mark). NO marketing chrome wrap.
//
// We still fetch the thin /page payload for `<SpotJsonLd>` + the legacy
// publish-status gate; the heavy live payload comes from /spot-page and
// drives every visible value.
//
// The `speciesSlug` 4-segment URL form is currently rendered identically to
// the bare spot URL — the active-species selector lives in the live page's
// top nav and isn't driven by URL state yet. Forwarding `speciesSlug` is
// reserved for a future "deep-link a species" wiring inside LiveSpotPage.

async function SpotPage({
  provinceCode,
  citySlug,
  spotSlug,
}: {
  provinceCode: string;
  citySlug: string;
  spotSlug: string;
  speciesSlug: string | null;
}) {
  // Single fetch — the live payload drives both the visible page and the
  // JSON-LD enrichment. We used to fetch the thin /page endpoint in parallel
  // just to source JSON-LD fields; that was a full BlueCaster roundtrip per
  // SSR for no UX gain. LiveSpotJsonLd synthesizes BreadcrumbList / Place /
  // Article from the live payload + URL params.
  //
  // The live endpoint resolves against `fishing_spots` directly — no
  // requirement for a curated `spot_pages` row. notFound() only when the
  // spot itself doesn't exist.
  let live: SpotPageInitial | null;
  try {
    live = await fetchSpotLivePage(spotSlug);
  } catch {
    notFound();
  }

  if (!live) {
    notFound();
  }

  return (
    <>
      <LiveSpotJsonLd
        data={live}
        provinceCode={provinceCode}
        citySlug={citySlug}
      />
      <LiveSpotPage data={live} />
    </>
  );
}
