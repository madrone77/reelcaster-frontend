// BlueCaster API client
// The API returns a nested response; we normalize it for components

import type {
  SpotPageInitial,
  Forecast14dPayload,
  SpotScorePayload,
  PointConditions,
} from "./bluecaster/live-spot-types";
import type { IntelEvidence, PoolIntelligence } from "./bluecaster/intel-types";
import type { CatchPreviewResponse } from "./bluecaster/catch-ingest-types";

export type {
  SpotPageInitial,
  Forecast14dPayload,
  SpotScorePayload,
  PointConditions,
} from "./bluecaster/live-spot-types";
export type {
  IntelEvidence,
  PoolIntelligence,
} from "./bluecaster/intel-types";
export type { CatchPreviewResponse } from "./bluecaster/catch-ingest-types";

export interface BlueCasterCityPage {
  page: {
    slug: string;
    status: string;
    published_at: string | null;
    hero: {
      image_url: string | null;
      image_alt: string | null;
      breadcrumb: Array<{ label: string; href: string }>;
      h1: string;
      species_chips: Array<{ slug: string; name: string }>;
    };
    seo: {
      title: string;
      meta_description: string;
      canonical_url: string | null;
      og_image_url: string | null;
    };
    about_md: string | null;
    local_intel_md: string | null;
    techniques: string[];
    faq: Array<{ q: string; a: string }>;
    last_edited_at: string | null;
  };
  hierarchy: {
    country: { name: string; code: string };
    province: { name: string; code: string };
    region: { name: string | null; slug: string | null };
    city: { name: string; slug: string; lat: number; lng: number };
  };
  conditions_now: {
    temp_c: number;
    wind_kn: number;
    wind_gusts_kn: number;
    water_temp_c: number;
    tide_high: { ft: number; time: string };
    tide_low: { ft: number; time: string };
    tide_now_ft: number;
    swell_m: number;
    fetched_at: string;
  } | null;
  rc_score_today: number | null;
  species_table: Array<{
    species_id: string;
    species_name: string;
    species_slug: string;
    months: Record<string, string | null>;
    daily_limit: number | null;
    size_limit_cm: number | null;
    status: "open" | "non_retention" | "closed" | null;
  }>;
  regulatory_areas: Array<{
    body: string;
    area_number: string;
    name: string;
  }>;
  seasonal_guide: Array<{
    quarter: string;
    label: string;
    quality: string | null;
    peak_species: Array<{ slug: string; name: string }>;
  }>;
  access_points: Array<{
    id: string;
    name: string;
    type: string;
    notes: string | null;
  }>;
  charters: Array<{
    id: string;
    name: string;
    photo_url: string | null;
    photo_alt: string | null;
    rating: number | null;
    review_count: number | null;
    phone: string | null;
    website: string | null;
    business_type: string;
  }>;
  meta: {
    generated_at: string;
  };
}

