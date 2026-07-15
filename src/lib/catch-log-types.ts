/**
 * Catch log row + conditions-snapshot types (2026-07 wizard revamp).
 *
 * `weather_snapshot` is a versioned jsonb blob on catch_logs:
 *  - v1 (legacy, written by the old CatchForm): flat
 *    { rc_score, tide_phase, wind_kt, wind_dir, water_temp_c, air_temp_c }
 *  - v2 (wizard): { v: 2, tide, current, wind, pressure, water, sky }
 *    mirroring BlueCaster's extended preview/snapshot payload.
 * Readers must handle both — see `readSnapshot()`.
 */

import type { CatchSnapshot } from '@/lib/bluecaster/catch-ingest-types'

export type CatchStatus = 'draft' | 'logged'
export type ScoreStatus = 'scored' | 'pending' | 'none'

export interface SnapshotV2 {
  v: 2
  tide: {
    phase: string | null // 8-way SCPM (flood_early … slack_low)
    height_m: number | null
    minutes_to_next_slack: number | null
  }
  current: {
    speed_kt: number | null // Salish Sea only; null elsewhere
    direction_deg: number | null // TOWARD
    dir: string | null // compass8, TOWARD
    rate_of_change_kt_per_hr: number | null // + building, − dying
  }
  wind: {
    speed_kt: number | null
    direction_deg: number | null // FROM
    dir: string | null // compass8, FROM
    gust_kt: number | null
  }
  pressure: {
    hpa: number | null
    trend_3h: number | null // hPa delta vs 3h prior
  }
  water: {
    temp_c: number | null
    depth_m: number | null
  }
  sky: {
    cloud_cover_pct: number | null
    visibility_km: number | null
    precipitation_mm: number | null
    air_temp_c: number | null
  }
  moon: {
    phase: number | null // 0..1
    illumination_pct: number | null
  }
}

export interface SnapshotV1 {
  rc_score?: number | null
  tide_phase?: string | null
  wind_kt?: number | null
  wind_dir?: string | null
  water_temp_c?: number | null
  air_temp_c?: number | null
}

export type WeatherSnapshot = SnapshotV2 | SnapshotV1

export interface CatchLogRow {
  id: string
  user_id: string
  caught_at: string
  location_lat: number
  location_lng: number
  location_name: string | null
  outcome: 'bite' | 'landed'
  species_id: string | null // frontend text slug, e.g. "chinook-salmon"
  species_name: string | null
  retention_status: 'released' | 'kept' | null
  length_cm: number | null
  weight_kg: number | null
  depth_m: number | null
  lure_id: string | null
  lure_name: string | null
  notes: string | null
  photos: string[] // storage paths in the catch-photos bucket
  weather_snapshot: WeatherSnapshot | null
  tide_snapshot: Record<string, unknown> | null
  moon_phase: number | null
  created_at: string
  updated_at: string
  // 2026-07 revamp columns
  status: CatchStatus
  spot_id: string | null // BlueCaster fishing_spots.id
  spot_slug: string | null
  species_bc_id: string | null // BlueCaster species.id (uuid)
  species_confidence: number | null // 0..1
  score: number | null // 0-100 snapshot at log time
  score_status: ScoreStatus
  mgmt_area: string | null // e.g. "DFO 19-3"
  pool_observation_id: string | null
}

export function isSnapshotV2(s: WeatherSnapshot | null | undefined): s is SnapshotV2 {
  return !!s && (s as SnapshotV2).v === 2
}

/** BlueCaster snapshot (preview / spot-snapshot shape) → stored v2 jsonb. */
export function catchSnapshotToV2(s: CatchSnapshot): SnapshotV2 {
  return {
    v: 2,
    tide: {
      phase: s.tide_phase,
      height_m: s.tide_height_m,
      minutes_to_next_slack: s.minutes_to_next_slack,
    },
    current: {
      speed_kt: s.current_speed_kt,
      direction_deg: s.current_direction_deg,
      dir: s.current_dir,
      rate_of_change_kt_per_hr: s.current_rate_of_change_kt_per_hr,
    },
    wind: {
      speed_kt: s.wind_kn,
      direction_deg: s.wind_direction_deg,
      dir: s.wind_dir,
      gust_kt: s.wind_gust_kt,
    },
    pressure: { hpa: s.barometric_pressure_hpa, trend_3h: s.pressure_trend_3h },
    water: { temp_c: s.water_temp_c, depth_m: s.water_depth_m },
    sky: {
      cloud_cover_pct: s.cloud_cover_pct,
      visibility_km: s.visibility_km,
      precipitation_mm: s.precipitation_mm,
      air_temp_c: s.air_temp_c,
    },
    moon: { phase: s.moon_phase, illumination_pct: s.moon_illumination_pct },
  }
}

