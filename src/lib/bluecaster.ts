// BlueCaster API client
// The API returns a nested response; we normalize it for components

import type {
  StationConditions,
  BuoyConditions,
} from "./bluecaster/station-types";
import type {
  SpotPageInitial,
  Forecast14dPayload,
  SpotScorePayload,
  PointConditions,
} from "./bluecaster/live-spot-types";
import type { IntelEvidence, PoolIntelligence } from "./bluecaster/intel-types";
import type {
  CatchPreviewResponse,
  CatchPreviewExtras,
  NearestSpotsResponse,
  SpotSnapshotResponse,
  BlueCasterSpeciesItem,
  CreateCustomSpotResponse,
  PoolCommitPayload,
  PoolCommitResponse,
  SpotScoreHourResponse,
} from "./bluecaster/catch-ingest-types";

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

/**
 * @param ownerUserId  A server-verified user id. BlueCaster 404s a PRIVATE
 *   custom spot to everyone but its owner, so the owner's own page only
 *   renders when we vouch for who is asking. Pass this ONLY after verifying
 *   the session server-side (getUserIdFromRequest) — never from client input.
 */
export async function fetchSpotLivePage(
  slug: string,
  ownerUserId?: string
): Promise<SpotPageInitial | null> {
  return (await fetchSpotLivePageWithCacheControl(slug, ownerUserId)).data;
}

/**
 * As {@link fetchSpotLivePage}, but also hands back BlueCaster's own
 * `Cache-Control`.
 *
 * A proxy route cannot decide on its own whether this payload is shareable.
 * The body depends only on the spot id, so for a spot everyone may see it is
 * identical for every caller, but for a PRIVATE custom spot it must never
 * reach a shared cache. Only BlueCaster knows which this slug is, because only
 * it has the visibility row, and it says so in this header. Mirroring the
 * header is therefore the one way the proxy can cache the shareable case
 * without ever guessing about the private one.
 */
