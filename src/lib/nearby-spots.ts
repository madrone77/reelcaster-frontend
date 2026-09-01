/**
 * The homepage's "near you" section, as pure functions.
 *
 * Everything here is deliberately free of I/O so the two decisions that matter
 * — which city an IP snaps to, and which spots that city leads with — can be
 * tested against fixtures. The route (src/app/api/nearby-spots/route.ts) is the
 * only part that talks to BlueCaster.
 *
 * No new backend surface: the nearest-city snap reads the same hierarchy
 * /explore already fetches, and the ranking folds the same map payload the map
 * itself draws from. That is the point — a homepage that disagreed with the
 * map about a spot's score would be worse than no homepage section at all.
 */

import type {
  BlueCasterHierarchyLight,
  MapSpotsPayload,
} from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";

/**
 * How far an IP may sit from a covered city before we say nothing.
 *
 * An IP fix is a guess about a metro area, not a fix on a person, so the
 * distance being generous is fine; what it must not do is let somebody in
 * Calgary be told Victoria is "near you". 150 km keeps the whole covered
 * Salish Sea reachable from any of its cities while ruling out the next
 * province.
 */
export const MAX_CITY_DISTANCE_KM = 150;

/** Rows the section renders. */
export const NEARBY_SPOT_LIMIT = 10;

export interface CityPoint {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  spotCount: number;
}

export interface NearbySpot {
  id: string;
  slug: string;
  /**
   * Canonical page path. Null out of this module, which is given a payload and
   * no place tree; the route that serves these fills it in from the hierarchy.
   */
  path: string | null;
  name: string;
  /** 0–100, today's peak for the best-scoring species. */
  score: number;
  /** Display name of the species that produced `score`. */
  topSpecies: string | null;
}

export interface NearbyPayload {
  located: boolean;
  city?: { slug: string; name: string };
  spots?: NearbySpot[];
}

/** Not-located is one shape, built in one place, so callers can't diverge. */
export const NOT_LOCATED: NearbyPayload = { located: false };

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance in km.
 *
 * Equirectangular would be accurate enough over 150 km and cheaper, but this
 * runs a handful of times per request against a list of about a dozen cities,
 * so the cost is noise and haversine removes a caveat rather than adding one.
 */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Every city an anonymous visitor could usefully be sent to.
 *
 * Three filters, each of which is the difference between a link that works and
 * a link that lands somewhere we cannot serve:
 *   • the province is in `COVERED_PROVINCES` — a region can hold a published
 *     city and still not be one we sell or forecast. Oregon is the standing
 *     example (see the note atop lib/regions.ts), and it is the only one of
 *     the three gates that is not self-evident from the tree, which is why it
 *     is easy to leave out and expensive to leave out.
 *   • `lifecycle === "published"` — a building/staging city is not public yet.
 *   • `spot_count > 0` — a covered city with nothing in it has no rows to show.
 * Together these mirror `coveredCitySlug` in explore/lib/explore-data.ts,
 * which gates `?loc=` the same way.
 */
export function coveredCityPoints(
  hierarchy: BlueCasterHierarchyLight | null,
): CityPoint[] {
  if (!hierarchy) return [];
  const out: CityPoint[] = [];
  for (const country of hierarchy.countries ?? []) {
    for (const province of country.states_provinces ?? []) {
      if (!(COVERED_PROVINCES as readonly string[]).includes(province.code)) {
        continue;
      }
      for (const region of province.regions ?? []) {
        for (const city of region.cities ?? []) {
          if (city.lifecycle !== "published") continue;
          if (!(city.spot_count > 0)) continue;
          if (!Number.isFinite(city.lat) || !Number.isFinite(city.lng)) continue;
          out.push({
            slug: city.slug,
            name: city.name,
            lat: city.lat,
            lng: city.lng,
            spotCount: city.spot_count,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Snap a coordinate to the nearest covered city, or null when the nearest one
 * is further off than we are willing to call "near you".
 *
 * Returning null rather than the far city is what keeps the section honest:
 * the caller has no cutoff logic of its own to get wrong.
 */
export function nearestCityTo(
  lat: number,
  lng: number,
  cities: CityPoint[],
  maxKm = MAX_CITY_DISTANCE_KM,
): { city: CityPoint; distanceKm: number } | null {
  let best: { city: CityPoint; distanceKm: number } | null = null;
  for (const city of cities) {
    const distanceKm = haversineKm(lat, lng, city.lat, city.lng);
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm };
  }
  if (!best || best.distanceKm > maxKm) return null;
  return best;
}

/**
 * The city's best water today, by score.
 *
 * The fold matches the dashboard's `aroundYouFrom` and the map's own pucks:
 * a spot's score is the highest per-species daily peak it carries, and the
 * species that produced it is the one named. Catch-and-release species never
 * appear because upstream drops `release_only` rows before this ever sees
 * them.
 *
 * Unscored spots are skipped rather than sorted to the bottom. A spot with no
 * forecast is not a recommendation, and a "near you" list padded out to ten
 * with blanks reads as broken.
 *
 * The payload is NOT filtered by `city_slug`: it is already scoped to the city
 * upstream, and `city_slug` names only the alphabetically-first member city,
 * so filtering on it would silently drop spots shared across a boundary.
 */
export function rankNearbySpots(
  payload: MapSpotsPayload | null,
  limit = NEARBY_SPOT_LIMIT,
): NearbySpot[] {
  if (!payload) return [];
  const species = payload.species ?? {};
  const scored: NearbySpot[] = [];

  for (const entry of payload.spots ?? []) {
    let bestPeak = 0;
    let bestSpeciesId: string | null = null;
    for (const [id, strip] of Object.entries(entry.scores ?? {})) {
      const peak = (strip as { peak?: number })?.peak;
      if (typeof peak === "number" && peak > bestPeak) {
        bestPeak = peak;
        bestSpeciesId = id;
      }
    }
    if (bestPeak <= 0) continue;
    if (!entry.slug) continue; // nothing to link to
    scored.push({
      id: entry.id,
      slug: entry.slug,
      path: null,
      name: entry.name,
      score: Math.round(bestPeak * 100),
      topSpecies: (bestSpeciesId && species[bestSpeciesId]?.name) || null,
    });
  }

  // Score first, then name, so equal scores order the same way on every
  // request instead of following whatever order the payload arrived in.
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}
