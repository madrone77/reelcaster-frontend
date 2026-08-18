// Explore page data model: joins the BlueCaster hierarchy (location tree)
// with the bulk map-spots payload (scores + conditions) into the shapes the
// rail, pins, and drawer render. Score scale: the API returns 0..1 — it is
// multiplied to 0..100 HERE and nowhere else.

import type {
  BlueCasterHierarchy,
  BlueCasterHierarchyLight,
  HierarchyCity,
  HierarchyCityLight,
  MapSpotsPayload,
  MapSpotEntry,
  MapCondCell,
  MapCondStrip,
} from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { formatHour12 } from "@/lib/time-format";

// ── Score tiers ─────────────────────────────────────────────────────

export type Tier = "good" | "fair" | "poor" | "none";

export function tierFor(score: number | null): Tier {
  if (score === null) return "none";
  if (score >= 75) return "good";
  if (score >= 55) return "fair";
  return "poor";
}

/** Tailwind classes for the tier pill ("85 GOOD") on cards and the drawer. */
export const TIER_PILL: Record<Tier, string> = {
  good: "bg-rc-good-bg text-rc-good-ink",
  fair: "bg-rc-fair-bg text-rc-fair-ink",
  poor: "bg-rc-poor-bg text-rc-poor-ink",
  none: "bg-rc-surface text-rc-ink-mute",
};

/** Tier-colored text (numerals, bars). */
export const TIER_TEXT: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

// Map-pin tier fills moved to GL paint expressions — see
// src/app/explore/lib/spot-geojson.ts (TIER_HEX).

// ── Rail spot ───────────────────────────────────────────────────────

export interface RailConditions {
  wind: string | null; // "12 kn SW"
  sea: string | null; // "Light Chop"
  tide: string | null; // "+2.4m ▲"
  current: string | null; // "0.4 kn" / "Slack"
  sky: string | null; // "Clear" / "Cloudy" / "Rain"
  air: string | null; // "18°C"
}

export interface RailSpot {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  citySlug: string;
  cityName: string;
  regionSlug: string;
  regionName: string;
  provinceCode: string;
  /** 0–100 peak score for the best species today, null = unscored. */
  score: number | null;
  /** Best species id — keys the forecast-14d hourly grid for the strip. */
  bestSpeciesId: string | null;
  driverSpecies: string | null;
  /** Local hour (0–23) of the peak. */
  peakHour: number | null;
  /** Distance from the city center, km (drawer sub line). */
  distanceKm: number | null;
  conditions: RailConditions;
  /** Raw 24h conditions strip — lets the card re-read at the scrubbed hour. */
  condStrip: MapCondStrip | null;
  /** Best-species hourly scores 0–100, null = unavailable that hour. */
  hours24: (number | null)[];
  /** Per-species peak score (0–100) keyed by species id — powers the filter. */
  scoresBySpecies: Record<string, number>;
  /**
   * A spot this angler created. Ranks in the rail like any other spot, but is
   * drawn on the map as its own lock/globe marker rather than a GL pin, so
   * "mine" reads differently from "curated".
   */
  isCustom?: boolean;
  visibility?: "private" | "public";
  /**
   * Scraped catch reports exist here in the intel window. Comes in on the
   * map/spots payload, which Explore renders server-side, so the reports badge
   * is in the first paint. The Pro-gated counts arrive separately and replace
   * the lock with a number; this flag is only ever "tracked / not tracked",
   * which is public by design.
   */
  hasReports?: boolean;
}

/**
 * The city /explore opens on when it is covered — the flagship pilot, so a cold
 * load lands on the bathymetry-rich Juan de Fuca coastline rather than wherever
 * happens to score highest today.
 *
 * Exported because the page now fetches this city's spots instead of every spot
 * in every covered province: the opening payload has to be chosen before there
 * are any scores to rank cities by.
 */
export const PREFERRED_DEFAULT_CITY = "victoria-bc";

/** Published member spots, from whichever tree shape we were handed. */
function publishedSpotCount(city: HierarchyCity | HierarchyCityLight): number {
  return "spot_count" in city
    ? city.spot_count
    : city.spots.filter((s) => s.is_published).length;
}