export async function fetchSpotLivePageWithCacheControl(
  slug: string,
  ownerUserId?: string
): Promise<{ data: SpotPageInitial | null; cacheControl: string | null }> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/spots/${slug}/spot-page`, {
    headers: {
      "x-api-key": apiKey,
      ...(ownerUserId ? { "x-reelcaster-user-id": ownerUserId } : {}),
    },
    // An owner-scoped read is private to one user — never put it in the
    // shared Data Cache, or the next anonymous visitor gets served it.
    ...(ownerUserId ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });
  const cacheControl = res.headers.get("cache-control");
  if (res.status === 404) return { data: null, cacheControl };
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return { data: await res.json(), cacheControl };
}

/**
 * @param ownerUserId  A server-verified user id, forwarded so the owner of a
 *   PRIVATE custom spot can read their own 14-day grid (BlueCaster 404s it to
 *   everyone else). Verify the session first — never pass client input.
 */
export async function fetchSpotForecast14d(
  slug: string,
  ownerUserId?: string
): Promise<Forecast14dPayload | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/spots/${slug}/forecast-14d`, {
    headers: {
      "x-api-key": apiKey,
      ...(ownerUserId ? { "x-reelcaster-user-id": ownerUserId } : {}),
    },
    // An owner-scoped read is private to one user — keep it out of the shared
    // Data Cache, or the next anonymous visitor can be served it.
    ...(ownerUserId ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

// Per-hour factor breakdown for a spot×species over `days` (default 1).
// Multi-day mode of the score endpoint — each hour carries the full
// factor_contributions used by the spot-detail "Score explained" charts.
/** @param ownerUserId Server-verified viewer — unlocks their own private spot. */
export async function fetchSpotScore(
  spotId: string,
  speciesId: string,
  days = 1,
  ownerUserId?: string
): Promise<SpotScorePayload | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const qs = new URLSearchParams({ species: speciesId, days: String(days) });
  const res = await fetch(
    `${baseUrl}/api/v1/fishing-spots/${spotId}/score?${qs}`,
    {
      headers: {
        "x-api-key": apiKey,
        ...(ownerUserId ? { "x-reelcaster-user-id": ownerUserId } : {}),
      },
      cache: "no-store",
    }
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
  cur: number | null; // tidal current speed (kn)
  cld: number | null; // cloud cover (%)
  pcp: number | null; // precipitation (mm)
  air: number | null; // air temperature (°C)
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
  /** Scraped catch reports exist for this spot in the 21-day intel window.
   *  Presence only — the counts and the verdict are Pro-gated on
   *  /map/fresh-catches. Riding in this payload is what lets the reports badge
   *  render server-side instead of a second after hydration. Optional so a
   *  cached pre-`has_reports` body still parses. */
  has_reports?: boolean;
  /** Set only on spots the requesting angler created. Absent everywhere else,
   *  including in the anonymous (CDN-cached) payload. */
  owned?: boolean;
}

export interface MapSpotsPayload {
  date: string; // YYYY-MM-DD in America/Vancouver
  tz: string;
  forecast_version: number;
  hours_utc: string[]; // 24 ISO instants; index i = local hour i
  species: Record<string, { id: string; slug: string; name: string }>;
  spots: MapSpotEntry[];
}

export interface SpotCoord {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Coordinates for a known list of slugs — the small read behind the dashboard's
 * first paint. Published spots only, so it is CDN-cacheable; misses are simply
 * absent from the array rather than an error, since a saved favourite can
 * outlive the spot it points at.
 */
export async function fetchSpotCoords(
  slugs: string[],
): Promise<SpotCoord[] | null> {
  if (slugs.length === 0) return [];
  const res = await bcGet<{ spots: SpotCoord[] }>(
    "/api/v1/map/spot-coords",
    { slugs: slugs.join(",") },
    // A spot does not move; the slug list is the whole cache key.
    3600,
  );
  return res?.spots ?? null;
}

export async function fetchMapSpots(opts: {
  bbox?: string; // "w,s,e,n"
  city?: string;
  date?: string; // YYYY-MM-DD
  /**
   * Explicit spot-id scope, upstream's `spots=`. Wins over `city` and `bbox`.
   *
   * For a surface that already knows which spots it draws (the dashboard's
   * saved set) this is the whole ballgame: scoping by extent there meant
   * pulling every published spot in BC and WA — 152 spots, 142 KB gzipped —
   * to render about six. By id the same six are 9 KB.
   *
   * Published-only upstream, so it cannot widen visibility. A viewer's own
   * custom spots still ride along via `viewerId`, narrowed to the ids asked
   * for. Capped at 120 ids upstream.
   */
  spotIds?: string[];
  /** Verified viewer — adds that angler's own custom spots to the payload. */
  viewerId?: string;
}): Promise<MapSpotsPayload | null> {
  return bcGet<MapSpotsPayload>(
    "/api/v1/map/spots",
    {
      spots: opts.spotIds?.length ? opts.spotIds.join(",") : undefined,
      bbox: opts.bbox,
      city: opts.city,
      date: opts.date,
      // Distinct edge cache key for personalized reads. Vercel's CDN keys on
      // the URL and ignores custom headers, so without this the signed-in
      // caller is served whatever anonymous response is already cached for the
      // same bbox — the origin never runs. Identity stays in the header; this
      // is just a flag, so no user id ever lands in a URL or an access log.
      viewer: opts.viewerId ? "1" : undefined,
    },
    300,
    opts.viewerId,
  );
}

// ── Viewport 14-day forecast (map/forecast-14d) ─────────────────────

export interface MapForecastDayPeak {
  score: number; // 0–100 — best hourly score that local day across in-scope spots
  peak_hour: number; // local hour 0–23 of the peak
}

export interface MapForecastBestDay extends MapForecastDayPeak {
  species_id: string;
}

export interface MapForecast14dPayload {
  start: string; // day 0 (today, local)
  tz: string;
  forecast_version: number;
  days: Array<{ iso: string; dow: string; date: string }>; // length 14
  species: Record<string, { id: string; slug: string; name: string }>;
  by_species: Record<string, (MapForecastDayPeak | null)[]>;
  best: (MapForecastBestDay | null)[]; // max across species per day
  meta?: { spots: number };
}

/** Per-day best scores across every published spot in a bbox — the
 *  viewport-driven forecast strip re-fetches this as the map moves. */
export async function fetchMapForecast14d(
  bbox: string,
): Promise<MapForecast14dPayload | null> {
  return bcGet<MapForecast14dPayload>("/api/v1/map/forecast-14d", { bbox }, 120);
}

// ── Per-spot 14-day outlook (map/spot-forecast-14d) ─────────────────

export interface SpotOutlookDayPeak extends MapForecastDayPeak {
  species_id: string; // the species that scored the day at this spot
}

export interface SpotsOutlook14dPayload {
  start: string; // day 0 (today, local)
  tz: string;
  forecast_version: number;
  days: Array<{ iso: string; dow: string; date: string }>; // length 14
  species: Record<string, { id: string; slug: string; name: string }>;
  /** spot id → 14 entries, index i = days[i]. null = no score, or a locked day. */
  by_spot: Record<string, (SpotOutlookDayPeak | null)[]>;
  meta?: { spots: number };
}

/**
 * Per-day best score for EACH spot, rather than one strip folded across the
 * whole viewport. One request backs a whole list of spot cards; scope it by
 * explicit ids (a dashboard's saved + custom spots) or by city.
 *
 * `viewerId` is required for the id scope to reach a caller's own unpublished
 * custom spots, and forces an uncached fetch — one angler's private spots must
 * never land in a shared cache entry.
 */
export async function fetchSpotsOutlook14d(
  scope: { spotIds?: string[]; citySlug?: string; bbox?: string },
  opts: { viewerId?: string } = {},
): Promise<SpotsOutlook14dPayload | null> {
  return bcGet<SpotsOutlook14dPayload>(
    "/api/v1/map/spot-forecast-14d",
    {
      spots: scope.spotIds?.length ? scope.spotIds.join(",") : undefined,
      city: scope.citySlug,
      bbox: scope.bbox,
    },
    120,
    opts.viewerId,
  );
}

// ── Fresh catch reports ─────────────────────────────────────────────

export type FreshCatchVerdict = "strong" | "mixed" | "slow";

export interface FreshCatchSpecies {
  count: number;
  positive: number;
  latest_date: string | null;
}

/** Upstream (ungated) per-spot aggregate. Never hand this to a client as-is —
 *  the Pro gate lives in the /api/bluecaster/map/fresh-catches proxy. */
export interface FreshCatchSpot {
  count: number;
  positive: number;
  verdict: FreshCatchVerdict;
  latest_date: string | null;
  species: Record<string, FreshCatchSpecies>;
}

export interface FreshCatchesPayload {
  since: string;
  days: number;
  spots: Record<string, FreshCatchSpot>; // keyed by spot UUID
}

/** Aggregate scraped catch reports per published spot (21-day window).
 *  Counts and hit/miss only — the endpoint serves no report text. */
export async function fetchFreshCatches(opts: {
  city?: string;
  days?: number;
}): Promise<FreshCatchesPayload | null> {
  return bcGet<FreshCatchesPayload>(
    "/api/v1/map/fresh-catches",
    { city: opts.city, days: opts.days },
    600, // intel moves on the scraper's twice-daily cadence
  );
}

// ── Map station/buoy click panels ───────────────────────────────────

export async function fetchStationConditions(
  source: "chs" | "noaa",
  sid: string,
): Promise<StationConditions | null> {
  // First click on a cold station makes BlueCaster backfill predictions
  // upstream; cache briefly so repeat opens are instant.
  return bcGet<StationConditions>("/api/v1/map/station-conditions", {
    source,
    sid,
  });
}

export async function fetchBuoyConditions(
  sid: string,
): Promise<BuoyConditions | null> {
  return bcGet<BuoyConditions>("/api/v1/map/buoy-conditions", { sid });
}

/**
 * Satellite still for one spot — image bytes, not JSON, so it can't go through
 * `bcGet`. BlueCaster holds the Google Static Maps key; we pass a spot id and
 * get back a rendered PNG. A spot's coordinates never move, so the render is
 * immutable and safe to cache hard.
 */
export async function fetchSpotThumb(
  spotId: string,
  opts: { zoom?: number; size?: "card" | "panel" } = {},
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const env = bcEnv();
  if (!env) return null;
  const url = new URL(`${env.baseUrl}/api/v1/map/spot-thumb`);
  url.searchParams.set("spot", spotId);
  if (opts.zoom) url.searchParams.set("z", String(opts.zoom));
  if (opts.size) url.searchParams.set("size", opts.size);
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": env.apiKey },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return {
      body: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "image/png",
    };
  } catch {
    return null;
  }
}

// ── Hierarchy (regions index) ───────────────────────────────────────

interface HierarchyCityBase {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  /** cities.lifecycle — building | staging | published. */
  lifecycle: string;
}

export interface HierarchyCity extends HierarchyCityBase {
  spots: Array<{
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    is_published: boolean;
  }>;
}

export interface HierarchyCityLight extends HierarchyCityBase {
  /** Published member spots. Replaces `spots[]` when fetched with spots=0. */
  spot_count: number;
}

interface HierarchyTree<C> {
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
        cities: C[];
      }>;
    }>;
  }>;
}

