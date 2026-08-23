import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCityGuides,
  fetchCityPage,
  fetchCityToday,
  fetchHierarchy,
  fetchMapSpots,
} from "@/lib/bluecaster";
import { ANON_FORECAST_DAYS } from "@/lib/forecast-horizon";
import { COVERED_PROVINCES } from "@/lib/regions";
import { breadcrumbJsonLd, siteUrl } from "@/lib/site";
import { regulatorFor } from "@/lib/regions";
import { buildExploreData } from "../../../explore/lib/explore-data";
import { getFishingCity, getFishingProvince } from "../../lib/fishing-data";
import CityShell from "./city-shell";
import CityHeader from "./city-header";
import CityLive from "./city-live";
import { SpeciesCards } from "./species-cards";
import CityHub from "./hub/city-hub";
import KeepToday from "./hub/keep-today";
import ProGate from "./hub/pro-gate";
import { buildHubData } from "./hub/hub-data";
import {
  BeforeYouGo,
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
  const canonical = siteUrl(
    `/fishing/${provinceParam.toLowerCase()}/${citySlug}`,
  );
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
  params: Promise<{ province: string; city: string }>;
}) {
  const { province: provinceParam, city: citySlug } = await params;

  const [hierarchy, payload, cityPage, cityGuides, cityToday] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ city: citySlug }),
    fetchCityPage(citySlug),
    // Published species guides for this city. Additive: a city with none
    // renders exactly as it did before.
    fetchCityGuides(citySlug),
    // At the ANON horizon on purpose. This page is prerendered, so the static
    // render is always the signed-out state; the band upgrades its forward
    // line client-side once entitlement resolves. Asking for 14 here would
    // bake a day 9 answer into HTML served to everyone.
    fetchCityToday(citySlug, ANON_FORECAST_DAYS).catch(() => null),
  ]);

  const province = getFishingProvince(hierarchy, provinceParam);
  const city = getFishingCity(province, citySlug);
  if (!province || !city) notFound();

  // Same derivation Explore uses (scores joined onto the hierarchy tree),
  // narrowed to what the API returned for THIS city.
  //
  // Narrowed by id, not by `citySlug`. A spot has one home city but can be a
  // member of another, and `citySlug` carries the home — so filtering on it
  // silently dropped every shared spot from the page that asked for them.
  // Victoria rendered 15 of its 18 while the title, the guide cards and the
  // map all said 18, which is three different counts of the same thing on one
  // screen. The request was already scoped to this city; trust it.
  const data = buildExploreData(hierarchy, payload);
  const inCity = new Set((payload?.spots ?? []).map((s) => s.id));
  const spots = data.spots.filter((s) => inCity.has(s.id));

  // The leaderboard's own view of the same payload the map draws from. See
  // hub/hub-data.ts for why this is not derived from Explore's RailSpot.
  const hub = buildHubData(payload, inCity);

  const regulator = regulatorFor(city.provinceCode);
  const areaNumbers = (cityPage?.regulatory_areas ?? [])
    .map((a) => a.area_number)
    .filter((n): n is string => !!n && n.trim() !== "")
    // Numeric where they are numbers, lexical where they are not: WDFW's
    // "8-1" and "10" have to sort together and neither comparator alone does
    // it.
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));


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

  // Other published cities in the same province, so a reader who is in the
  // wrong place has somewhere to go. Ordered by how much we cover.
  const nearby = (province.cities ?? [])
    .filter((c) => c.slug !== citySlug)
    .map((c) => ({ slug: c.slug, name: c.name, spotCount: c.spots.length }))
    .sort((a, b) => b.spotCount - a.spotCount)
    .slice(0, 6);

  const guides = cityGuides?.guides ?? [];
  const seasonRows = cityPage?.species_table ?? [];
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
        <CityHeader
          provincePath={provincePath}
          city={city}
          spotCount={spots.length}
        />

        {/* The chips read `?species=` so an ad can land pre-filtered, and
            `useSearchParams` needs a boundary to keep this route
            prerendered. Without it the whole page would render on demand and
            lose the edge-cached first paint that is the point of it. */}
        <Suspense fallback={null}>
          <CityHub
            today={cityToday}
            hub={hub}
            citySlug={citySlug}
            cityName={city.name}
            provinceCode={city.provinceCode}
            areaLabel={regulator.areaLabel}
            areaNumbers={areaNumbers}
          >
            <KeepToday
              rows={seasonRows}
              cityName={city.name}
              provinceCode={city.provinceCode}
              regulator={regulator}
            />
          </CityHub>
        </Suspense>

        <ProGate provinceCode={city.provinceCode} citySlug={citySlug} />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 space-y-10">
        <CityLive cityName={city.name} citySlug={citySlug} />

        <SpeciesCards
          guides={guides}
          cityName={city.name}
          cityPath={`${provincePath}/${citySlug}`}
        />

        <CityShell
          city={city}
          spots={spots}
          species={data.species}
          date={data.date}
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
          citySlug={citySlug}
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

        <NearbyCities cities={nearby} provincePath={provincePath} />
      </div>
    </>
  );
}
