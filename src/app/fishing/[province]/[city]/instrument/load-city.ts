// Everything both city renderers need, loaded once.
//
// The public page at `/fishing/<province>/<city>` and the ad frame at
// `/lp7/<city>` draw the same instrument from the same data. They must not be
// two loaders: the anonymous-horizon slicing below is a gate, and a gate
// applied in one renderer and forgotten in the other is how a landing page
// ends up shipping day-9 scores to cold traffic. Same reasoning as
// `loadSpotPage`, which exists for the spot page and its own ad frame.
//
// What the two renderers DO differ on is the frame: the ad page drops the
// reference sections below the fold, the site chrome and the tab bar, and is
// noindex. None of that is decided here.

import { notFound } from "next/navigation";
import {
  fetchCityPage,
  fetchCityToday,
  fetchHierarchy,
  fetchMapForecast14d,
  fetchMapSpots,
  fetchSpotLivePage,
  type BlueCasterCitySeasonRow,
  type MapForecast14dPayload,
} from "@/lib/bluecaster";
import { ANON_FORECAST_DAYS } from "@/lib/forecast-horizon";
import {
  COVERED_PROVINCES,
  regulatorFor,
  timezoneFor,
  type Regulator,
} from "@/lib/regions";
import { formatHour12 } from "@/lib/time-format";
import { buildExploreData } from "@/app/explore/lib/explore-data";
import {
  getFishingCity,
  getFishingProvince,
  type FishingCity,
  type FishingProvince,
} from "@/app/fishing/lib/fishing-data";
import { buildHubData } from "../hub/hub-data";
import { featuredSpot, rankByRecognition, type RankedSpot } from "./featured";
import type { FeaturedFeed } from "./city-instrument";

export interface LoadedCity {
  province: FishingProvince;
  city: FishingCity;
  citySlug: string;
  provincePath: string;
  tz: string;
  regulator: Regulator;
  /** The city's roster as Explore derives it — what the page title counts. */
  spots: ReturnType<typeof buildExploreData>["spots"];
  /** Every mark that scored today, most-fished first. */
  rankedRows: RankedSpot[];
  featured: FeaturedFeed | null;
  cityForecast: MapForecast14dPayload | null;
  /** Retention rules per species, for "What you can keep today". */
  seasonRows: BlueCasterCitySeasonRow[];
  /** Today's best window at the featured mark, formatted, for the H1. */
  headlineWindow: string | null;
  /** The CMS row, for the SEO renderer's prose, FAQ and regulatory areas.
   *  The ad frame ignores it. */
  cityPage: Awaited<ReturnType<typeof fetchCityPage>>;
  /** Today's city verdict. The SEO renderer's tide panel reads its station;
   *  the instrument only used it to pick the headline species. */
  cityToday: Awaited<ReturnType<typeof fetchCityToday>>;
}

/**
 * The same load, addressed by city slug alone.
 *
 * The ad frame's URL is `/lp/7/<city>` with no province segment, because an ad
 * link is typed by hand and `/lp/7/bc/victoria-bc` is a second thing to get
 * wrong. City slugs already carry their jurisdiction (`victoria-bc`,
 * `seattle-wa`), but the SUFFIX is not the source of truth — a city is a row
 * in the hierarchy — so this searches the covered provinces for the slug
 * rather than parsing it. A slug we do not cover 404s.
 *
 * `fetchHierarchy` is cached, so the second call inside `loadCity` is a hit
 * rather than a second round trip.
 */
export async function loadCityBySlug(citySlug: string): Promise<LoadedCity> {
  const hierarchy = await fetchHierarchy();
  const provinceCode = COVERED_PROVINCES.find((code) =>
    getFishingProvince(hierarchy, code)?.cities?.some(
      (c) => c.slug === citySlug,
    ),
  );
  if (!provinceCode) notFound();
  return loadCity(provinceCode.toLowerCase(), citySlug);
}

export async function loadCity(
  provinceParam: string,
  citySlug: string,
): Promise<LoadedCity> {
  const [hierarchy, payload, cityPage, cityToday] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ city: citySlug }),
    fetchCityPage(citySlug),
    // At the ANON horizon on purpose. Both routes are prerendered, so the
    // static render is always the signed-out state; asking for 14 here would
    // bake a day 9 answer into HTML served to everyone.
    fetchCityToday(citySlug, ANON_FORECAST_DAYS).catch(() => null),
  ]);

  const province = getFishingProvince(hierarchy, provinceParam);
  const city = getFishingCity(province, citySlug);
  if (!province || !city) notFound();

  // Narrowed by id, not by `citySlug`. A spot has one home city but can be a
  // member of another, and `citySlug` carries the home — so filtering on it
  // silently dropped every shared spot from the page that asked for them.
  const data = buildExploreData(hierarchy, payload);
  const inCity = new Set((payload?.spots ?? []).map((s) => s.id));
  const spots = data.spots.filter((s) => inCity.has(s.id));

  // `"all"`, not the default pool: these pages ORDER every mark they draw
  // rather than recommending a handful, and the map carries the full roster.
  const hub = buildHubData(payload, inCity, "all");

  // Popularity leads, today's score breaks its ties — see instrument/featured.ts.
  const rankedRows = rankByRecognition(hub.spots, null, hub.spots.length);
  // The chart follows the city's headline species where the featured mark
  // scored it, so an August Victoria page leads with salmon rather than with
  // whatever peaked highest there that morning.
  const featured = featuredSpot(
    hub.spots,
    cityToday?.headline?.species_id ?? null,
  );

  const [cityForecast, featuredPage] = await Promise.all([
    fetchMapForecast14d({ city: citySlug }).catch(() => null),
    featured
      ? fetchSpotLivePage(featured.spot.slug).catch(() => null)
      : Promise.resolve(null),
  ]);

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
           * Sliced to the ANONYMOUS horizon, because both routes are
           * prerendered: whatever is in here is served to every visitor. The
           * client widens both from the entitlement-gated per-spot proxy.
           *
           * ⚠ This is the gate. It lives here, once, precisely so the ad
           * frame cannot ship a wider grid than the public page by omission.
           */
          scoreGrid: (
            featuredPage.hourlyScoreGrid[featured.speciesId] ??
            // The city payload and the spot payload are scored independently,
            // so a species that leads the mark on one can be missing from the
            // other after a re-bake.
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
   * different hours at different water.
   *
   * `end_hour` names the last good hour, so the label closes an hour later.
   */
  const headlineWindow = (() => {
    const w = featured?.entry.window;
    if (!w) return null;
    return `${formatHour12(w.start_hour)} to ${formatHour12((w.end_hour + 1) % 24)}`;
  })();

  return {
    province,
    city,
    citySlug,
    provincePath: `/fishing/${provinceParam.toLowerCase()}`,
    tz: timezoneFor(city.provinceName),
    regulator: regulatorFor(city.provinceCode),
    spots,
    rankedRows,
    featured: featuredFeed,
    cityForecast,
    seasonRows: cityPage?.species_table ?? [],
    headlineWindow,
    cityPage,
    cityToday,
  };
}
