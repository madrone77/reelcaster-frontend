import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchCityGuides,
  fetchCityPage,
  fetchCityToday,
  fetchHierarchy,
  fetchMapForecast14d,
  fetchMapSpots,
  fetchSpotLivePage,
} from "@/lib/bluecaster";
import { ANON_FORECAST_DAYS } from "@/lib/forecast-horizon";
import { COVERED_PROVINCES, timezoneFor } from "@/lib/regions";
import { breadcrumbJsonLd, siteUrl } from "@/lib/site";
import { regulatorFor } from "@/lib/regions";
import { buildExploreData } from "../../../explore/lib/explore-data";
import { getFishingCity, getFishingProvince } from "../../lib/fishing-data";
import CityHeader from "./city-header";
import CityLive from "./city-live";
import { SpeciesCards } from "./species-cards";
import ProGate from "./hub/pro-gate";
import { buildHubData } from "./hub/hub-data";
import CityInstrument, {
  type FeaturedFeed,
} from "./instrument/city-instrument";
import { featuredSpot, rankByRecognition } from "./instrument/featured";
import KeepToday from "./hub/keep-today";
import { formatHour12 } from "@/lib/time-format";
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

  // The instrument's own view of the same payload the map draws from. See
  // hub/hub-data.ts for why this is not derived from Explore's RailSpot.
  //
  // `"all"`, not the default pool: this page ORDERS every mark it draws rather
  // than recommending a handful, and the map carries the full roster. Dropping
  // unreported spots would have left Seattle's map showing sixteen marks under
  // a list that admitted to three.
  const hub = buildHubData(payload, inCity, "all");

  // Best-known first — popularity leads, today's score breaks its ties. The
  // mirror of the hub's old ranking, and the reason is in instrument/featured.ts:
  // bought traffic reads the names before it reads the numbers.
  const rankedRows = rankByRecognition(hub.spots, null, hub.spots.length);
  // The chart follows the city's headline species where the featured mark
  // scored it, so an August Victoria page leads with salmon rather than with
  // whatever peaked highest there that morning. It does not move which MARK
  // is featured.
  const featured = featuredSpot(
    hub.spots,
    cityToday?.headline?.species_id ?? null,
  );

  /**
   * The 24-hour chart's data, and the city's 14-day peaks.
   *
   * The forecast is asked for at the ANONYMOUS horizon by construction — this
   * request carries no session — which is what the prerendered body is allowed
   * to contain. The client refetches under the reader's own session.
   *
   * Both are `.catch(() => null)`: the chart and the strip each render their
   * own empty state, and neither is worth 500ing a page whose reference
   * sections below are entirely independent of them.
   */
  const [cityForecast, featuredPage] = await Promise.all([
    fetchMapForecast14d({ city: citySlug }).catch(() => null),
    featured
      ? fetchSpotLivePage(featured.spot.slug).catch(() => null)
      : Promise.resolve(null),
  ]);

  /**
   * The featured mark's hourly grids, sliced down to what the chart draws.
   *
   * Species is fixed to the mark's best TODAY and does not follow a filter:
   * the chart, the line naming it and the strip of numbers above it all read
   * this one row, so they cannot end up describing different water. Same rule
   * the hub's one-window fix established.
   */
  const featuredFeed: FeaturedFeed | null =
    featured && featuredPage
      ? {
          slug: featured.spot.slug,
          name: featured.spot.name,
          speciesId: featured.speciesId,
          speciesName:
            featuredPage.species.find((sp) => sp.id === featured.speciesId)
              ?.name ?? null,
          lat: featured.spot.lat,
          lng: featured.spot.lng,
          /**
           * Sliced to the ANONYMOUS horizon, because this route is
           * prerendered: whatever is in here is served to every visitor, and
           * days past that horizon are not an anonymous reader's to have. The
           * client widens both from the entitlement-gated per-spot proxy.
           *
           * It costs nothing to render: an anonymous reader can only SELECT
           * the unlocked days anyway, so days 2..13 would have been carried in
           * the HTML and never drawn.
           */
          scoreGrid: (
            featuredPage.hourlyScoreGrid[featured.speciesId] ??
            // The city payload and the spot payload are scored independently,
            // so a species that leads the mark on one can be missing from the
            // other after a re-bake. Fall back to whatever grid that spot does
            // have rather than drawing an empty chart.
            Object.values(featuredPage.hourlyScoreGrid)[0] ??
            []
          ).slice(0, ANON_FORECAST_DAYS),
          conditionsGrid: (featuredPage.hourlyConditionsGrid ?? []).slice(
            0,
            ANON_FORECAST_DAYS,
          ),
          isos: (featuredPage.daily14 ?? []).map((d) => d.iso),
          sun: featuredPage.sun,
          rightNow: featuredPage.rightNow,
        }
      : null;

  /**
   * Today's best window at the mark the page leads with, for the H1.
   *
   * Read off `featured` — the SAME row the 24-hour chart draws and the line
   * under it names — so the headline and the chart can never advertise
   * different hours at different water. It follows the mark's own best species
   * rather than a chip, because the H1 must not move when a reader taps a
   * filter.
   *
   * `end_hour` names the last good hour, so the label closes an hour later.
   */
  const headlineWindow = (() => {
    const w = featured?.entry.window;
    if (!w) return null;
    return `${formatHour12(w.start_hour)} to ${formatHour12((w.end_hour + 1) % 24)}`;
  })();

  const regulator = regulatorFor(city.provinceCode);


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
          window={headlineWindow}
        />

        {/* The instrument: 14-day strip → 24-hour chart → the marks people
            fish → all of them on the water. It replaces the conversion stack
            (bite radar, spotlight, leaderboard, weekend signup) that stood
            here — see instrument/city-instrument.tsx for why. */}
        <CityInstrument
          citySlug={citySlug}
          cityName={city.name}
          cityLat={city.lat}
          cityLng={city.lng}
          tz={timezoneFor(city.provinceName)}
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
          provinceCode={city.provinceCode}
          regulator={regulator}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 space-y-10">
        <CityLive cityName={city.name} citySlug={citySlug} />

        <SpeciesCards
          guides={guides}
          cityName={city.name}
          cityPath={`${provincePath}/${citySlug}`}
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
