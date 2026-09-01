// Data model for the public /fishing pages. Derives everything from the
// BlueCaster hierarchy, the same payload Explore renders, so the directory can
// never disagree with the map about what is published.
//
// Visibility gate: a city appears only when cities.lifecycle === 'published'
// AND it is the home of at least one published spot. (Explore itself shows any
// city with published spots; these are indexable pages, so they follow the
// stricter lifecycle gate.)
//
// ⚠️ The gate counts HOMES, not memberships. A spot can be a member of several
// cities and is the home of exactly one, so a city whose water is all borrowed
// from closer neighbours reports a healthy membership count and owns nothing.
// San Diego is 7 by membership and 0 by home. Gating on membership publishes an
// empty page for it, and lifecycle cannot catch that either, because promotion
// counts published members too.

import type { BlueCasterHierarchy, HierarchyCity } from "@/lib/bluecaster";
import { COVERED_PROVINCES, countryDisplayName } from "@/lib/regions";
import { cityPath, spotPath, statePath, type PlaceLocation } from "@/lib/paths";

export interface FishingSpotLink {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** Canonical path. Precomputed so no caller has to rebuild the chain. */
  path: string;
}

export interface FishingCity {
  /** BlueCaster's internal key ("victoria-bc"). Pass this to the API. */
  slug: string;
  /** The path segment ("victoria"). Never pass this to the API. */
  urlSlug: string;
  name: string;
  lat: number;
  lng: number;
  regionName: string;
  regionSlug: string;
  countryCode: string;
  provinceCode: string;
  provinceName: string;
  /** Breadcrumb label for the country: "Canada", "USA". */
  countryName: string;
  /** Canonical path for this city's own page. */
  path: string;
  /** Published spots this city is the HOME of, already sorted by name. */
  spots: FishingSpotLink[];
}

export interface FishingProvince {
  code: string; // "BC"
  name: string; // "British Columbia"
  type: string; // "province" | "state"
  countryCode: string; // "CA"
  countryName: string; // "Canada" | "USA"
  path: string;
  cities: FishingCity[];
}

/** The subset of a city needed to build any path beneath it. */
export function locationOf(city: FishingCity): PlaceLocation {
  return {
    countryCode: city.countryCode,
    stateCode: city.provinceCode,
    cityUrlSlug: city.urlSlug,
  };
}

/**
 * Spots this city is the home of. `city.spots` lists every member, so this is
 * what decides both the gate and what the page renders.
 */
function homeSpots(city: HierarchyCity): HierarchyCity["spots"] {
  return city.spots.filter((s) => s.is_published && s.home_city_id === city.id);
}

/**
 * State code ("bc") plus country code ("ca") → its hierarchy node and visible
 * cities.
 *
 * Both codes are checked. The country segment is not decoration: `ca` is
 * Canada in the country slot and California in the state slot, so resolving a
 * state code alone would let /fishing/us/bc and /fishing/ca/bc both answer.
 */