/**
 * Echo `slug` back if it names a covered city that has published spots,
 * otherwise null.
 *
 * This is the gate on `?loc`, and the reason it exists is that the slug goes
 * straight into an upstream `city=` fetch. Anyone can type anything into a
 * query string, so an unchecked value turns /explore into an open proxy for
 * probing the map API — and a slug for a city that is covered but still empty
 * would fetch a payload with nothing in it, leaving the page with no spots to
 * frame and no bbox to prefetch a strip for. Both cases fall back to the
 * default city, which is what the client already does with an `?loc` it cannot
 * resolve (see `selectedCity` in explore-shell).
 */
export function coveredCitySlug(
  hierarchy: BlueCasterHierarchy | BlueCasterHierarchyLight | null,
  slug: string | null | undefined,
): string | null {
  if (!slug) return null;
  for (const country of hierarchy?.countries ?? []) {
    for (const sp of country.states_provinces) {
      if (!(COVERED_PROVINCES as readonly string[]).includes(sp.code)) continue;
      for (const region of sp.regions) {
        for (const city of region.cities as Array<
          HierarchyCity | HierarchyCityLight
        >) {
          if (city.slug !== slug) continue;
          return publishedSpotCount(city) > 0 ? city.slug : null;
        }
      }
    }
  }
  return null;
}

/** Is the preferred opening city in the covered tree with published spots? */
export function hasPreferredDefaultCity(
  hierarchy: BlueCasterHierarchy | BlueCasterHierarchyLight | null,
): boolean {
  return coveredCitySlug(hierarchy, PREFERRED_DEFAULT_CITY) !== null;
}

/** A species present in the loaded scores — populates the map filter dropdown. */
export interface SpeciesOption {
  id: string;
  name: string;
  /** Canonical species slug (e.g. "chinook") — used to target alerts. */
  slug: string;
  /** Best score (0–100) across all visible spots for this species, null = unscored. */
  bestScore: number | null;
}

/** Tier text colors safe for use on white/rc-panel backgrounds (ink variants, all pass 4.5:1). */
export const TIER_SCORE_TEXT: Record<Tier, string> = {
  good: "text-rc-good-ink",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor-ink",
  none: "text-rc-ink-mute",
};

// ── Location selector tree ──────────────────────────────────────────

export interface CityNode {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  regionSlug: string;
  regionName: string;
  provinceCode: string;
  spotCount: number;
  bestScore: number | null;
}

export interface RegionNode {
  slug: string;
  name: string;
  provinceCode: string;
  cities: CityNode[];
}

export interface ProvinceNode {
  code: string;
  name: string;
  regions: RegionNode[];
}

export interface ExploreData {
  /** Local (America/Vancouver) date the scores are for. */
  date: string;
  spots: RailSpot[];
  locations: ProvinceNode[];
  /** Best-scoring covered city — the rail's default selection. */
  defaultCitySlug: string | null;
  /** Species that appear in the scores, sorted by name (filter dropdown). */
  species: SpeciesOption[];
}

// ── Formatters ──────────────────────────────────────────────────────

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function compass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export function fmtPeak(hour: number | null): string | null {
  if (hour === null) return null;
  return formatHour12(hour);
}

function fmtWind(c: MapCondCell): string | null {
  if (c.wkt == null) return null;
  const dir = c.wdir != null ? ` ${compass(c.wdir)}` : "";
  return `${Math.round(c.wkt)} kn${dir}`;
}

function seaState(wav: number | null): string | null {
  if (wav == null) return null;
  if (wav < 0.2) return "Calm";
  if (wav < 0.5) return "Light";
  if (wav < 1.0) return "Light Chop";
  if (wav < 2.0) return "Moderate";
  return "Rough";
}

function fmtTide(c: MapCondCell): string | null {
  if (c.tide == null) return null;
  const h = `${c.tide >= 0 ? "+" : ""}${c.tide.toFixed(1)}m`;
  if (!c.tph) return h;
  if (c.tph.startsWith("flood")) return `${h} ▲`;
  if (c.tph.startsWith("ebb")) return `${h} ▼`;
  return `${h} ·`; // slack
}