export async function fetchCityPage(
  slug: string
): Promise<BlueCasterCityPage | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/cities/${slug}/page`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

// ── Spot pages ──────────────────────────────────────────────────────

export interface BlueCasterSpotPage {
  page: {
    slug: string;
    status: string;
    published_at: string | null;
    hero: {
      image_url: string | null;
      image_alt: string | null;
      breadcrumb: Array<{ label: string; href: string }>;
      h1: string;
    };
    seo: {
      title: string;
      meta_description: string;
      canonical_url: string | null;
      og_image_url: string | null;
    };
    about_md: string | null;
    local_intel_md: string | null;
    techniques: string[];
    faq: Array<{ q: string; a: string }>;
    last_edited_at: string | null;
  };
  spot: {
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    depth_avg_m: number | null;
    dfo_area_label: string | null;
    tidal_station_name: string | null;
  };
  hierarchy: {
    country: { name: string; code: string };
    province: { name: string; code: string };
    region: { name: string | null; slug: string | null };
    city: { name: string; slug: string; lat: number; lng: number };
  } | null;
  rc_score_now: {
    score: number;
    species_id: string;
    species_name: string;
    stock_id: string;
    state: "peak" | "mid" | "off" | "closed";
    factor_contributions: unknown | null;
    fresh_signal: unknown | null;
    hour_utc: string;
  } | null;
  forecast: {
    forecast_version: number;
    horizon_hours: number;
    rows: Array<{
      species_id: string;
      stock_id: string;
      hour_utc: string;
      score: number;
    }>;
  };
  species_table: Array<{
    species_id: string;
    species_name: string;
    species_slug: string;
    months: Record<string, string | null>;
    daily_limit: number | null;
    size_limit_cm: number | null;
    status: "open" | "non_retention" | "closed" | null;
  }>;
  seasonal_abundance: Array<{
    species_id: string;
    species_name: string;
    species_slug: string;
    monthly_weights: number[];
  }>;
  access_points: Array<{
    id: string;
    name: string;
    type: string;
    notes: string | null;
    distance_km: number;
  }>;
  local_experts: Array<{
    review_session_id: string;
    guide_name: string;
    submitted_at: string;
    verified_spot_count: number;
  }>;
  meta: {
    generated_at: string;
    forecast_version: number;
  };
}

export async function fetchSpotPage(
  slug: string
): Promise<BlueCasterSpotPage | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/spots/${slug}/page`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

// ── Live spot page (composite live-data payload) ───────────────────────
//
// `/spot-page` returns the today-only initial slice (~40 KB); `/forecast-14d`
// returns the full 14-day extended grid (~65 KB) and is lazy-fetched from
// the client component after first paint. Shape: see lib/bluecaster/live-spot-types.

export async function fetchSpotLivePage(
  slug: string
): Promise<SpotPageInitial | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/spots/${slug}/spot-page`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

export async function fetchSpotForecast14d(
  slug: string
): Promise<Forecast14dPayload | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/spots/${slug}/forecast-14d`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

