// Shape of BlueCaster's photo-first catch ingest *preview* response
// (`POST /api/v1/ingest/catch/preview`). Non-destructive: it reads EXIF,
// runs vision, matches the nearest spot, and computes a conditions snapshot
// so the Log-a-catch UI can pre-fill before the angler confirms. Mirrors the
// `PreviewResponse` interface in bluecaster's preview route.
//
// 2026-07 revamp: the snapshot block was extended (current / pressure / sky /
// gusts / air temp / visibility), species slugs were added, and the endpoint
// accepts client-advisory EXIF fields (see CatchPreviewExtras) so HEIC
// conversions and EXIF-less photos still flow.

export interface CatchPreviewSpotMatch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
  country_code: string | null;
  subdivision_code: string | null;
}

/** Extended conditions snapshot — shared by preview and the per-spot
 *  `/fishing-spots/[id]/snapshot` endpoint. */
export interface CatchSnapshot {
  // Original keys
  tide_phase: string | null;
  tide_height_ft: number | null;
  wind_kn: number | null;
  wind_dir: string | null; // compass8, FROM
  water_temp_c: number | null;
  moon_phase: number | null;
  water_depth_m: number | null;
  // Extended keys (2026-07)
  tide_height_m: number | null;
  minutes_to_next_slack: number | null;
  current_speed_kt: number | null; // Salish Sea only; null elsewhere
  current_direction_deg: number | null; // TOWARD
  current_dir: string | null; // compass8, TOWARD
  current_rate_of_change_kt_per_hr: number | null; // + building, − dying
  wind_direction_deg: number | null; // FROM
  wind_gust_kt: number | null;
  barometric_pressure_hpa: number | null;
  pressure_trend_3h: number | null;
  air_temp_c: number | null;
  cloud_cover_pct: number | null;
  visibility_km: number | null;
  precipitation_mm: number | null;
  moon_illumination_pct: number | null;
}

export interface CatchPreviewResponse {
  status: "ok" | "duplicate" | "rejected";
  rejection_reason?:
    | "no_exif"
    | "unreadable"
    | "too_large"
    | "no_fish_detected"
    | "other";
  message?: string;

  /** Naive wall-clock string from EXIF (no timezone), e.g. "2024-08-14T07:04:00". */
  observed_at: string | null;
  observed_at_source: "exif" | "user" | "file_lastmod" | null;

  spot_match: CatchPreviewSpotMatch | null;
  spot_candidates: CatchPreviewSpotMatch[];
  species_at_spot: Array<{ id: string; name: string; slug: string | null }>;

  exif: {
    captured_at: string | null;
    lat: number | null;
    lng: number | null;
    camera: string | null;
  };

  vision: {
    species: { name: string; confidence: number } | null;
    species_id: string | null; // BlueCaster species uuid
    species_slug: string | null;
    lure: { name: string; confidence: number } | null;
    size_estimate_lb: number | null;
    lighting_window: string | null;
    no_fish_detected: boolean;
  };

  snapshot: CatchSnapshot | null;

  /** Fields the UI must still ask for (couldn't be derived). */
  needs_input: string[];
}

/** Client-advisory multipart fields for the preview call. Naive local
 *  wall-clock strings ("YYYY-MM-DDTHH:mm:ss"); tz_offset_minutes is the
 *  browser's `new Date().getTimezoneOffset()`. */
export interface CatchPreviewExtras {
  exif_captured_at?: string | null;
  exif_lat?: number | null;
  exif_lng?: number | null;
  camera?: string | null;
  file_lastmod?: string | null;
  tz_offset_minutes?: number;
}

// ── GET /api/v1/spots/by-coordinates ──────────────────────────────────

export interface NearestSpotHit {
  id: string;
  name: string;
  slug: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  status: string | null;
  is_published: boolean;
  score: number | null; // 0..100, today's best-species peak
  best_species_id: string | null;
  score_status: "scored" | "pending";
}

export interface NearestSpotsResponse {
  query: { lat: number; lng: number; radius_m: number };
  match: NearestSpotHit | null;
  candidates: NearestSpotHit[];
  dfo_area: { subarea_label: string; official_name: string | null } | null;
}

// ── GET /api/v1/fishing-spots/[id]/snapshot ───────────────────────────

