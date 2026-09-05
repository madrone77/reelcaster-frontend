import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCityGuides,
  fetchCityPage,
  fetchHierarchy,
} from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { breadcrumbJsonLd, siteUrl } from "@/lib/site";
import { getFishingCity, getFishingProvince, getFishingProvinceByCode, locationOf } from "@/app/fishing/lib/fishing-data";
import { spotPath } from "@/lib/paths";
import CityHeader from "./city-header";
import { DeclareFishingPlace } from "@/app/fishing/fishing-place";
import CityLive from "./city-live";
import { SpeciesCards } from "./species-cards";
import ProGate from "./hub/pro-gate";
import CityInstrument from "./instrument/city-instrument";
import { loadCity } from "./instrument/load-city";
import KeepToday from "./hub/keep-today";
import {
  BeforeYouGo,
  CityCreel,
  CityFaq,
  CityProse,
  NearbyCities,
  SeasonMatrix,
} from "./city-sections";
import { licenceFor } from "./city-licence";
import CityTides from "./city-tides";

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
      const province = getFishingProvinceByCode(hierarchy, code);
      return (province?.cities ?? []).map((city) => ({
        country: city.countryCode.toLowerCase(),
        state: code.toLowerCase(),
        city: city.urlSlug,
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
  params: Promise<{ country: string; state: string; city: string }>;
}): Promise<Metadata> {
  const {
    country: countryParam,
    state: stateParam,
    city: cityUrlSlug,
  } = await params;
  const province = getFishingProvince(
    await fetchHierarchy(),
    countryParam,
    stateParam,
  );
  const city = getFishingCity(province, cityUrlSlug);
  // 404 here, not just in the page — metadata resolves before the body
  // streams, so bailing late would send a 200 with 404 UI (soft-404).
  if (!province || !city) notFound();

  const cityPage = await fetchCityPage(city.slug);
  // A CMS-authored title already carries its own brand suffix, so it opts out
  // of the layout template via `absolute`; the generated fallback is bare and
  // lets the template append.
  //
  // BlueCaster returns null here when nobody authored one, rather than a
  // generic stand-in. That matters precisely BECAUSE this is `absolute`: a
  // stand-in would not compete with the fallback below, it would replace it,
  // and the fallback counts today's published spots and cannot go stale.
  const cmsTitle = cityPage?.page.seo.title ?? null;
  // "Victoria, BC Fishing — 17 Spots". Leading with the place puts the words
  // someone actually searched at the front of the result, and dropping the old
  // "with Live Scores" tail brings every city inside the ~60 characters Google
  // renders before truncating. The scores are the description's job — nobody
  // searches for them by name.
  const fallbackTitle = `${city.name}, ${city.provinceCode} Fishing: ${city.spots.length} Spots`;
  const description =
    cityPage?.page.seo.meta_description ??
    `Explore ${city.spots.length} saltwater fishing spots around ${city.name}, ${province.name} on a live map: RC scores, wind, sea, and tide conditions for every spot.`;
  const canonical = siteUrl(city.path);
  return {
    title: cmsTitle ? { absolute: cmsTitle } : fallbackTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: cmsTitle ?? `${fallbackTitle} | ReelCaster`,
      description,
      // A page declaring its own `openGraph` block replaces the inherited one
      // rather than merging into it, so without this the card loses the site
      // label and Facebook falls back to printing the bare domain.
      siteName: "ReelCaster",
      url: canonical,
      type: "website",
      // No `images` here on purpose. This route has its own
      // `opengraph-image.tsx`, and an explicit `images` entry beats the file
      // convention, so naming one would pin every city back to the single
      // site-wide card the per-city one exists to replace. The old code
      // spread DEFAULT_OG whenever the CMS had no hero, which is now every
      // city, so it would have done exactly that on all nine.
    },
    robots: { index: true, follow: true },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ country: string; state: string; city: string }>;
}) {
  const {
    country: countryParam,
    state: stateParam,
    city: cityUrlSlug,
  } = await params;

  // Loaded through the shared loader, which the ad frame at /lp7/<city> also
  // uses — see instrument/load-city.ts for why these must not be two loaders.
  const {
    province,
    city,
    provincePath,
    tz,
    regulator,
    spots,
    rankedRows,
    featured: featuredFeed,
    cityForecast,
    seasonRows,
    headlineWindow,
    cityPage,
    cityToday,
  } = await loadCity(countryParam, stateParam, cityUrlSlug);

  // Published species guides for this city. Additive: a city with none
  // renders exactly as it did before. Only the SEO renderer shows them.
  const cityGuides = await fetchCityGuides(city.slug);


  // Mirrors the visible breadcrumb CityShell renders.
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `Fishing in ${city.provinceName}`, path: provincePath },
    { name: city.name, path: city.path },
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
        url: siteUrl(spotPath(locationOf(city), spot.slug)),
        geo: {
          "@type": "GeoCoordinates",
          latitude: spot.lat,
          longitude: spot.lng,
        },
      },
    })),
  };

  // Other published cities in the same province, so a reader who is in the
  // wrong place has somewhere to go. Ordered by how much we cover.
  const nearby = (province.cities ?? [])
    .filter((c) => c.slug !== city.slug)
    .map((c) => ({
      slug: c.slug,
      path: c.path,
      name: c.name,
      spotCount: c.spots.length,
    }))
    .sort((a, b) => b.spotCount - a.spotCount)
    .slice(0, 6);

  const guides = cityGuides?.guides ?? [];
  const faq = cityPage?.page.faq ?? [];
  const licence = licenceFor(city.provinceCode);

  // FAQPage, with a licence question appended from our own licence data.
  //
  // The generated FAQ is forbidden from touching licences, because a fee
  // frozen into prose goes stale on 1 April in every city at once. But "do I
  // need a licence to fish here" is the question people actually type, so it
  // is answered here from the same table the licence guide renders, and it
  // cannot drift.
  const licenceQuestion =
    licence && licence.residentAnnual
      ? {
          q: `Do I need a fishing licence in ${city.name}?`,
          a:
            `Yes. Saltwater fishing around ${city.name} needs the ` +
            `${licence.name} from ${licence.regulator}, ` +
            `${licence.residentAnnual} a year for a ${licence.residentLabel.toLowerCase()} ` +
            `in ${licence.yearLabel}.` +
            (licence.addOn
              ? ` The ${licence.addOn.name} (${licence.addOn.fee}) is ${licence.addOn.when}`
              : "") +
            ` ${licence.caveat}`,
        }
      : null;

  const faqForSchema = licenceQuestion ? [...faq, licenceQuestion] : faq;

  const faqJsonLd = faqForSchema.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqForSchema.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    : null;

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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* ── The conversion block ────────────────────────────────────────
          Full width, same as the reference material below it, because the
          block lays itself out: one column on a phone, and past `lg` a wide
          main column beside a rail (see city-hub.tsx). It was capped at
          768px and centred at every width, which is right for a phone and,
          on a 1440px desktop, a phone screenshot on a field of grey.

          The measure is still protected — it is protected by the split and
          by each card's own max-width, not by squeezing the whole page. */}
      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* Renders nothing. Tells the bar overhead which city this page is
            about, so its trial CTA opens on "See the next 14 days in
            Victoria" rather than the generic headline. The bar sits in
            /fishing/layout.tsx and cannot read a name off the URL, which
            carries a slug. */}
        <DeclareFishingPlace name={city.name} />

        <CityHeader
          provincePath={provincePath}
          city={city}
          window={headlineWindow}
        />

        {/* The instrument: 14-day strip → 24-hour chart → the marks people
            fish → all of them on the water. It replaces the conversion stack
            (bite radar, spotlight, leaderboard, weekend signup) that stood
            here — see instrument/city-instrument.tsx for why. */}
        <CityInstrument
          citySlug={city.slug}
          cityName={city.name}
          cityLat={city.lat}
          cityLng={city.lng}
          tz={tz}
          serverNowMs={Date.now()}
          initialForecast={cityForecast}
          featured={featuredFeed}
          rows={rankedRows}
          /* The roster, which is what the <title> and the JSON-LD count. A
             mark with no species scored today is absent from `rankedRows`,
             so the two can differ and the map's caption has to reconcile
             them rather than quietly report the smaller one. */
          rosterCount={spots.length}
        />

        {/* What is legal to keep today. It was a child of the hub block; the
            instrument does not take children, and this is the one piece of
            that stack a reader still needs before they act on a score. */}
        <KeepToday
          rows={seasonRows}
          cityName={city.name}
          regulator={regulator}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 space-y-10">
        <CityLive cityName={city.name} citySlug={city.slug} />

        {/* WDFW's ramp counts, one card per marine area. Directly under the
            daily report because it answers the same question, and on most
            Washington cities it answers it alone. Renders nothing for BC. */}
        <CityCreel creel={cityPage?.creel ?? null} cityName={city.name} />

        <SpeciesCards
          guides={guides}
          cityName={city.name}
          location={locationOf(city)}
        />

        {/* The second ask, and the only one below the fold.
            The map is where the page stops selling and starts giving depth
            away: every spot, scored, on real bathymetry. Somebody who has
            scrolled through it and is still reading has shown more intent
            than anyone the first CTA caught, and until now the page never
            asked them again. Same component as the block above, so the trial
            length and the price cannot drift apart between the two. */}
        <ProGate
          variant="banner"
          provinceCode={city.provinceCode}
          citySlug={city.slug}
        />

        {cityToday?.tide_station && (
          <CityTides
            station={cityToday.tide_station}
            tz={cityToday.city.tz}
            date={cityToday.date}
            cityName={city.name}
          />
        )}

        <SeasonMatrix rows={seasonRows} cityName={city.name} />

        <BeforeYouGo
          areas={cityPage?.regulatory_areas ?? []}
          provinceCode={city.provinceCode}
          cityName={city.name}
        />

        <CityProse
          aboutMd={cityPage?.page.about_md ?? null}
          localIntelMd={cityPage?.page.local_intel_md ?? null}
          cityName={city.name}
        />

        {/* The visible FAQ stays as authored; only the schema above carries
            the appended licence question, which the licence panel already
            answers on screen. */}
        <CityFaq faq={faq} cityName={city.name} />

        <NearbyCities cities={nearby} />
      </div>
    </>
  );
}
