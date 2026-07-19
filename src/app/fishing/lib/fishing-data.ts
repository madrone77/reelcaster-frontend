// Data model for the public /fishing/[province] and /fishing/[province]/[city]
// SEO pages. Derives everything from the BlueCaster hierarchy — the same
// payload Explore renders — so the directory pages can never disagree with
// the map about what's published.
//
// Visibility gate: a city appears only when cities.lifecycle === 'published'
// AND it has at least one published spot. (Explore itself shows any city with
// published spots; these are indexable marketing pages, so they follow the
// stricter lifecycle gate.)

import type { BlueCasterHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";

export interface FishingSpotLink {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export interface FishingCity {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  regionName: string;
  regionSlug: string;
  provinceCode: string;
  provinceName: string;
  spots: FishingSpotLink[];
}

export interface FishingProvince {
  code: string; // "BC"
  name: string; // "British Columbia"
  type: string; // "province" | "state"
  cities: FishingCity[];
}

/** URL param for a province ("bc") → its hierarchy node + visible cities. */
export function getFishingProvince(
  hierarchy: BlueCasterHierarchy | null,
  provinceParam: string,
): FishingProvince | null {
  const code = provinceParam.toUpperCase();
  if (!(COVERED_PROVINCES as readonly string[]).includes(code)) return null;

  for (const country of hierarchy?.countries ?? []) {
    for (const sp of country.states_provinces) {
      if (sp.code !== code) continue;

      const cities: FishingCity[] = [];
      for (const region of sp.regions) {
        for (const city of region.cities) {
          if (city.lifecycle !== "published") continue;
          const spots = city.spots
            .filter((s) => s.is_published)
            .map(({ id, slug, name, lat, lng }) => ({ id, slug, name, lat, lng }))
            .sort((a, b) => a.name.localeCompare(b.name));
          if (spots.length === 0) continue;
          cities.push({
            slug: city.slug,
            name: city.name,
            lat: city.lat,
            lng: city.lng,
            regionName: region.name,
            regionSlug: region.slug,
            provinceCode: sp.code,
            provinceName: sp.name,
            spots,
          });
        }
      }

      // Most-covered cities first — the flagship reads as the flagship.
      cities.sort(
        (a, b) => b.spots.length - a.spots.length || a.name.localeCompare(b.name),
      );

      return { code: sp.code, name: sp.name, type: sp.type, cities };
    }
  }
  return null;
}

export function getFishingCity(
  province: FishingProvince | null,
  citySlug: string,
): FishingCity | null {
  return province?.cities.find((c) => c.slug === citySlug) ?? null;
}
