// Wire-shape types for the BlueCaster live-spot endpoints:
//   GET /api/v1/spots/[slug]/spot-page        → SpotPageInitial
//   GET /api/v1/spots/[slug]/forecast-14d     → Forecast14dPayload
//
// Ported verbatim from bluecaster/app/test/_lib/{live-spot-data,spot-detail-slicers}.ts.
// Keep in sync if BC adds fields — the lazy 14d merge in the component relies
// on the same key names appearing in both payloads.

// ─── Spot identity ─────────────────────────────────────────────────────

export type LiveSpot = {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  bottomType: string | null;
  spotType: string | null;
  depthMinM: number | null;
  depthMaxM: number | null;
  depthMeanM: number | null;
  exposure: string | null;
  notes: string | null;
  dfoSubarea: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  /**
   * 4–5 sentence prose intro authored by the City Wizard's Stage ⑫
   * ("Write SEO Intros") and grounded on habitat / species / depths. null
   * for spots that haven't been through the wizard yet.
   */
  seoIntro: string | null;
  seoIntroGeneratedAt: string | null;
};

export type LiveSpecies = {
  id: string;
  name: string;
  slug: string;
  rank: number; // lower = more important at this spot
  confidence: number | null; // 0–100
};

// ─── Scoring + factor contributions ───────────────────────────────────

export type FactorContributions = {
  comfort?: {
    fit?: number;
    applied?: boolean;
    factors?: Record<
      string,
      { fit?: number; raw?: number | string; weight?: number }
    >;
  };
  factors?: Record<
    string,
    {
      source?: string;
      weight?: number;
      raw_value?: number | string;
      weighted_contribution?: number;
      normalized_contribution?: number;
    }
  >;
};

export type LiveScoreRow = {
  speciesId: string;
  hourUtc: string;
  score: number;
  factorContributions: FactorContributions | null;
};

// ─── Conditions (per-hour + right-now) ────────────────────────────────

export type HourlyConditions = {
  windKt: number | null;
  windGustKt: number | null;
  windDir: string | null;
  windDirDeg: number | null;
  cloudPct: number | null;
  airTempC: number | null;
  precipMm: number | null;
  seaTempC: number | null;
  swellM: number | null;
  waveM: number | null;
  tideM: number | null;
  tideTrend: "rising" | "falling" | null;
};

export type RightNowSnapshot = {
  hourLocal: string;
  windKt: number | null;
  windGustKt: number | null;
  windDir: string | null;
  windDirDeg: number | null;
  cloudPct: number | null;
  airTempC: number | null;
  precipMm: number | null;
  seaTempC: number | null;
  swellM: number | null;
  waveM: number | null;
  tideM: number | null;
  tideTrend: "rising" | "falling" | null;
};

// ─── Tide ──────────────────────────────────────────────────────────────

export type LiveTidePoint = {
  hourUtc: string;
  heightM: number;
};

// ─── Daily picker ─────────────────────────────────────────────────────

export type DailyEntry = {
  iso: string;
  dow: string;
  date: string;
  // Nullable: lazy /forecast-14d hydrates picker tiles 1..13 after first paint.
  glyph: string | null;
  score: number | null;
  high: number | null;
  low: number | null;
};

// ─── Seasonality ──────────────────────────────────────────────────────

export type SeasonState = "peak" | "shoulder" | "off" | "closed" | "nodata";

// ─── Aligning factors ─────────────────────────────────────────────────

export type FactorVerdict = "Prime" | "Fair" | "Poor";
export type TodayFactor = {
  label: string;
  status: FactorVerdict;
  contribution: number;
  valueLine: string | null;
};

// ─── Regulations ──────────────────────────────────────────────────────

export type RegStatus = "Open" | "Release" | "Closed";

export type LiveRegulation = {
  speciesId: string | null;
  speciesCommon: string;
  status: RegStatus;
  dailyLimit: number | null;
  sizeLimitCm: number | null;
  sizeLimitMaxCm: number | null;
  gearRestrictions: string | null;
  notes: string | null;
  source: string | null;
  detail: string;
  seasonOpenDate: string | null;
  seasonCloseDate: string | null;
};

// ─── Catch signals ────────────────────────────────────────────────────

export type LiveCatchSignal = {
  id: string;
  speciesId: string | null;
  speciesName: string | null;
  reportDate: string | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  wasSuccessful: boolean | null;
  fishCount: number | null;
  fishSizeLb: number | null;
  technique: string | null;
  depthFt: number | null;
  tidePhase: string | null;
  timeOfDay: string | null;
  excerpt: string;
  sourceDomain: string | null;
  sourceUrl: string | null;
  finalConfidence: number | null;
  daysAgo: number | null;
};