export type BlueCasterHierarchy = HierarchyTree<HierarchyCity>;

/**
 * The place tree WITHOUT the per-city spot arrays — cities carry `spot_count`
 * instead.
 *
 * The full tree inlines every approved/published spot in the database with no
 * pagination, so a page that server-renders it pays a payload cost that grows
 * with the database rather than with what it shows. Explore gets its spots
 * from /api/v1/map/spots (bbox-scoped), so it only ever needed the places.
 */
export type BlueCasterHierarchyLight = HierarchyTree<HierarchyCityLight>;

// ── City page (editorial content for /fishing/[province]/[city]) ────
// Trimmed view of GET /api/v1/cities/[slug]/page — only the fields the
// city landing page renders. 404 (no published city_page yet) → null;
// the page falls back to generated copy.

export interface BlueCasterCityPage {
  page: {
    slug: string;
    hero: { image_url: string | null; image_alt: string | null };
    seo: {
      title: string;
      meta_description: string;
      canonical_url: string | null;
      og_image_url: string | null;
    };
    about_md: string | null;
    local_intel_md: string | null;
    faq: Array<{ q: string; a: string }>;
  };
  hierarchy: {
    province: { name: string; code: string };
    city: { name: string; slug: string; lat: number; lng: number };
  };
}

export async function fetchCityPage(
  slug: string,
): Promise<BlueCasterCityPage | null> {
  return bcGet<BlueCasterCityPage>(
    `/api/v1/cities/${encodeURIComponent(slug)}/page`,
    {},
    3600,
  );
}