function fmtCurrent(cur: number | null): string | null {
  if (cur == null) return null;
  if (cur < 0.15) return "Slack";
  return `${cur.toFixed(1)} kn`;
}

function skyWord(cld: number | null, pcp: number | null): string | null {
  if (pcp != null && pcp >= 0.2) return "Rain";
  if (cld == null) return null;
  if (cld < 25) return "Clear";
  if (cld < 70) return "Cloudy";
  return "Overcast";
}

function fmtAir(air: number | null): string | null {
  return air == null ? null : `${Math.round(air)}°C`;
}

export function formatConditions(cell: MapCondCell | null): RailConditions {
  if (!cell)
    return { wind: null, sea: null, tide: null, current: null, sky: null, air: null };
  return {
    wind: fmtWind(cell),
    sea: seaState(cell.wav),
    tide: fmtTide(cell),
    current: fmtCurrent(cell.cur),
    sky: skyWord(cell.cld, cell.pcp),
    air: fmtAir(cell.air),
  };
}

/**
 * UTC instant for a wall-clock hour of a calendar day in a timezone —
 * "2026-07-16 @ 14:00 America/Vancouver" → "2026-07-16T21:00:00.000Z".
 * Feeds the currents-field `time` param so the animated flow matches the
 * scrubbed hour. Two correction passes handle DST-transition days.
 */
export function zonedHourToUtcIso(
  dateIso: string,
  hour: number,
  tz: string,
): string | null {
  // `Intl.DateTimeFormat.formatToParts` throws RangeError on a non-finite date
  // rather than returning something falsy, so a malformed `dateIso` or an
  // out-of-range `hour` used to take the whole page down: the throw escaped
  // into Next's root error boundary, which replaces the entire tree. Returning
  // null instead degrades the one feature that needed the instant. Callers
  // already handle null, because this is passed straight into optional params.
  const wallUtc = Date.parse(`${dateIso}T${String(hour).padStart(2, "0")}:00:00Z`);
  if (!Number.isFinite(wallUtc)) return null;
  const asWall = (ms: number): number => {
    const p: Record<string, string> = {};
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(ms))
      .forEach((x) => {
        p[x.type] = x.value;
      });
    const hh = p.hour === "24" ? "00" : p.hour;
    return Date.parse(`${p.year}-${p.month}-${p.day}T${hh}:${p.minute}:${p.second}Z`);
  };
  // Fixed-point iteration: adjust the guess until the zone's wall clock at
  // `utc` reads the requested hour (second pass settles DST-transition days).
  // Re-checked each pass: `asWall` reassembles a date from formatted parts, so
  // an unexpected calendar or numbering system yields NaN, and feeding that
  // back would throw on the next pass instead of just being wrong.
  let utc = wallUtc;
  for (let i = 0; i < 2; i++) {
    const wall = asWall(utc);
    if (!Number.isFinite(wall)) return null;
    utc += wallUtc - wall;
    if (!Number.isFinite(utc)) return null;
  }
  return new Date(utc).toISOString();
}

/**
 * Local hour (0–23) in the given timezone at a given instant.
 *
 * `at` is explicit so a cached page can render the *server's* instant on both
 * sides of hydration instead of each side reading its own clock.
 */
export function currentLocalHour(tz: string, at: Date = new Date()): number {
  // `Intl` throws RangeError on an Invalid Date, and an hour is used to index
  // hourly arrays, so returning NaN would only move the failure. An invalid
  // instant falls back to the real clock — see `useSpotClock` for how a prop
  // from a stale payload gets here.
  const when = Number.isFinite(at.getTime()) ? at : new Date();
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(when),
  ) % 24;
}

/**
 * Short zone label ("PDT") for a timezone at a given instant.
 *
 * Takes the instant explicitly because it is not constant: the same zone is
 * "PST" or "PDT" depending on the date. On a cached page the server and the
 * client evaluate it at different moments, so the caller has to be deliberate
 * about which instant it means rather than letting each side pick its own.
 */