export function getFishingProvince(
  hierarchy: BlueCasterHierarchy | null,
  countryParam: string,
  provinceParam: string,
): FishingProvince | null {
  const code = provinceParam.toUpperCase();
  const wantCountry = countryParam.toUpperCase();
  if (!(COVERED_PROVINCES as readonly string[]).includes(code)) return null;

  for (const country of hierarchy?.countries ?? []) {
    if (country.code.toUpperCase() !== wantCountry) continue;
    for (const sp of country.states_provinces) {
      if (sp.code !== code) continue;

      const countryName = countryDisplayName(country.name);
      const cities: FishingCity[] = [];
      for (const region of sp.regions) {
        for (const city of region.cities) {
          if (city.lifecycle !== "published") continue;
          const owned = homeSpots(city);
          if (owned.length === 0) continue;

          const loc: PlaceLocation = {
            countryCode: country.code,
            stateCode: sp.code,
            cityUrlSlug: city.url_slug,
          };
          const spots = owned
            .map(({ id, slug, name, lat, lng }) => ({
              id,
              slug,
              name,
              lat,
              lng,
              path: spotPath(loc, slug),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

          cities.push({
            slug: city.slug,
            urlSlug: city.url_slug,
            name: city.name,
            lat: city.lat,
            lng: city.lng,
            regionName: region.name,
            regionSlug: region.slug,
            countryCode: country.code,
            provinceCode: sp.code,
            provinceName: sp.name,
            countryName,
            path: cityPath(loc),
            spots,
          });
        }
      }

      // Most-covered cities first, so the flagship reads as the flagship.
      cities.sort(
        (a, b) => b.spots.length - a.spots.length || a.name.localeCompare(b.name),
      );

      return {
        code: sp.code,
        name: sp.name,
        type: sp.type,
        countryCode: country.code,
        countryName,
        path: statePath(country.code, sp.code),
        cities,
      };
    }
  }
  return null;
}

/** Every covered state that has at least one visible city, for a country. */
export function getFishingCountry(
  hierarchy: BlueCasterHierarchy | null,
  countryParam: string,
): { code: string; name: string; provinces: FishingProvince[] } | null {
  const wantCountry = countryParam.toUpperCase();
  const country = (hierarchy?.countries ?? []).find(
    (c) => c.code.toUpperCase() === wantCountry,
  );
  if (!country) return null;

  const provinces: FishingProvince[] = [];
  for (const code of COVERED_PROVINCES) {
    const province = getFishingProvince(hierarchy, country.code, code);
    if (province && province.cities.length > 0) provinces.push(province);
  }
  if (provinces.length === 0) return null;

  return {
    code: country.code,
    name: countryDisplayName(country.name),
    provinces,
  };
}

/** Every country that has at least one visible state. */
export function getFishingCountries(
  hierarchy: BlueCasterHierarchy | null,
): Array<{ code: string; name: string; provinces: FishingProvince[] }> {
  const out = [];
  for (const country of hierarchy?.countries ?? []) {
    const resolved = getFishingCountry(hierarchy, country.code);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** City lookup by its URL segment, NOT by its API slug. */
export function getFishingCity(
  province: FishingProvince | null,
  cityUrlSlug: string,
): FishingCity | null {
  const want = cityUrlSlug.toLowerCase();
  return province?.cities.find((c) => c.urlSlug.toLowerCase() === want) ?? null;
}

/**
 * Spot slug → the city that OWNS it, and the paths above it.
 *
 * This used to first-match on membership while walking COVERED_PROVINCES in
 * array order, which meant a spot in three cities got whichever the loop
 * reached first. That was tolerable when the answer only drew a breadcrumb.
 * It is not tolerable now that it decides the spot's URL, because an ordering
 * accident would become 27 pairs of pages competing for the same content.
 * `home_city_id` is the stored answer and `city.spots` is already filtered to
 * it, so a spot resolves to exactly one city or to none.
 *
 * Returns null for a spot whose city is not published: a custom spot, or one
 * in a building city. Those get no breadcrumb and no canonical path.
 */
export function findCityForSpot(
  hierarchy: BlueCasterHierarchy | null,
  spotSlug: string,
): {
  city: FishingCity;
  spot: FishingSpotLink;
  cityPath: string;
  provincePath: string;
} | null {
  const want = spotSlug.toLowerCase();
  for (const country of hierarchy?.countries ?? []) {
    for (const code of COVERED_PROVINCES) {
      const province = getFishingProvince(hierarchy, country.code, code);
      if (!province) continue;
      for (const city of province.cities) {
        const spot = city.spots.find((s) => s.slug.toLowerCase() === want);
        if (!spot) continue;
        return {
          city,
          spot,
          cityPath: city.path,
          provincePath: province.path,
        };
      }
    }
  }
  return null;
}

/**
 * Resolve a state by its code alone, for callers that have no country in hand:
 * the sitemap, the LP pages and the API proxies all iterate
 * COVERED_PROVINCES, which is a list of state codes.
 *
 * ⚠️ Safe only because the covered state codes are unique across countries.
 * That is luck, not design: "CA" is already Canada in the country slot and
 * California in the state slot, so the day California is covered this must
 * take a country and every caller must be given one. The route pages already
 * pass both, deliberately, so /fishing/us/bc cannot resolve.
 */
export function getFishingProvinceByCode(
  hierarchy: BlueCasterHierarchy | null,
  provinceParam: string,
): FishingProvince | null {
  for (const country of hierarchy?.countries ?? []) {
    const province = getFishingProvince(hierarchy, country.code, provinceParam);
    if (province) return province;
  }
  return null;
}

/**
 * spot slug → canonical path, for every spot with a public home.
 *
 * One walk of the tree, for callers that hold a list of spot slugs from some
 * other payload and need their URLs. The alternative is findCityForSpot() in a
 * loop, which re-walks the whole tree per spot.
 */
export function spotPathIndex(
  hierarchy: BlueCasterHierarchy | null,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const country of getFishingCountries(hierarchy)) {
    for (const province of country.provinces) {
      for (const city of province.cities) {
        for (const spot of city.spots) index.set(spot.slug, spot.path);
      }
    }
  }
  return index;
}