async function fetchHierarchyTree<T>(query: string): Promise<T | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/api/v1/hierarchy${query}`, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** The full place tree, spot arrays included. */
export async function fetchHierarchy(): Promise<BlueCasterHierarchy | null> {
  return fetchHierarchyTree<BlueCasterHierarchy>("");
}

/**
 * The place tree with `spot_count` in place of the per-city spot arrays.
 *
 * Prefer this anywhere the spots themselves aren't rendered — it's a separate
 * function rather than a flag so the return type tells you which shape you got
 * instead of leaving `spots` optional everywhere.
 */
export async function fetchHierarchyLight(): Promise<BlueCasterHierarchyLight | null> {
  return fetchHierarchyTree<BlueCasterHierarchyLight>("?spots=0");
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

export type SearchKind = "spot" | "city" | "region" | "species";

export interface BlueCasterSearchResult {
  kind: SearchKind;
  id: string;
  slug: string;
  name: string;
  /** null for regions and species — there is no single point to fly to. */
  lat: number | null;
  lng: number | null;
  /** Display subtitle: "Sooke, BC", "South Vancouver Island, BC", a scientific name. */
  label: string | null;
  /** True for the caller's own custom spots. */
  owned: boolean;
  /** [w,s,e,n] — regions only, the extent of their published spots. */
  bbox: number[] | null;
  /** Per-kind extras: spot_count (city), spot_type (spot), scientific_name (species). */
  meta: Record<string, unknown>;
  /** Higher is better. Comparable within one response only. */
  rank: number;
}

export interface BlueCasterSearchResponse {
  query: string;
  results: BlueCasterSearchResult[];
  meta: {
    count: number;
    /** The result set hit the cap — the UI can hint "keep typing to narrow". */
    truncated: boolean;
    near: { lat: number; lng: number } | null;
    viewer: boolean;
  };
}

/**
 * Ranked search across spots, cities, regions and species.
 *
 * Results come back FLAT and pre-ranked — group by `kind` for display, but
 * keep the array order inside each group, because that order is the ranking.
 *
 * `near` only breaks ties (capped at 0.08 server-side), so this stays a global
 * search: a far-away exact match still outranks a nearby fuzzy one.
 *
 * A verified `viewerId` widens the results to include that angler's own custom
 * spots. That response is per-user and bypasses the Data Cache.
 */
export async function searchBlueCaster(
  q: string,
  opts: { near?: { lat: number; lng: number }; limit?: number; viewerId?: string } = {},
): Promise<BlueCasterSearchResponse | null> {
  return bcGet<BlueCasterSearchResponse>(
    "/api/v1/search",
    {
      q,
      near: opts.near ? `${opts.near.lat},${opts.near.lng}` : undefined,
      limit: opts.limit,
      // Distinct edge cache key for personalized reads — see fetchMapSpots.
      // Identity stays in the header; this is just a flag, so no user id ever
      // lands in a URL or an access log.
      viewer: opts.viewerId ? "1" : undefined,
    },
    300,
    opts.viewerId,
  );
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
  /**
   * Server-verified viewer id. Widens the response to include that user's own
   * private data (currently: their custom spots). MUST come from a verified
   * session — never from client input. A viewer-scoped response bypasses the
   * Data Cache; caching it would serve one angler's private spots to the next
   * anonymous request for the same URL.
   */
  viewerId?: string,
): Promise<T | null> {
  const env = bcEnv();
  if (!env) return null;
  const url = new URL(`${env.baseUrl}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": env.apiKey,
        ...(viewerId ? { "x-reelcaster-user-id": viewerId } : {}),
      },
      ...(viewerId ? { cache: "no-store" as const } : { next: { revalidate } }),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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
  extras?: CatchPreviewExtras,
): Promise<CatchPreviewResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const form = new FormData();
  form.append("photo", file, file.name || "catch.jpg");
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value !== undefined && value !== null && value !== "") {
        form.append(key, String(value));
      }
    }
  }

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
// Catch wizard (2026-07) — nearest spot, snapshot, species, custom spot, pool
// =============================================================================

