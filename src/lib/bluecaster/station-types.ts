// Response shapes for the explore map's station/buoy click panels —
// BlueCaster /api/v1/map/station-conditions and /api/v1/map/buoy-conditions.

// ── Tide stations (CHS/DFO + NOAA water-level stations) ─────────────

export interface StationConditions {
  station: {
    sid: string;
    source: "chs" | "noaa";
    operator: "CHS" | "NOAA";
    name: string;
    lat: number;
    lng: number;
  };
  now: {
    time_utc: string;
    height_m: number;
    phase: string; // flood_early … slack_high (8-way SCPM buckets)
    minutes_to_next_slack: number; // signed; positive = extremum ahead
  } | null;
  series: Array<{ time_utc: string; height_m: number }>; // hourly, −6h → +30h
  extremes: Array<{ time_utc: string; height_m: number; kind: "high" | "low" }>;
}

// ── Weather buoys (NOAA NDBC + ECCC/DFO + partner, via NDBC feed) ───

export interface BuoyObservation {
  time_utc: string;
  wind_dir_deg: number | null;
  wind_speed_kn: number | null;
  gust_kn: number | null;
  wave_height_m: number | null;
  dominant_period_s: number | null;
  avg_period_s: number | null;
  wave_dir_deg: number | null;
  pressure_hpa: number | null;
  air_temp_c: number | null;
  water_temp_c: number | null;
}

export interface BuoyConditions {
  station: {
    sid: string;
    name: string;
    desc: string | null;
    operator: string; // NOAA · ECCC · NANOOS · UW · Scripps · …
    station_type: "buoy" | "cman";
    lat: number;
    lng: number;
  };
  latest: BuoyObservation | null;
  series: BuoyObservation[]; // hourly, oldest → newest, last 24h
}
