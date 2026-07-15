import type { CatchSnapshot } from "@/lib/bluecaster/catch-ingest-types";

export type WizardStep = "upload" | "analyzing" | "location" | "review";

export interface SelectedSpot {
  id: string;
  name: string;
  slug: string | null;
  lat: number;
  lng: number;
  score: number | null; // 0-100
  scoreStatus: "scored" | "pending" | "none";
  distanceM: number | null; // pin → spot
  mgmtArea: string | null; // "DFO 19-3"
}

export interface SpeciesChoice {
  bcId: string | null; // BlueCaster species uuid
  slug: string | null;
  name: string;
  confidence: number | null; // 0..1, vision only
}

export interface ScoreSnapshot {
  score: number | null; // 0-100 at catch hour
  status: "scored" | "pending" | "none";
}

/** Free-text imperial inputs; converted to metric on save. */
export interface StatDraft {
  weightLb: string;
  lengthIn: string;
  lure: string;
  depthFt: string;
  notes: string;
}

/** Numeric user corrections layered over the AUTO snapshot values. */
export interface SnapshotOverrides {
  tide_height_m?: number;
  current_speed_kt?: number;
  wind_kn?: number;
  barometric_pressure_hpa?: number;
  water_temp_c?: number;
  cloud_cover_pct?: number;
}

export function applyOverrides(
  snapshot: CatchSnapshot | null,
  overrides: SnapshotOverrides,
): CatchSnapshot | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    ...(overrides.tide_height_m !== undefined
      ? { tide_height_m: overrides.tide_height_m, tide_height_ft: overrides.tide_height_m * 3.28084 }
      : null),
    ...(overrides.current_speed_kt !== undefined
      ? { current_speed_kt: overrides.current_speed_kt }
      : null),
    ...(overrides.wind_kn !== undefined ? { wind_kn: overrides.wind_kn } : null),
    ...(overrides.barometric_pressure_hpa !== undefined
      ? { barometric_pressure_hpa: overrides.barometric_pressure_hpa }
      : null),
    ...(overrides.water_temp_c !== undefined
      ? { water_temp_c: overrides.water_temp_c }
      : null),
    ...(overrides.cloud_cover_pct !== undefined
      ? { cloud_cover_pct: overrides.cloud_cover_pct }
      : null),
  };
}

/** Naive local wall-clock "YYYY-MM-DDTHH:mm[:ss]" → true UTC ISO, using the
 *  browser's timezone (the same assumption the commit endpoint documents). */
export function naiveToUtcIso(naive: string): string | null {
  const d = new Date(naive);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function formatCoords(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
}
