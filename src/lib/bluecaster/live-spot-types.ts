// Wire-shape types for the BlueCaster live-spot endpoints:
//   GET /api/v1/spots/[slug]/spot-page        → SpotPageInitial
//   GET /api/v1/spots/[slug]/forecast-14d     → Forecast14dPayload
//
// Ported verbatim from bluecaster/app/test/_lib/{live-spot-data,spot-detail-slicers}.ts.
// Keep in sync if BC adds fields — the lazy 14d merge in the component relies
// on the same key names appearing in both payloads.

// ─── Spot identity ─────────────────────────────────────────────────────

import type { CreelAreaReport } from "./creel-types";

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

// Effective regulatory state per week — a SEPARATE axis from SeasonState
// (biological abundance). A week can be abundance "peak" and regulatory
// "release_only" at the same time. Drives the SeasonalityStrip's hatch
// overlay. "nodata" = no regulation resolved for that week (no overlay).
export type RegWeekState = "retention_open" | "release_only" | "closed" | "nodata";

// ─── Aligning factors ─────────────────────────────────────────────────

export type FactorVerdict = "Prime" | "Fair" | "Poor";
export type TodayFactor = {
  label: string;
  status: FactorVerdict;
  contribution: number;
  /** Server-composed fragment — fallback when we can't compose from key+raw. */
  valueLine: string | null;
  /** Engine factor key (e.g. "tidal_current_speed_kt"); optional until the
   * structured-factor API change is deployed everywhere. */
  key?: string;
  /** Raw engine value at the peak hour — number for metric factors
   * (kn / m / °C / hPa / km per the key), string for enums. */
  raw?: number | string | null;
};

// ─── Regulations ──────────────────────────────────────────────────────

export type RegStatus = "Open" | "Release" | "Closed";

// Provenance of a regulation value. `confirmed` = a verified standing reg or an
// active DFO notice; `expected` = an unverified default/seasonal pattern. The
// panel renders expected in muted contrast — never as confirmed.
export type RegChangeConfidence = "confirmed" | "expected";

export type LiveRegulation = {
  speciesId: string | null;
  speciesCommon: string;
  status: RegStatus;
  dailyLimit: number | null;
  // Fish that may be held in possession. Null → "Not published".
  possessionLimit: number | null;
  sizeLimitCm: number | null;
  sizeLimitMaxCm: number | null;
  gearRestrictions: string | null;
  // Annual/seasonal quota where one applies. Null → "Not published".
  annualLimit: number | null;
  // Whether this row is notice-backed/verified (`confirmed`) or an unverified
  // default (`expected`).
  confidence: RegChangeConfidence;
  notes: string | null;
  source: string | null;
  detail: string;
  seasonOpenDate: string | null;
  seasonCloseDate: string | null;
  // Next date (YYYY-MM-DD) this species reopens to retention, per the DFO
  // opening calendar (bluecaster spot-page BFF). Null when open now / no
  // calendar. Lets non-retention species show "Non-retention · opens Aug 1".
  nextOpenDate: string | null;
  nextOpenSummary: string | null;
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
  /**
   * Who numbers `dfoArea` — "DFO" | "WDFW". Per-card, because "within easy
   * run" of the San Juans crosses into BC: this rail routinely mixes
   * jurisdictions, and one agency for the whole rail is wrong for whichever
   * half sits on the other side of the line. Pass it to `areaLabelFor`.
   */
  areaAgency: string | null;
  href: string | null;
  species: { name: string; score: number }[];
  biteWindow: string | null;
  /** Biological abundance of the card's top species this week — same axis as
   *  the seasonality strip's fill. "closed" belongs to the regulatory axis and
   *  is not emitted here; "nodata" means the city has no curve for it. */
  seasonState: SeasonState;
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
  /**
   * Who numbers `regAreaCode` and governs the rows above it — "DFO" | "WDFW".
   *
   * The agency travels with the number because the page cannot work it out. A
   * spot's jurisdiction is NOT reliably its city's: East Point (Saturna
   * Island) is a BC mark in DFO subarea 18-11 sitting on friday-harbor-wa's
   * roster, because a spot belongs to the nearest city and the nearest city
   * can be across a border. Resolving the authority from that city cited WDFW
   * and linked wdfw.wa.gov for Canadian water. Pass it to `regulatorFrom`.
   *
   * Null when the spot has no area, or on a payload predating the field.
   */
  regAgency: string | null;
  // Newest verified_at/updated_at across the reg rows (ISO), for the panel's
  // "synced …" attribution line. Null when no row carries a timestamp.
  regSyncedAt: string | null;
  catchSignals: LiveCatchSignal[];
  intelVerdict: "strong" | "mixed" | "slow" | null;
  /**
   * Written summary of the recent report window, produced by BlueCaster's
   * intel-digest job and grounded in real angler posts. Null whenever the spot
   * has too little evidence, sits outside covered water, or the summary failed
   * its grounding check. Null means render nothing: an absent block beats a
   * thin one.
   */
  recentReports: RecentReports | null;
  /**
   * WDFW dockside creel checks for the marine area this spot sits in, over
   * the trailing fortnight. AREA grain, never this spot's own tally, and
   * kept fish only. Official public data: it is not paid intel and is not
   * stripped before the client. Null outside Washington and when no sampler
   * was out. See creel-types.ts.
   */
  creelReport: CreelAreaReport | null;
  tideStationName: string | null;
  seasonStateBySpecies: Record<string, SeasonState>;
  seasonWeeksBySpecies: Record<string, SeasonState[]>;
  // 52-week effective regulatory vector per species, aligned week-for-week to
  // seasonWeeksBySpecies. Drives the strip's release-only / closed hatch
  // overlay. Species with no resolvable regulation row are omitted.
  regWeeksBySpecies: Record<string, RegWeekState[]>;
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
  /** Now-current at the point (SalishSeaCast bake); flow-toward bearing. */
  current?: { speed_kn: number; dir_deg: number } | null;
};

/** A named place a species is actually caught, when it was reported at a spot
 *  that is not its ground. */
export interface RecentReportsPlace {
  name: string;
  km: number;
}

export interface RecentReportsSpecies {
  name: string;
  posts: number;
  positive: number;
  state: "biting" | "patchy" | "quiet";
  note: string;
}

/** Species reported at this spot but credited to the water around it. A single
 *  post often covers several marks, so a catch named alongside this spot did not
 *  necessarily happen on it. */
export interface RecentReportsNearby extends RecentReportsSpecies {
  likelySpots: RecentReportsPlace[];
}

export interface RecentReports {
  headline: string;
  body: string;
  species: RecentReportsSpecies[];
  nearby: RecentReportsNearby[];
  /** Depth, gear, timing pulled out of the prose of the reports themselves. */
  whatWorked: string[];
  reportCount: number;
  /** Of those reports, how many landed a fish. Counted per outing. */
  landedCount: number;
  latestDate: string | null;
  windowDays: number;
}