export interface SpotSnapshotResponse {
  spot_id: string;
  hour_utc: string;
  source: "openmeteo_archive" | "openmeteo_forecast" | "computed" | "cached";
  water_depth_m: number | null;
  snapshot: CatchSnapshot | null;
}

// ── GET /api/v1/species ───────────────────────────────────────────────

export interface BlueCasterSpeciesItem {
  id: string;
  slug: string;
  name: string;
  scientific_name: string | null;
  family: string | null;
}

// ── POST /api/v1/fishing-spots/custom ─────────────────────────────────

export type CustomSpotVisibility = "private" | "public";

export interface CreateCustomSpotResponse {
  spot: {
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    city?: string;
    region?: string;
    owner_user_id?: string;
    visibility?: CustomSpotVisibility;
    tidal_station: { id: string; name: string } | null;
  };
  /** The headline for the angler. BlueCaster scores the spot right after it
   *  answers, so this is either "we are building its forecast now" or the
   *  reason there will not be one. Always show it. */
  message?: string;
  /** in_progress — a forecast is on its way. skipped — nothing to score, and
   *  `message` plus `warnings` say why. */
  scoring?: {
    status: "in_progress" | "skipped";
    estimated_seconds: number | null;
  };
  /** Customer-ready copy for anything the angler should know: every species
   *  closed by regulation, no species picked, no forecast model yet. */
  warnings?: {
    code:
      | "no_species_selected"
      | "regulations_closed"
      | "regulations_closed_partial"
      | "no_fingerprint"
      | "conditions_unavailable";
    message: string;
    species_ids?: string[];
  }[];
  /** One entry per owner-picked species. "scoring" means a forecast is being
   *  built for it now; "closed" means regulations shut it for the whole
   *  14-day horizon; "pending" means no model or no tide series yet. */
  scored_species?: {
    species_id: string;
    name?: string;
    scoring: "scoring" | "pending" | "closed";
    /** Set when the season opens partway through the horizon (YYYY-MM-DD). */
    open_from?: string;
  }[];
  seeded_from?: unknown;
  similar_spots?: unknown[];
  confidence: number;
  confidence_label: string;
  /** Legacy/optional — the DFO management subarea at the point. BlueCaster
   *  does not currently emit this from the create endpoint (always undefined
   *  at runtime); kept optional so existing catch-logging callers that read
   *  `mgmt_area?.subarea_label ?? fallback` still type-check. */
  mgmt_area?: { subarea_label: string; official_name: string | null } | null;
}

// ── POST /api/v1/ingest/catch (intelligence-pool commit) ──────────────

export interface PoolCommitPayload {
  spot_id: string;
  species_id: string; // BlueCaster species uuid
  observed_at: string; // TRUE UTC ISO
  time_input_kind: "exact" | "hour_window" | "day" | "week" | "unknown";
  location_input_kind:
    | "exact_gps"
    | "spot_pin"
    | "spot_radius"
    | "region"
    | "unknown";
  lat?: number | null;
  lng?: number | null;
  fish?: Array<{
    count?: number;
    length_cm?: number;
    weight_kg?: number;
    released?: boolean;
    is_anchor: boolean;
  }>;
  technique?: string;
  lure?: string;
  depth_m?: number | null;
  notes?: string;
  contributes_to_pool?: boolean;
  gps_stays_private?: boolean;
  angler_user_id?: string;
}

export interface PoolCommitResponse {
  observation_id: string | null;
  status: "logged" | "needs_review" | "duplicate" | "rejected";
  rejection_reason?: string;
  dopamine_line?: string;
  headline?: string;
}

// ── Single-hour score (score endpoint without `days`) ─────────────────

export interface SpotScoreHourResponse {
  spot_id: string;
  species_id: string;
  hour_utc: string;
  forecast_version: number;
  stocks: Array<{
    stock_id: string;
    score: number; // 0..1
    regulatory_state?: string;
  }>;
}

// ── GET /api/v1/species/scorable ──────────────────────────────────────

/** The species a new custom spot at these coordinates can be scored for.
 *  `basis: "scored"` means the list is what the city is actually producing
 *  forecasts for, so every option is a real one. `"fingerprint"` is the
 *  provisional fallback for a city with nothing scored yet. */
export interface ScorableSpeciesResponse {
  city: { id: string; name: string; slug: string };
  distance_km: number;
  basis: "scored" | "fingerprint";
  species: { id: string; name: string }[];
}