/**
 * Nearest saved spot for a raw coordinate (the map picker's 400 m matching)
 * + up-to-5km candidates with today's peak scores + the DFO subarea at the
 * query point (auto-fills the create-spot modal's MGMT AREA).
 */
export async function fetchNearestSpots(
  lat: number,
  lng: number,
  radiusM = 400,
  limit = 5,
): Promise<NearestSpotsResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius_m: String(radiusM),
    limit: String(limit),
  });
  const res = await fetch(`${baseUrl}/api/v1/spots/by-coordinates?${qs}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as NearestSpotsResponse;
}

/**
 * Conditions snapshot for a spot at an arbitrary UTC instant — historical
 * capable (unlike point-conditions). Used by the review screen when the
 * spot or catch time changes.
 */
/** @param ownerUserId Server-verified viewer — unlocks their own private spot. */
export async function fetchSpotSnapshot(
  spotId: string,
  datetimeUtcIso: string,
  ownerUserId?: string,
): Promise<SpotSnapshotResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const qs = new URLSearchParams({ datetime: datetimeUtcIso });
  const res = await fetch(
    `${baseUrl}/api/v1/fishing-spots/${spotId}/snapshot?${qs}`,
    {
      headers: {
        "x-api-key": apiKey,
        ...(ownerUserId ? { "x-reelcaster-user-id": ownerUserId } : {}),
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as SpotSnapshotResponse;
}

/** Full species list (species-picker fallback when no spot is matched). */
export async function fetchBlueCasterSpecies(): Promise<
  BlueCasterSpeciesItem[] | null
> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/species?limit=500`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { species: BlueCasterSpeciesItem[] };
  return data.species ?? null;
}

/**
 * Single-hour score for a spot×species at a specific UTC instant — the
 * "score at catch time" snapshot. Empty `stocks` = hour outside the
 * current forecast window (render "—").
 */