/** Stored v1/v2 jsonb → BlueCaster snapshot shape (hydrates the detail
 *  page's conditions grid; v1 rows fill only their four known fields). */
export function storedToCatchSnapshot(
  w: WeatherSnapshot | null | undefined,
): CatchSnapshot | null {
  if (!w) return null
  if (isSnapshotV2(w)) {
    return {
      tide_phase: w.tide?.phase ?? null,
      tide_height_ft: w.tide?.height_m != null ? w.tide.height_m * 3.28084 : null,
      wind_kn: w.wind?.speed_kt ?? null,
      wind_dir: w.wind?.dir ?? null,
      water_temp_c: w.water?.temp_c ?? null,
      moon_phase: w.moon?.phase ?? null,
      water_depth_m: w.water?.depth_m ?? null,
      tide_height_m: w.tide?.height_m ?? null,
      minutes_to_next_slack: w.tide?.minutes_to_next_slack ?? null,
      current_speed_kt: w.current?.speed_kt ?? null,
      current_direction_deg: w.current?.direction_deg ?? null,
      current_dir: w.current?.dir ?? null,
      current_rate_of_change_kt_per_hr: w.current?.rate_of_change_kt_per_hr ?? null,
      wind_direction_deg: w.wind?.direction_deg ?? null,
      wind_gust_kt: w.wind?.gust_kt ?? null,
      barometric_pressure_hpa: w.pressure?.hpa ?? null,
      pressure_trend_3h: w.pressure?.trend_3h ?? null,
      air_temp_c: w.sky?.air_temp_c ?? null,
      cloud_cover_pct: w.sky?.cloud_cover_pct ?? null,
      visibility_km: w.sky?.visibility_km ?? null,
      precipitation_mm: w.sky?.precipitation_mm ?? null,
      moon_illumination_pct: w.moon?.illumination_pct ?? null,
    }
  }
  return {
    tide_phase: w.tide_phase ?? null,
    tide_height_ft: null,
    wind_kn: w.wind_kt ?? null,
    wind_dir: w.wind_dir ?? null,
    water_temp_c: w.water_temp_c ?? null,
    moon_phase: null,
    water_depth_m: null,
    tide_height_m: null,
    minutes_to_next_slack: null,
    current_speed_kt: null,
    current_direction_deg: null,
    current_dir: null,
    current_rate_of_change_kt_per_hr: null,
    wind_direction_deg: null,
    wind_gust_kt: null,
    barometric_pressure_hpa: null,
    pressure_trend_3h: null,
    air_temp_c: w.air_temp_c ?? null,
    cloud_cover_pct: null,
    visibility_km: null,
    precipitation_mm: null,
    moon_illumination_pct: null,
  }
}

/** Uniform read surface over v1/v2 snapshots for list rows. */
export function readSnapshot(s: WeatherSnapshot | null | undefined): {
  tidePhase: string | null
  windKt: number | null
  windDir: string | null
  waterTempC: number | null
} {
  if (!s) return { tidePhase: null, windKt: null, windDir: null, waterTempC: null }
  if (isSnapshotV2(s)) {
    return {
      tidePhase: s.tide?.phase ?? null,
      windKt: s.wind?.speed_kt ?? null,
      windDir: s.wind?.dir ?? null,
      waterTempC: s.water?.temp_c ?? null,
    }
  }
  return {
    tidePhase: s.tide_phase ?? null,
    windKt: s.wind_kt ?? null,
    windDir: s.wind_dir ?? null,
    waterTempC: s.water_temp_c ?? null,
  }
}
