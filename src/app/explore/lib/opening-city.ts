/**
 * Which city the Explore map opens on when the URL doesn't say.
 *
 * /explore used to open on Victoria for everybody. That is the right frame for
 * the pilot city's own anglers and the wrong one for everyone else: somebody in
 * Seattle arrived on water in another country, two hours' drive and a border
 * away, and had to work out that the map moves before the product could show
 * them anything they could fish. The opening frame is the first and cheapest
 * piece of relevance the page can offer, and it was being spent on a constant.
 *
 * So: snap the visitor's approximate position to the covered city they would
 * actually go to — the nearest one when they are near any of them, the nearest
 * hub when they are not — and fall back to the pilot city only when there is no
 * position to snap at all.
 *
 * The position is an IP fix from Vercel's edge headers, the same rung
 * `/api/geo` and `/api/nearby-spots` read. Deliberately NOT
 * `navigator.geolocation` — that raises a permission prompt, cannot run until
 * the bundle has hydrated, and would land the visitor on one city and then
 * move them to another. The header is already on the request, so the right
 * frame is chosen before a single byte of HTML is written. Precise location
 * stays where it belongs: behind the "Near me" button, which the angler asks
 * for.
 *
 * See `nearestOpeningCity` for how far-away arrivals are handled, and for why
 * this carries no distance cap when the homepage's near-you section does.
 */

import type { BlueCasterHierarchyLight } from "@/lib/bluecaster";
import { coveredCityPoints, nearestCityTo } from "@/lib/nearby-spots";

export interface VisitorPoint {
  lat: number;
  lng: number;
}

/** Just enough of `Headers`/`ReadonlyHeaders` to read a value, so this is
 *  testable against a plain object instead of a request. */
export interface HeaderReader {
  get(name: string): string | null | undefined;
}

/** The non-production stand-in for the geo headers — see `readVisitorPoint`. */
export interface GeoOverride {
  lat?: string | null;
  lng?: string | null;
}

/**
 * The visitor's approximate position, or null when we don't have one.
 *
 * Null is a normal answer, not an error: `next dev` sets no geo headers, and
 * neither do the data-centre IPs that crawlers and uptime checks arrive on. All
 * of those get the pilot city, which is exactly the behaviour this page had
 * before.
 *
 * Outside production a `?geo_lat=&geo_lng=` pair stands in for the headers, so
 * the opening frame can be exercised locally and on a preview without faking an
 * IP. The gate is `VERCEL_ENV === "production"`, which the platform sets and we
 * do not: on prod the override is never read, so nobody can hand out a link
 * that lies about where the recipient is.
 */
export function readVisitorPoint(
  headers: HeaderReader,
  override?: GeoOverride,
): VisitorPoint | null {
  if (process.env.VERCEL_ENV !== "production" && override) {
    // Both halves have to be non-empty strings before `Number` sees them.
    // `Number("")` is 0, not NaN, so a bare `?geo_lat=&geo_lng=` — which is
    // what a form or a hand-edited URL leaves behind — would otherwise read as
    // a valid fix at 0°N 0°E and open the map on the nearest hub to the Gulf
    // of Guinea.
    const rawLat = override.lat?.trim();
    const rawLng = override.lng?.trim();
    if (rawLat && rawLng) {
      const lat = Number(rawLat);
      const lng = Number(rawLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }

  const lat = parseFloat(headers.get("x-vercel-ip-latitude") ?? "");
  const lng = parseFloat(headers.get("x-vercel-ip-longitude") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * How close a visitor has to be before "the nearest city" is a real answer
 * rather than a rounding artefact.
 *
 * Inside this radius the visitor is somewhere in the covered water and the
 * nearest city is the one they would drive to. Outside it they are choosing a
 * destination, not a boat ramp, and the arithmetic stops meaning what it says —
 * see the hub list below.
 *
 * 250 km covers the whole Salish Sea from any of its cities and reaches down to
 * Portland, which snaps to Seattle on the honest nearest rule anyway.
 */
export const LOCAL_RADIUS_KM = 250;

/**
 * Where an arrival from outside the coverage area opens.
 *
 * Hardcoded rather than derived, because a hub is a judgement about which city
 * a stranger means when they say "the Pacific Northwest", and that is not a
 * quantity in the database. Deriving it from spot counts would let a city
 * become a hub by shipping spots — Prince Rupert's 26 already outrank Seattle's
 * 16 — which is a silent change to where a whole continent lands.
 *
 * The three are the anchors of the three separated clusters we cover:
 *   • vancouver-bc     — the BC south coast and the Lower Mainland.
 *   • seattle-wa       — Puget Sound.
 *   • prince-rupert-bc — the north coast, 700 km from anything else on the
 *                        list, and the right answer for Alaska.
 *
 * Everything else we cover sits inside one of those clusters and is reachable
 * by the local rule. Add a slug here only when a new city anchors a cluster of
 * its own; a hub that fails the covered/published/has-spots gates is ignored,
 * so a stale entry degrades to the plain nearest city rather than to an empty
 * map.
 */
export const HUB_CITY_SLUGS = [
  "vancouver-bc",
  "seattle-wa",
  "prince-rupert-bc",
] as const;

/**
 * The city Explore opens on for a visitor at `point` — or null when there is no
 * point, or no covered city to snap to, in which case the caller keeps its own
 * default.
 *
 * Two tiers, because "closest" means two different things at two different
 * scales:
 *
 *   • **Within `LOCAL_RADIUS_KM`** — plain nearest, across every covered city.
 *     Someone in Everett gets Seattle, someone in Nanaimo gets Cowichan, and
 *     nothing dresses that up.
 *
 *   • **Beyond it** — nearest of `HUB_CITY_SLUGS`. At continental range the
 *     covered cities are one destination and the differences between them are
 *     noise: from New York, Bellingham measures 3,863 km and Seattle 3,866 km,
 *     so plain nearest would open a visitor from the eastern seaboard on a town
 *     of 90,000 with seven spots, decided by 3 km in 3,863 — a margin far
 *     inside the error of an IP fix. It also sends the whole Canadian prairie
 *     across an international border: Calgary measures 653 km to Bellingham and
 *     672 km to Vancouver. Snapping to a hub removes both, and removes them
 *     without a knife-edge — the hubs are hundreds of km apart from any far
 *     origin, so the answer is stable.
 *
 * **No distance cap on either tier**, which is the one way this differs from
 * the homepage's near-you section. That section makes a claim — "here is water
 * near you" — so `MAX_CITY_DISTANCE_KM` stops it from telling somebody in
 * Calgary that Victoria is nearby; past the cap it renders nothing. A map has
 * no such option. It has to open somewhere, and the honest answer for a visitor
 * in New York is Seattle: not because Seattle is near them, but because it is
 * the nearest thing we cover, and the location pill says so rather than
 * pretending otherwise.
 */
export function nearestOpeningCity(
  hierarchy: BlueCasterHierarchyLight | null,
  point: VisitorPoint | null,
): string | null {
  if (!point) return null;

  const cities = coveredCityPoints(hierarchy);
  const nearest = nearestCityTo(point.lat, point.lng, cities, Infinity);
  if (!nearest) return null;
  if (nearest.distanceKm <= LOCAL_RADIUS_KM) return nearest.city.slug;

  const hubs = cities.filter((c) =>
    (HUB_CITY_SLUGS as readonly string[]).includes(c.slug),
  );
  const hub = nearestCityTo(point.lat, point.lng, hubs, Infinity);
  return (hub ?? nearest).city.slug;
}