// ─── Sun events ───────────────────────────────────────────────────────

export type SunHours = {
  nauticalRise: number;
  civilRise: number;
  sunrise: number;
  sunset: number;
  civilSet: number;
  nauticalSet: number;
};

// ─── Guide notes ──────────────────────────────────────────────────────

export type GuideNote = {
  text: string;
  author: string;
  date: string;
};

// ─── Nearby spots ─────────────────────────────────────────────────────

export type NearbySpotCard = {
  id: string;
  name: string;
  dfoArea: string;
  href: string | null;
  species: { name: string; score: number }[];
  biteWindow: string | null;
  seasonState: "peak" | "shoulder" | "off" | "closed";
  intel: { verdict: "strong" | "mixed" | "slow"; count: number; last: string } | null;
  windKt: number;
  windDir: string;
  tide: {
    nextHigh: { time: string; heightM: number };
    nextLow: { time: string; heightM: number };
  };
  scoreNext24h: (number | null)[];
  scoreTopSpeciesName: string;
};

// ─── Composite payload ────────────────────────────────────────────────

export type LiveSpotDetail = {
  spot: LiveSpot;
  species: LiveSpecies[];
  hourlyScoreGrid: Record<string, (number | null)[][]>;
  hourlyConditionsGrid: HourlyConditions[][];
  daily14: DailyEntry[];
  tide14d: LiveTidePoint[];
  rightNow: RightNowSnapshot | null;
  todayFactorsBySpecies: Record<string, TodayFactor[]>;
  topScoreTodayBySpecies: Record<string, number>;
  topScoreHourBySpecies: Record<string, number>;
  regulations: LiveRegulation[];
  regAreaCode: string | null;
  catchSignals: LiveCatchSignal[];
  intelVerdict: "strong" | "mixed" | "slow" | null;
  tideStationName: string | null;
  seasonStateBySpecies: Record<string, SeasonState>;
  seasonWeeksBySpecies: Record<string, SeasonState[]>;
  todayWeek: number;
  sun: SunHours;
  guideNotes: GuideNote[];
  nearbySpots: NearbySpotCard[];
};

// ─── Slicer outputs ───────────────────────────────────────────────────

export type SpotPageInitial = Omit<
  LiveSpotDetail,
  "hourlyScoreGrid" | "hourlyConditionsGrid" | "tide14d" | "daily14"
> & {
  hourlyScoreGrid: Record<string, (number | null)[][]>;
  hourlyConditionsGrid: HourlyConditions[][];
  tide14d: LiveTidePoint[];
  daily14: DailyEntry[];
};

export type Forecast14dPayload = {
  daily14: DailyEntry[];
  hourlyScoreGrid: Record<string, (number | null)[][]>;
  hourlyConditionsGrid: HourlyConditions[][];
  tide14d: LiveTidePoint[];
};

// ─── Score breakdown (factor contributions over time) ──────────────────
// Wire shape of GET /api/v1/fishing-spots/[id]/score?species=<id>&days=N
// (multi-day mode). Powers the spot-detail "Score explained" charts — each
// hour carries the full per-factor breakdown (fit, weight, contribution).

export type ScoreHour = {
  hour_utc: string;
  stocks: Array<{
    stock_id: string;
    score: number;
    factor_contributions: FactorContributions | null;
  }>;
};

export type ScoreSpeciesEntry = {
  best_score: number | null;
  best_hour_utc: string | null;
  hours: ScoreHour[];
};

export type ScoreDay = {
  date: string; // YYYY-MM-DD
  species: Record<string, ScoreSpeciesEntry>;
};

export type SpotScorePayload = {
  spot_id: string;
  species_ids: string[];
  forecast_version: number;
  days: ScoreDay[];
  meta?: { days_requested: number; days_returned: number };
};

// ─── Point conditions ──────────────────────────────────────────────────
// Wire shape of GET /api/map/point-conditions?lat&lng. Surfaces the fields
// the spot-page payload omits (pressure + trend, minutes-to-slack, moon).

export type PointConditionsCell = {
  air_temp_c: number | null;
  wind_speed_kt: number | null;
  wind_direction_deg: number | null;
  wind_gust_kt: number | null;
  barometric_pressure_hpa: number | null;
  pressure_trend_3h: number | null;
  cloud_cover_pct: number | null;
  precipitation_mm: number | null;
  sea_surface_temp_c: number | null;
  wave_height_m: number | null;
  swell_height_m: number | null;
  tide_height_m: number | null;
  tide_phase: string | null;
  minutes_to_next_slack: number | null;
  moon_phase: number | null;
  moon_illumination_pct: number | null;
};

export type PointConditions = {
  lat: number;
  lng: number;
  hour_utc: string;
  conditions: PointConditionsCell | null;
};
