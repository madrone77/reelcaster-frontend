// Wire-shape types for two BlueCaster intelligence endpoints surfaced in the
// Explore drawer:
//   GET /api/v1/intel/evidence?fishing_spot_id&species_id  → IntelEvidence
//   GET /api/v1/pool/intelligence?spot_id&species_id        → PoolIntelligence
//
// Mirrors bluecaster/app/api/v1/{intel/evidence,pool/intelligence}/route.ts.
// Both key off the spot UUID + species UUID (NOT slugs) — Explore's RailSpot
// carries `id` + `bestSpeciesId`, so no slug→id lookup is needed.

// ─── intel/evidence — "why this score" ─────────────────────────────────

export interface IntelAlgoVariable {
  id: string;
  variable_name: string; // e.g. "tidal_phase", "water_temp"
  confidence_score: number | null; // 0–1
  is_enabled: boolean;
  rank: number;
}

export interface IntelEvidenceItem {
  id: string;
  variable_name: string;
  source_type: string; // "operator" | "report" | "youtube" | "catch_signal" | ...
  source_label: string | null;
  evidence_detail: Record<string, unknown>;
  created_at: string;
}

export interface IntelEvidence {
  algo_variables: IntelAlgoVariable[];
  evidence_by_variable: Record<string, IntelEvidenceItem[]>;
  changes: Array<{
    variable_name: string;
    old_value: string;
    new_value: string;
    change_reason: string;
    changed_at: string;
  }>;
  combination_variables: Array<{
    variable_name: string;
    variables_combined: string[];
    computation_formula: string;
  }>;
  source_counts: Record<string, number>; // { operator: 3, report: 5, youtube: 8, ... }
  overall_confidence: number; // 0–1 (empty state = 0.3)
  total_evidence: number;
}

// ─── pool/intelligence — community catch patterns ──────────────────────

export interface PoolBucketRate {
  value: string; // bucket key, e.g. "flood" / "early_morning" / "Jun"
  rate: number | null; // 0–100, null when sample_too_small
  n: number; // raw count
  sample_too_small: boolean; // true when n < 5
}

export interface PoolIntelligence {
  version: 1;
  spot_id: string;
  species_id: string;
  time_window: "season" | "month" | "week";
  pool_access_granted: boolean;
  total_catches_in_window: number;
  rates: {
    tide_phase: PoolBucketRate[];
    time_of_day: PoolBucketRate[];
    wind_band: PoolBucketRate[];
    season_month: PoolBucketRate[];
    moon_phase: PoolBucketRate[];
    depth_band: PoolBucketRate[];
  };
  top_lures: PoolBucketRate[];
  recent_activity_by_week: Array<{ week_start: string; n: number }>;
}