export function zoneAbbrev(tz: string, at: Date = new Date()): string {
  // formatToParts throws RangeError on a non-finite date. A missing zone label
  // is a cosmetic loss; a throw here would blank the page.
  if (!Number.isFinite(at.getTime())) return "";
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Display name overrides (UI label → cleaner than the API name) ───
const SPECIES_DISPLAY: Record<string, string> = {
  "Shrimp including prawn": "Shrimp & Prawns",
};

export function speciesDisplayName(name: string): string {
  return SPECIES_DISPLAY[name] ?? name;
}

// ── Scoring derivation (shared by build + day re-scoring) ───────────

type SpeciesDict = Record<string, { id: string; slug: string; name: string }>;

interface ScoringFields {
  score: number | null;
  bestSpeciesId: string | null;
  driverSpecies: string | null;
  peakHour: number | null;
  conditions: RailConditions;
  condStrip: MapCondStrip | null;
  hours24: (number | null)[];
  scoresBySpecies: Record<string, number>;
}

const EMPTY_SCORING: ScoringFields = {
  score: null,
  bestSpeciesId: null,
  driverSpecies: null,
  peakHour: null,
  conditions: { wind: null, sea: null, tide: null, current: null, sky: null, air: null },
  condStrip: null,
  hours24: new Array(24).fill(null),
  scoresBySpecies: {},
};

/**
 * Pull a spot's display fields out of a map/spots entry. `atHour` is the
 * conditions hour to read; pass the current local hour for "today" and an
 * out-of-range hour (e.g. -1) for future dates so it falls back to the
 * peak hour (there is no "now" on a future day).
 */
function deriveScoring(
  entry: MapSpotEntry | undefined,
  speciesDict: SpeciesDict,
  atHour: number,
): ScoringFields {
  if (!entry) return EMPTY_SCORING;
  const strip = entry.best_species_id
    ? entry.scores[entry.best_species_id]
    : undefined;
  const score = strip ? Math.round(strip.peak * 100) : null;
  const cell =
    entry.conditions?.[atHour] ??
    (strip ? entry.conditions?.[strip.peak_hour] : null) ??
    null;
  // Peak score per species (0–100) so the map filter can re-color by species.
  const scoresBySpecies: Record<string, number> = {};
  for (const [sid, sp] of Object.entries(entry.scores ?? {})) {
    scoresBySpecies[sid] = Math.round(sp.peak * 100);
  }
  return {
    score,
    bestSpeciesId: entry.best_species_id,
    driverSpecies: entry.best_species_id
      ? speciesDisplayName(speciesDict[entry.best_species_id]?.name ?? "")
      : null,
    peakHour: strip?.peak_hour ?? null,
    conditions: formatConditions(cell),
    condStrip: entry.conditions ?? null,
    hours24: strip
      ? strip.hours.map((h) => (h ? Math.round(h.s * 100) : null))
      : new Array(24).fill(null),
    scoresBySpecies,
  };
}

/** Species options carried by a payload, for merging into the filter list. */
export function speciesOptionsFromPayload(
  payload: MapSpotsPayload,
  spots: RailSpot[],
): SpeciesOption[] {
  const best: Record<string, number> = {};
  for (const spot of spots) {
    for (const [sid, score] of Object.entries(spot.scoresBySpecies)) {
      if (!(sid in best) || score > best[sid]) best[sid] = score;
    }
  }
  return Object.keys(best).map((id) => ({
    id,
    name: speciesDisplayName(payload.species[id]?.name ?? id),
    slug: payload.species[id]?.slug ?? id,
    bestScore: best[id] ?? null,
  }));
}

/**
 * Build rail spots for payload entries the base set doesn't have.
 *
 * The base set comes from the server render, which is anonymous — it can't
 * include the viewer's own custom spots. When the client refetches map/spots
 * with the session token, BlueCaster adds those spots to the payload; this
 * turns them into RailSpots so they rank, filter, and open a card exactly like
 * curated ones. Location metadata is borrowed from a known spot in the same
 * city (the payload carries only `city_slug`).
 *
 * Being absent from the base set does NOT make a spot yours. The base list is
 * built from the hierarchy, which the server render caches for an hour, so a
 * spot published in the last hour is missing from it while the viewer payload
 * (no-store) already carries it. Treating that gap as ownership marked freshly
 * published spots as private customs — and auto-favorited them, permanently,
 * since the star is a localStorage write.
 *
 * Ownership is stated, never inferred: `entry.owned` comes straight from
 * BlueCaster, which sets it on exactly the spots it added for this caller.
 * `visibilityBySlug` (the angler's own /anglers/[id]/spots list) is the
 * fallback for payloads predating that flag, and supplies the public/private
 * badge either way. Anything else joins the rail as the ordinary spot it is.
 */
export function extraRailSpotsFromPayload(
  base: RailSpot[],
  payload: MapSpotsPayload,
  isToday: boolean,
  visibilityBySlug: Map<string, "private" | "public">,
): RailSpot[] {
  const known = new Set(base.map((s) => s.slug));
  const cityMeta = new Map(base.map((s) => [s.citySlug, s]));

  return payload.spots
    .filter((entry) => !known.has(entry.slug))
    .map((entry) => {
      const near = cityMeta.get(entry.city_slug ?? "");
      const visibility = visibilityBySlug.get(entry.slug);
      return {
        ...railSpotFromEntry(entry, payload, isToday),
        cityName: near?.cityName ?? "",
        regionSlug: near?.regionSlug ?? "",
        regionName: near?.regionName ?? "",
        provinceCode: near?.provinceCode ?? "",
        isCustom: entry.owned === true || visibility !== undefined,
        ...(visibility !== undefined ? { visibility } : {}),
      } satisfies RailSpot;
    });
}

/**
 * One map/spots entry → a RailSpot, scores and conditions derived the same way
 * the rail does it. The payload carries only `city_slug`, so region/province
 * come back blank — callers that need them fill them in. Lets surfaces outside
 * Explore (the dashboard) render the same card from the same numbers.
 */
export function railSpotFromEntry(
  entry: MapSpotEntry,
  payload: MapSpotsPayload,
  isToday: boolean,
): RailSpot {
  const atHour = isToday ? currentLocalHour(payload.tz) : -1;
  return {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    lat: entry.lat,
    lng: entry.lng,
    citySlug: entry.city_slug ?? "",
    cityName: "",
    regionSlug: "",
    regionName: "",
    provinceCode: "",
    distanceKm: null,
    hasReports: entry.has_reports === true,
    ...deriveScoring(entry, payload.species, atHour),
  };
}

/**
 * Where a city sits, flattened out of the location tree.
 *
 * The spot payload carries only `city_slug`; region, province, and the city
 * centre (for `distanceKm`) have to be joined on. The server does that against
 * the hierarchy, but the client only ever receives the built `locations` tree,
 * so this is the shape both sides can index by.
 */
export interface CityPlace {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  regionSlug: string;
  regionName: string;
  provinceCode: string;
}

/** city_slug → place, for joining a spot payload fetched in the browser. */
export function cityIndexFromLocations(
  locations: ProvinceNode[],
): Map<string, CityPlace> {
  const index = new Map<string, CityPlace>();
  for (const prov of locations) {
    for (const region of prov.regions) {
      for (const city of region.cities) {
        index.set(city.slug, {
          slug: city.slug,
          name: city.name,
          lat: city.lat,
          lng: city.lng,
          regionSlug: region.slug,
          regionName: region.name,
          provinceCode: prov.code,
        });
      }
    }
  }
  return index;
}

/**
 * Spot-payload entries → located, scored RailSpots.
 *
 * Extracted from `buildExploreData` so the browser can turn a payload fetched
 * for a new viewport into the same rows the server produced for the opening
 * one — Explore loads spots as the map moves now, rather than shipping every
 * spot in BC, WA and OR up front.
 *
 * Entries whose city is not in the covered tree are dropped: they have nowhere
 * to sit in the rail's grouping. That has always been the rule here.
 */
export function railSpotsFromPayload(
  payload: MapSpotsPayload,
  cities: Map<string, CityPlace>,
  isToday: boolean,
): RailSpot[] {
  const atHour = isToday ? currentLocalHour(payload.tz) : -1;
  const out: RailSpot[] = [];
  for (const entry of payload.spots) {
    const place = entry.city_slug ? cities.get(entry.city_slug) : undefined;
    if (!place) continue;
    const s = deriveScoring(entry, payload.species, atHour);
    out.push({
      id: entry.id,
      slug: entry.slug,
      name: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      citySlug: place.slug,
      cityName: place.name,
      regionSlug: place.regionSlug,
      regionName: place.regionName,
      provinceCode: place.provinceCode,
      distanceKm:
        Number.isFinite(place.lat) && Number.isFinite(place.lng)
          ? Math.round(haversineKm(place.lat, place.lng, entry.lat, entry.lng))
          : null,
      hasReports: entry.has_reports === true,
      ...s,
    });
  }
  return out;
}


// ── Build ───────────────────────────────────────────────────────────

/**
 * Fold the hierarchy tree + the bbox-scoped map payload into everything the
 * Explore shell renders.
 *
 * The spot list is built from the MAP PAYLOAD, not the tree. The tree supplies
 * only places — which is why Explore fetches it with `spots=0`. It used to walk
 * `city.spots[]`, which meant the page server-rendered every approved spot in
 * the database on every load, so the payload grew with the database rather than
 * with what was on screen. The payload already carries each spot's `city_slug`,
 * so region/province resolve through the city index below.
 */
export function buildExploreData(
  // Takes either tree shape. Explore and the marketing map fetch the light one;
  // /fishing/[province]/[city] already needs the full one for its own spot
  // lists, so it would gain nothing from a second request.
  hierarchy: BlueCasterHierarchy | BlueCasterHierarchyLight | null,
  payload: MapSpotsPayload | null,
): ExploreData {
  const spots: RailSpot[] = [];
  const locations: ProvinceNode[] = [];

  const speciesDict = payload?.species ?? {};
  const nowHour = payload ? currentLocalHour(payload.tz) : 0;

  // How many payload spots landed in each city, so a city with coverage but
  // nothing in this bbox can still be told apart from an empty one.
  const payloadSpotsByCity = new Map<string, number>();
  for (const s of payload?.spots ?? []) {
    if (!s.city_slug) continue;
    payloadSpotsByCity.set(s.city_slug, (payloadSpotsByCity.get(s.city_slug) ?? 0) + 1);
  }

  // city_slug → its place in the tree. One pass, so the spot loop below is
  // O(spots) rather than O(spots × cities).
  const cityIndex = new Map<
    string,
    {
      city: HierarchyCity | HierarchyCityLight;
      regionSlug: string;
      regionName: string;
      provinceCode: string;
    }
  >();

  for (const country of hierarchy?.countries ?? []) {
    for (const sp of country.states_provinces) {
      if (!(COVERED_PROVINCES as readonly string[]).includes(sp.code)) continue;
      const provinceNode: ProvinceNode = {
        code: sp.code,
        name: sp.name,
        regions: [],
      };

      for (const region of sp.regions) {
        const regionNode: RegionNode = {
          slug: region.slug,
          name: region.name,
          provinceCode: sp.code,
          cities: [],
        };

        for (const city of region.cities) {
          cityIndex.set(city.slug, {
            city,
            regionSlug: region.slug,
            regionName: region.name,
            provinceCode: sp.code,
          });

          // This counts every published spot the city owns — NOT just the ones
          // in this bbox. Keeping it authoritative is the point: the browse
          // list should read "16 spots" for Sooke whether or not you happen to
          // be looking at Sooke right now.
          const spotCount = publishedSpotCount(city);
          if (spotCount > 0) {
            regionNode.cities.push({
              slug: city.slug,
              name: city.name,
              lat: city.lat,
              lng: city.lng,
              regionSlug: region.slug,
              regionName: region.name,
              provinceCode: sp.code,
              spotCount,
              bestScore: null, // filled from the payload below
            });
          }
        }

        if (regionNode.cities.length > 0) provinceNode.regions.push(regionNode);
      }

      if (provinceNode.regions.length > 0) locations.push(provinceNode);
    }
  }

  // Now the spots themselves, straight off the payload.
  const bestScoreByCity = new Map<string, number>();
  for (const entry of payload?.spots ?? []) {
    const place = entry.city_slug ? cityIndex.get(entry.city_slug) : undefined;
    // A spot whose city isn't in the covered tree (an uncovered province, or a
    // custom spot filed against a city we don't render) has nowhere to sit in
    // the rail's grouping, so it's dropped here exactly as it was before.
    if (!place) continue;

    const s = deriveScoring(entry, speciesDict, nowHour);
    const { city, regionSlug, regionName, provinceCode } = place;

    spots.push({
      id: entry.id,
      slug: entry.slug,
      name: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      citySlug: city.slug,
      cityName: city.name,
      regionSlug,
      regionName,
      provinceCode,
      score: s.score,
      bestSpeciesId: s.bestSpeciesId,
      driverSpecies: s.driverSpecies,
      peakHour: s.peakHour,
      distanceKm:
        Number.isFinite(city.lat) && Number.isFinite(city.lng)
          ? Math.round(haversineKm(city.lat, city.lng, entry.lat, entry.lng))
          : null,
      conditions: s.conditions,
      condStrip: s.condStrip,
      hours24: s.hours24,
      scoresBySpecies: s.scoresBySpecies,
      hasReports: entry.has_reports === true,
    });

    if (s.score !== null) {
      const prev = bestScoreByCity.get(city.slug);
      if (prev === undefined || s.score > prev) bestScoreByCity.set(city.slug, s.score);
    }
  }

  // bestScore stays payload-derived — it always was, since scores only exist
  // there. A city outside the fetched bbox simply has none yet.
  for (const prov of locations) {
    for (const region of prov.regions) {
      for (const city of region.cities) {
        city.bestScore = bestScoreByCity.get(city.slug) ?? null;
      }
      region.cities.sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
    }
  }

  // Spots sort by score desc (nulls last) within the whole set; the rail
  // filters by city, so per-city order falls out of this.
  spots.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // Collapse to one entry per slug. The payload carries a spot once, so this
  // is now a safety net rather than the fix it was when this walked city
  // memberships and pushed a shared spot (Race Rocks ∈ Sooke + Cowichan) once
  // per member city. A duplicate slug trips a React key warning downstream and
  // can drop a card, so it stays. Score-sorted above, so the best copy wins.
  {
    const seenSlugs = new Set<string>();
    let w = 0;
    for (let r = 0; r < spots.length; r++) {
      if (seenSlugs.has(spots[r].slug)) continue;
      seenSlugs.add(spots[r].slug);
      spots[w++] = spots[r];
    }
    spots.length = w;
  }

  // The page opens on the flagship/pilot city (Victoria) when it's covered, so
  // it lands on the bathymetry-rich Juan de Fuca coastline rather than whichever
  // city happens to score highest that day. Falls back to best-scoring otherwise.
  let bestScoringSlug: string | null = null;
  let best = -1;
  let hasPreferred = false;
  for (const prov of locations) {
    for (const region of prov.regions) {
      for (const city of region.cities) {
        if (city.slug === PREFERRED_DEFAULT_CITY) hasPreferred = true;
        if ((city.bestScore ?? -1) > best) {
          best = city.bestScore ?? -1;
          bestScoringSlug = city.slug;
        }
      }
    }
  }
  const defaultCitySlug = hasPreferred ? PREFERRED_DEFAULT_CITY : bestScoringSlug;

  // Species that actually carry scores — build with best score across all spots,
  // sorted by score desc so the best-performing species leads the filter list.
  const speciesBest: Record<string, number> = {};
  for (const spot of spots) {
    for (const [sid, score] of Object.entries(spot.scoresBySpecies)) {
      if (!(sid in speciesBest) || score > speciesBest[sid]) speciesBest[sid] = score;
    }
  }
  const species: SpeciesOption[] = Object.keys(speciesBest)
    .map((id) => ({
      id,
      name: speciesDisplayName(speciesDict[id]?.name ?? id),
      slug: speciesDict[id]?.slug ?? id,
      bestScore: speciesBest[id] ?? null,
    }))
    .sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));

  return {
    date: payload?.date ?? "",
    spots,
    locations,
    defaultCitySlug,
    species,
  };
}