// Per-hour factor breakdown for a spot×species over `days` (default 1).
// Multi-day mode of the score endpoint — each hour carries the full
// factor_contributions used by the spot-detail "Score explained" charts.
export async function fetchSpotScore(
  spotId: string,
  speciesId: string,
  days = 1
): Promise<SpotScorePayload | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const qs = new URLSearchParams({ species: speciesId, days: String(days) });
  const res = await fetch(
    `${baseUrl}/api/v1/fishing-spots/${spotId}/score?${qs}`,
    { headers: { "x-api-key": apiKey }, cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

// Single-point conditions (pressure + trend, minutes-to-slack, moon) — the
// fields the spot-page payload omits. Path is NOT under /api/v1.
export async function fetchPointConditions(
  lat: number,
  lng: number
): Promise<PointConditions | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`${baseUrl}/api/map/point-conditions?${qs}`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 120 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

export async function fetchPublishedSpots(): Promise<
  Array<{
    slug: string;
    province_code: string;
    city_slug: string;
    published_at: string | null;
  }>
> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return [];

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/admin/spot-pages?status=published`,
      {
        headers: { "x-api-key": apiKey },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.pages ?? [];
  } catch {
    return [];
  }
}

// ── Bulk map spots (scores + conditions) ───────────────────────────
// Shapes mirror bluecaster lib/bluecaster/map/spots-scores.ts and
// spots-conditions.ts. Hour scores are 0..1 — multiply by 100 exactly
// once, in src/app/explore/lib/explore-data.ts.

export interface MapHourScore {
  s: number; // score 0..1
  r: 0;
}

export interface MapSpeciesStrip {
  peak: number; // best hourly score across the day (0..1)
  peak_hour: number; // local hour 0..23 of the peak
  hours: (MapHourScore | null)[]; // length 24, null = unavailable
  season: "peak" | "mid" | "off";
}

export interface MapCondCell {
  wkt: number | null; // wind speed (kt)
  wdir: number | null; // wind direction (deg, FROM)
  wav: number | null; // sea/wave height (m)
  tide: number | null; // tide height (m)
  tph: string | null; // tide phase (e.g. "flood_late", "slack_high")
}

export type MapCondStrip = (MapCondCell | null)[]; // length 24

export interface MapSpotEntry {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  city_slug: string | null;
  best_species_id: string | null;
  scores: Record<string, MapSpeciesStrip>;
  conditions: MapCondStrip | null;
}

export interface MapSpotsPayload {
  date: string; // YYYY-MM-DD in America/Vancouver
  tz: string;
  forecast_version: number;
  hours_utc: string[]; // 24 ISO instants; index i = local hour i
  species: Record<string, { id: string; slug: string; name: string }>;
  spots: MapSpotEntry[];
}

export async function fetchMapSpots(opts: {
  bbox?: string; // "w,s,e,n"
  city?: string;
  date?: string; // YYYY-MM-DD
}): Promise<MapSpotsPayload | null> {
  return bcGet<MapSpotsPayload>("/api/v1/map/spots", {
    bbox: opts.bbox,
    city: opts.city,
    date: opts.date,
  });
}

// ── Hierarchy (regions index) ───────────────────────────────────────

export interface BlueCasterHierarchy {
  countries: Array<{
    id: string;
    name: string;
    code: string;
    states_provinces: Array<{
      id: string;
      name: string;
      code: string;
      type: string;
      regions: Array<{
        id: string;
        name: string;
        slug: string;
        cities: Array<{
          id: string;
          name: string;
          slug: string;
          lat: number;
          lng: number;
          spots: Array<{
            id: string;
            name: string;
            slug: string;
            lat: number;
            lng: number;
            is_published: boolean;
          }>;
        }>;
      }>;
    }>;
  }>;
}

export async function fetchHierarchy(): Promise<BlueCasterHierarchy | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/api/v1/hierarchy`, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @deprecated Use `fetchPublicCities()` (Phase 1 public endpoint) instead.
 * Kept for back-compat with callers that still expect the admin shape.
 */
export async function fetchPublishedCities() {
  // Reroute to the new public endpoint and adapt shape so old callers keep working.
  const items = await fetchPublicCities({ status: "published", limit: 100 });
  return items.map((c) => ({
    slug: c.slug,
    city: { name: c.name, slug: c.city_slug },
    hero_image_url: c.hero_image_url,
    seo_meta_description: c.seo_meta_description,
    published_at: c.published_at,
    province: c.province,
  }));
}

// =============================================================================
// Phase 7 — by-coordinates enrichment
// =============================================================================

export interface BlueCasterByCoordinates {
  query: { lat: number; lng: number; radius_km: number };
  nearest_city: {
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    distance_km: number;
  } | null;
  region: { name: string; slug: string | null } | null;
  province: { code: string; name: string | null } | null;
  nearest_tide_station: {
    id: string;
    name: string;
    source: string;
    source_id: string;
    time_offset_minutes: number | null;
    distance_km: number;
  } | null;
  dfo: {
    area_id: string | null;
    subarea_id: string | null;
    name: string | null;
    region: string | null;
    managed_species: string[];
    match: "bbox" | "nearest_spot_fallback";
  } | null;
  nearby_spots: Array<{
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    distance_km: number;
  }>;
  suggested_species: {
    species: Array<{ slug: string; rank: number; confidence: number }>;
    updated_at: string;
  };
}

export async function fetchSpotsByCoordinates(
  lat: number,
  lng: number,
  radiusKm = 50,
): Promise<BlueCasterByCoordinates | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/spots/by-coordinates?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`,
      {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as BlueCasterByCoordinates;
  } catch {
    return null;
  }
}

// =============================================================================
// Phase 8 — search
// =============================================================================

export interface BlueCasterSearchResult {
  type: "spot" | "city" | "species";
  id: string;
  name: string;
  slug: string | null;
  lat?: number;
  lng?: number;
  subtitle: string;
  href: string | null;
  city_slug?: string | null;
  province_code?: string | null;
}

export interface BlueCasterSearchResponse {
  query: string;
  results: BlueCasterSearchResult[];
  counts: { spots: number; cities: number; species: number };
}

export async function searchBlueCaster(
  q: string,
  type: "spot" | "city" | "species" | "all" = "all",
): Promise<BlueCasterSearchResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return null;

  const url = new URL(`${baseUrl}/api/v1/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("type", type);

  try {
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as BlueCasterSearchResponse;
  } catch {
    return null;
  }
}

// =============================================================================
// Phase 1 — public endpoints (cities list, province cities, city spots, species, multi-day score)
// =============================================================================

function bcEnv(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

async function bcGet<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
  revalidate = 300,
): Promise<T | null> {
  const env = bcEnv();
  if (!env) return null;
  const url = new URL(`${env.baseUrl}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": env.apiKey },
      next: { revalidate },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Public cities list ─────────────────────────────────────────────

export interface BlueCasterPublicCity {
  slug: string;
  name: string | null;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  province: string | null;
  province_name: string | null;
  region_label: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  seo_title: string | null;
  seo_meta_description: string | null;
  published_at: string | null;
  featured: boolean;
}

export interface FetchPublicCitiesOpts {
  province?: string;
  status?: "published" | "draft" | "archived";
  order?: "alpha" | "featured";
  limit?: number;
}

export async function fetchPublicCities(
  opts: FetchPublicCitiesOpts = {},
): Promise<BlueCasterPublicCity[]> {
  const data = await bcGet<{ cities: BlueCasterPublicCity[] }>("/api/v1/cities", {
    province: opts.province,
    status: opts.status,
    order: opts.order,
    limit: opts.limit,
  });
  return data?.cities ?? [];
}

// ── Province → cities ──────────────────────────────────────────────

export interface BlueCasterProvinceCitiesResponse {
  province: { code: string; name: string; type: string | null };
  cities: BlueCasterPublicCity[];
  meta: { total: number; returned: number };
}

export async function fetchProvinceCities(
  code: string,
  opts: { limit?: number } = {},
): Promise<BlueCasterProvinceCitiesResponse | null> {
  return bcGet<BlueCasterProvinceCitiesResponse>(
    `/api/v1/provinces/${encodeURIComponent(code)}/cities`,
    { limit: opts.limit },
  );
}

// ── City → spots ───────────────────────────────────────────────────

export interface BlueCasterCitySpot {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
}

export async function fetchCitySpots(
  citySlug: string,
): Promise<BlueCasterCitySpot[]> {
  const data = await bcGet<{ spots: BlueCasterCitySpot[] }>(
    `/api/v1/cities/${encodeURIComponent(citySlug)}/spots`,
  );
  return data?.spots ?? [];
}

// ── Species ────────────────────────────────────────────────────────

export interface BlueCasterSpeciesSummary {
  id: string;
  slug: string;
  name: string;
  scientific_name: string | null;
  family: string | null;
  seasonal_calendar: unknown;
}

export async function fetchSpeciesList(
  opts: { limit?: number; q?: string } = {},
): Promise<BlueCasterSpeciesSummary[]> {
  const data = await bcGet<{ species: BlueCasterSpeciesSummary[] }>(
    "/api/v1/species",
    { limit: opts.limit, q: opts.q },
  );
  return data?.species ?? [];
}

export interface BlueCasterSpeciesDetail {
  species: BlueCasterSpeciesSummary & {
    behavior_profile: unknown;
  };
  featured_cities: Array<{
    page_slug: string;
    name: string | null;
    city_slug: string | null;
    province: string | null;
    blurb: string | null;
  }>;
  top_spots: Array<{
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    rank: number | null;
    confidence: number | null;
    peak_season_months: number[];
  }>;
  meta: { featured_cities_count: number; top_spots_count: number };
}

export async function fetchSpecies(
  slug: string,
): Promise<BlueCasterSpeciesDetail | null> {
  return bcGet<BlueCasterSpeciesDetail>(
    `/api/v1/species/${encodeURIComponent(slug)}`,
  );
}

// ── Multi-day / multi-species spot forecast ────────────────────────

export interface BlueCasterMultiDayForecast {
  spot_id: string;
  species_ids: string[];
  forecast_version: number;
  days: Array<{
    date: string; // YYYY-MM-DD
    species: Record<
      string,
      {
        best_score: number | null;
        best_hour_utc: string | null;
        hours: Array<{
          hour_utc: string;
          stocks: Array<{
            stock_id: string;
            score: number;
            factor_contributions: unknown;
            regulatory_state: string | null;
          }>;
        }>;
      }
    >;
  }>;
  meta: {
    days_requested: number;
    days_returned: number;
    species_count: number;
    first_hour_utc: string;
    last_hour_utc: string;
  };
}

export interface FetchSpotForecastOpts {
  /** Comma-separated species ids OR a single id. Required. */
  species: string | string[];
  /** Forecast horizon in days (1..14). Omit for legacy single-hour mode. */
  days?: number;
  /** ISO datetime, defaults to now. */
  datetime?: string;
}

export async function fetchSpotForecast(
  spotId: string,
  opts: FetchSpotForecastOpts,
): Promise<BlueCasterMultiDayForecast | null> {
  const speciesParam = Array.isArray(opts.species) ? opts.species.join(",") : opts.species;
  return bcGet<BlueCasterMultiDayForecast>(
    `/api/v1/fishing-spots/${encodeURIComponent(spotId)}/score`,
    {
      species: speciesParam,
      days: opts.days,
      datetime: opts.datetime,
    },
    900,
  );
}

// =============================================================================
// Photo-first catch ingest — vision preview (non-destructive)
// =============================================================================

/**
 * Forward an uploaded catch photo to BlueCaster's vision-preview endpoint.
 * Returns AI-extracted species/lure/size, EXIF time+GPS, nearest-spot match
 * (with distance), and a conditions snapshot — used to pre-fill the Log-a-catch
 * form before the angler confirms. Multipart passthrough; never persists.
 */
export async function previewCatchPhoto(
  file: File,
): Promise<CatchPreviewResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const form = new FormData();
  form.append("photo", file, file.name || "catch.jpg");

  const res = await fetch(`${baseUrl}/api/v1/ingest/catch/preview`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as CatchPreviewResponse;
}

// =============================================================================
// Intelligence — "why this score" evidence + community catch pool
// =============================================================================

/**
 * Evidence + algo-variable confidence behind a spot×species score.
 * Keys off the spot UUID + species UUID (note BC's param is `fishing_spot_id`).
 */
export async function fetchIntelEvidence(
  spotId: string,
  speciesId: string,
): Promise<IntelEvidence | null> {
  return bcGet<IntelEvidence>(
    "/api/v1/intel/evidence",
    { fishing_spot_id: spotId, species_id: speciesId },
    60,
  );
}

/**
 * Anonymized community catch-rate aggregates for a spot×species. BlueCaster
 * suppresses buckets where n<5 and gates access; reelcaster's app key reads
 * the public aggregate. `revalidate:0` keeps it live (tracks fresh catches).
 */
export async function fetchPoolIntelligence(
  spotId: string,
  speciesId: string,
  timeWindow: "season" | "month" | "week" = "season",
): Promise<PoolIntelligence | null> {
  return bcGet<PoolIntelligence>(
    "/api/v1/pool/intelligence",
    { spot_id: spotId, species_id: speciesId, time_window: timeWindow },
    0,
  );
}
