// Shape of BlueCaster's photo-first catch ingest *preview* response
// (`POST /api/v1/ingest/catch/preview`). Non-destructive: it reads EXIF,
// runs vision, matches the nearest spot, and computes a conditions snapshot
// so the Log-a-catch UI can pre-fill before the angler confirms. Mirrors the
// `PreviewResponse` interface in bluecaster's preview route.

export interface CatchPreviewSpotMatch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
  country_code: string | null;
  subdivision_code: string | null;
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
  species_at_spot: Array<{ id: string; name: string }>;

  exif: {
    captured_at: string | null;
    lat: number | null;
    lng: number | null;
    camera: string | null;
  };

  vision: {
    species: { name: string; confidence: number } | null;
    species_id: string | null;
    lure: { name: string; confidence: number } | null;
    size_estimate_lb: number | null;
    lighting_window: string | null;
    no_fish_detected: boolean;
  };

  snapshot: {
    tide_phase: string | null;
    tide_height_ft: number | null;
    wind_kn: number | null;
    wind_dir: string | null;
    water_temp_c: number | null;
    moon_phase: number | null;
    water_depth_m: number | null;
  } | null;

  /** Fields the UI must still ask for (couldn't be derived). */
  needs_input: string[];
}