export async function fetchSpotScoreHour(
  spotId: string,
  speciesId: string,
  datetimeUtcIso: string,
): Promise<SpotScoreHourResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const qs = new URLSearchParams({
    species: speciesId,
    datetime: datetimeUtcIso,
  });
  const res = await fetch(
    `${baseUrl}/api/v1/fishing-spots/${spotId}/score?${qs}`,
    { headers: { "x-api-key": apiKey }, cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as SpotScoreHourResponse;
}

export type CreateCustomSpotResult =
  | { ok: true; data: CreateCustomSpotResponse }
  | { ok: false; status: number; error: string; message?: string };

/** Create a custom (user) spot — owned by `user_id`, private by default,
 *  approved+active with score pending until the next batch scoring run.
 *  `species_ids` are the species the owner wants scored there. Upstream errors
 *  (e.g. 422 `outside_coverage`, 403 `pro_required`) are surfaced, not
 *  swallowed, so the UI can explain why the create was refused.
 *
 *  `accessToken` is the owner's Supabase JWT; forwarded to BlueCaster so its
 *  user-scope binding can verify ownership once REELCASTER_REQUIRE_USER_JWT is
 *  enforced (harmless while staged). */
export async function createCustomSpot(
  input: {
    name: string;
    lat: number;
    lng: number;
    user_id: string;
    visibility?: "private" | "public";
    species_ids?: string[];
  },
  accessToken?: string,
): Promise<CreateCustomSpotResult> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/fishing-spots/custom`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    return {
      ok: false,
      status: res.status,
      error: body?.error ?? "create_failed",
      message: body?.message,
    };
  }
  return { ok: true, data: (await res.json()) as CreateCustomSpotResponse };
}

export interface OwnedCustomSpot {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  visibility: "private" | "public";
  created_at: string;
  best_species_id: string | null;
  best_species_name: string | null;
  score: number | null;
  score_status: "scored" | "pending";
}

/** The user's own custom spots (both private and public) — powers the "your
 *  spots" pins on the map + the dashboard. Owner-scoped: forwards the user's
 *  Supabase JWT so BlueCaster returns only this user's rows. */
export async function fetchMyCustomSpots(
  userId: string,
  accessToken: string,
): Promise<OwnedCustomSpot[]> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(
    `${baseUrl}/api/v1/anglers/${encodeURIComponent(userId)}/spots`,
    {
      headers: {
        "x-api-key": apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as
    | { spots?: OwnedCustomSpot[] }
    | null;
  return body?.spots ?? [];
}

/**
 * Commit a saved catch into BlueCaster's intelligence pool
 * (`POST /api/v1/ingest/catch`). Fire-and-forget from the save path —
 * failures must never block the user's save. `idempotencyKey` should be
 * the reelcaster catch row id so retries replay instead of duplicating.
 */
export async function commitCatchToPool(
  payload: PoolCommitPayload,
  photo: File | null,
  idempotencyKey: string,
): Promise<PoolCommitResponse | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (photo) form.append("photo", photo, photo.name || "catch.jpg");

  const res = await fetch(`${baseUrl}/api/v1/ingest/catch`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "idempotency-key": idempotencyKey },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PoolCommitResponse;
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

// =============================================================================
// Daily city report (Pro dashboard card)
// =============================================================================

/**
 * GET /api/v1/cities/[slug]/daily-report — the AI briefing for one city.
 *
 * `reports_md` is the substance: what anglers are actually catching, in
 * three or four sentences. `outlook_md` is a short forecast note. Both are
 * markdown with spot and species names bolded.
 *
 * BlueCaster strips its own audit trail (source citations, evidence counts,
 * per-tip provenance) before serving this, so there is nothing here that
 * identifies where the intel came from. Don't go looking for it — it isn't
 * meant to reach this side.
 *
 * `status: "pending"` means nobody had asked for that city yet; the read
 * itself registers demand and a report appears shortly.
 */
export interface BlueCasterCityDailyReport {
  city: { slug: string; name: string };
  status: "ready" | "pending";
  report: {
    report_date: string;
    headline: string | null;
    reports_md: string | null;
    reports_window_days: number;
    outlook_md: string | null;
    outlook_horizon_days: number;
    tips: Array<{ text: string }>;
    generated_at: string;
  } | null;
}

export async function fetchCityDailyReport(
  citySlug: string,
): Promise<BlueCasterCityDailyReport | null> {
  // Short revalidate, not none: the report changes once a day, but a stale
  // card on a dashboard is worse than a slightly slower one, and this is
  // already behind a Pro gate that forbids shared caching downstream.
  return bcGet<BlueCasterCityDailyReport>(
    `/api/v1/cities/${encodeURIComponent(citySlug)}/daily-report`,
    {},
    300,
  );
}

/**
 * The city a home spot belongs to.
 *
 * There is no stored home *city* — a spot has exactly one home city under
 * BlueCaster's shared-spot model, so the home spot the Pro wizard already
 * pins resolves to one. Deriving it means no new column, no new onboarding
 * step, and it works for everyone who has pinned a spot already.
 *
 * Returns null when no spot is pinned, when the slug no longer resolves, or
 * when the city isn't published.
 */
export async function resolveHomeCity(
  homeSpotSlug: string | null | undefined,
): Promise<{ slug: string; name: string } | null> {
  if (!homeSpotSlug) return null;

  const hierarchy = await fetchHierarchy();
  if (!hierarchy) return null;

  for (const country of hierarchy.countries) {
    for (const province of country.states_provinces) {
      for (const region of province.regions) {
        for (const city of region.cities) {
          if (city.lifecycle !== "published") continue;
          if (city.spots.some((s) => s.slug === homeSpotSlug)) {
            return { slug: city.slug, name: city.name };
          }
        }
      }
    }
  }
  return null;
}

// ── City × species fishing guides ──────────────────────────────────
//
// The editorial pages at /fishing/<province>/<city>/<species>. BlueCaster
// derives everything except the intro prose at request time from the same
// tables that drive the map, so a guide can't advertise a spot or a season
// the product disagrees with.

export interface BlueCasterGuideLink {
  species_id: string;
  species_slug: string;
  species_name: string;
  spot_count: number;
  /** "Jul-Aug", or null when the curve has no distinct peak. */
  peak_label: string | null;
  method_count: number;
}

export interface BlueCasterCityGuides {
  city: { slug: string; name: string };
  guides: BlueCasterGuideLink[];
  meta: { count: number };
}

export interface BlueCasterSpeciesGuide {
  city: {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    region_name: string | null;
    province_code: string | null;
    province_name: string | null;
    country_code: string | null;
  };
  species: {
    id: string;
    slug: string;
    name: string;
    scientific_name: string | null;
    family: string | null;
  };
  intro: string | null;
  season: {
    peak_label: string | null;
    notes: string | null;
    months: Array<{ month: number; label: string; level: number }>;
  };
  methods: Array<{
    name: string;
    role: string;
    baits: string[];
    notes: string | null;
  }>;
  conditions: Array<{
    factor: string;
    label: string;
    weight: number;
    headline: string;
    detail: string;
    rationale: string | null;
  }>;
  tide_stations: string[];
  regulations: {
    spot_count: number;
    open_spot_count: number;
    headline_state: "retention_open" | "release_only" | "closed" | "mixed" | null;
    daily_limit: number | null;
    notice_summary: string | null;
    next_open_date: string | null;
    regulator: string | null;
  };
  spots: Array<{
    id: string;
    slug: string;
    name: string;
    lat: number;
    lng: number;
    regulatory_state: "retention_open" | "release_only" | "closed" | null;
    daily_limit: number | null;
    next_open_date: string | null;
  }>;
  meta: {
    intro_generated_at: string | null;
    admin_edited: boolean;
    generated_at: string;
  };
}

/** Every published guide for a city. Empty array for a city with none. */
export async function fetchCityGuides(
  citySlug: string,
): Promise<BlueCasterCityGuides | null> {
  return bcGet<BlueCasterCityGuides>(
    `/api/v1/cities/${encodeURIComponent(citySlug)}/species-guides`,
    {},
    3600,
  );
}

/**
 * One guide. Null for an unknown pairing or an unpublished one, which the
 * page turns into a 404.
 *
 * Revalidates on the quarter hour rather than the hour: the regulation block
 * moves with fishery notices, and a guide page that still says "open at 12
 * spots" the day after a closure is the one thing here that can be wrong in a
 * way that matters.
 */
export async function fetchSpeciesGuide(
  citySlug: string,
  speciesSlug: string,
): Promise<BlueCasterSpeciesGuide | null> {
  return bcGet<BlueCasterSpeciesGuide>(
    `/api/v1/cities/${encodeURIComponent(citySlug)}/species-guides/${encodeURIComponent(speciesSlug)}`,
    {},
    900,
  );
}
