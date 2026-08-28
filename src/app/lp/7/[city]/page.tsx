import type { Metadata } from "next";
import { loadCityBySlug } from "@/app/fishing/[province]/[city]/instrument/load-city";
import CityInstrument from "@/app/fishing/[province]/[city]/instrument/city-instrument";
import KeepToday from "@/app/fishing/[province]/[city]/hub/keep-today";
import {
  AdBrandBar,
  AdFooter,
} from "@/app/explore/spot/components/ad-brand-bar";
import { siteUrl } from "@/lib/site";
import { COVERED_PROVINCES } from "@/lib/regions";
import { fetchHierarchy } from "@/lib/bluecaster";
import { getFishingProvince } from "@/app/fishing/lib/fishing-data";

/**
 * `/lp/7/<city>` — the city instrument as a cold-traffic landing page.
 *
 * The same page as `/fishing/<province>/<city>`, cut down to the part somebody
 * arriving on a paid click will actually read: the 14-day strip, the 24-hour
 * chart, the marks, the map, custom spots, and what they can keep today. It
 * stops there.
 *
 * ── What it drops, and why ───────────────────────────────────────────────
 *
 * Everything below "What you can keep today" — the city report, the species
 * guide cards, the second Pro banner, tides, the season matrix, before-you-go,
 * the prose, the FAQ and nearby cities — is the SEO half of that page. It is
 * why the public URL ranks, and it is nine screens of reference material to
 * somebody who has been here twenty seconds. Dropping it here costs nothing,
 * because THIS route is noindex: the ranking body still exists, unchanged, at
 * the public URL.
 *
 * The site chrome goes with it. `/lp/*`'s layout carries no marketing header
 * or footer, and `/lp` is already in the tab bar's FOCUSED_FUNNELS, so the
 * mobile bottom nav is gone too — four signed-in tabs floating over the strip
 * are four ways out of a page bought by the click. What replaces them is the
 * brand bar and a legal-only footer: Terms and Privacy have to be reachable
 * from any page that takes a card, and this one opens checkout.
 *
 * ── What it does NOT change ──────────────────────────────────────────────
 *
 * The data. Both routes go through `loadCity`, which is where the
 * anonymous-horizon slicing lives — see load-city.ts. A landing page that
 * loaded its own data would be one refactor away from shipping day-9 scores to
 * cold traffic.
 */

type PageProps = { params: Promise<{ city: string }> };

// Scores refresh through the day. Same window as the public page.
export const revalidate = 900;

/**
 * Prerender every published city, so an ad click lands on cached HTML rather
 * than waiting for a render. Cities added after a deploy still render on
 * demand and then cache (`dynamicParams` defaults true), so this is a head
 * start and not an allow list — which is what makes "any city-state" true.
 */
export async function generateStaticParams() {
  try {
    const hierarchy = await fetchHierarchy();
    return COVERED_PROVINCES.flatMap(
      (code) =>
        getFishingProvince(hierarchy, code)?.cities?.map((c) => ({
          city: c.slug,
        })) ?? [],
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
  const { city: citySlug } = await params;
  const { city } = await loadCityBySlug(citySlug);
  return {
    title: `${city.name} Fishing Forecast`,
    // noindex is inherited from /lp's layout; the canonical is what stops a
    // link that leaks into the wild from splitting the public page's signals.
    // `follow` stays on so the links out of here still carry.
    alternates: {
      canonical: siteUrl(
        `/fishing/${city.provinceCode.toLowerCase()}/${citySlug}`,
      ),
    },
  };
}

export default async function CityAdPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const {
    city,
    tz,
    regulator,
    spots,
    rankedRows,
    featured,
    cityForecast,
    seasonRows,
    headlineWindow,
  } = await loadCityBySlug(citySlug);

  return (
    <>
      <AdBrandBar />
      {/* pt-16 clears the fixed brand bar. */}
      <div className="pt-16">
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 space-y-6">
          {/* The header, without the breadcrumb. A breadcrumb is navigation
              up and out of a page somebody was sent to on purpose, and the
              two links in it go to a directory index and a province list —
              both of which sell the same thing less specifically. */}
          <header>
            <h1 className="text-[26px] sm:text-[32px] font-bold leading-tight text-rc-ink">
              {headlineWindow
                ? `Today's best fishing in ${city.name}: ${headlineWindow}`
                : `Fishing in ${city.name}, ${city.provinceCode}`}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-rc-ink-soft">
              This page is full of real data to show you what you can see with
              ReelCaster in {city.name}.
            </p>
          </header>

          <CityInstrument
            citySlug={citySlug}
            cityName={city.name}
            cityLat={city.lat}
            cityLng={city.lng}
            tz={tz}
            serverNowMs={Date.now()}
            initialForecast={cityForecast}
            featured={featured}
            rows={rankedRows}
            rosterCount={spots.length}
          />

          <KeepToday
            rows={seasonRows}
            cityName={city.name}
            provinceCode={city.provinceCode}
            regulator={regulator}
          />
        </div>
      </div>
      <AdFooter />
    </>
  );
}
