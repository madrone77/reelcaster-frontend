// Builds the 14-day forecast strip from a spot's forecast-14d payload.
// Day scores come from the spot's best-species hourly grid (0–100, same
// scale the engine emits) so the strip stays species-consistent with its
// "· CHINOOK" header; dow/date come from daily14. Days past the caller's
// horizon are locked: signed-out visitors see 2 days, free accounts 7,
// Pro all 14.

import type {
  Forecast14dPayload,
  HourlyConditions,
  SunHours,
} from "@/lib/bluecaster/live-spot-types";
import type {
  MapForecast14dPayload,
  MapForecastDayConditions,
} from "@/lib/bluecaster";
import { tierFor, fmtPeak, type Tier } from "./explore-data";
import {
  dominantWeather,
  type WeatherCondition,
} from "../spot/components/weather-icon";

/** Signed-out visitors see the first 2 days. */
export const ANON_STRIP_DAYS = 2;
/** Free accounts see the first 7 days; days 8–14 are Pro. */
export const FREE_STRIP_DAYS = 7;

/**
 * The caller's access level, which decides how many strip days are unlocked.
 *
 * "today" is not a plan. It is the tightest ad-page wall (see ad-mode.ts):
 * one day open, everything after it locked. The three real tiers still say
 * what a locked day COSTS, so a day-3 tile on an ad page reads "free account"
 * and a day-9 tile reads "Pro", which is what those days actually cost. The
 * wall changes what this visitor is shown, never what the product charges.
 */
export type ForecastTier = "anonymous" | "free" | "pro" | "today";

/** Which plan a locked day belongs to — drives the tile label + tap action. */
export type LockTier = "free" | "pro";

/** The ad page's tightest wall: today only. */
export const AD_TODAY_STRIP_DAYS = 1;

export function stripDaysFor(tier: ForecastTier): number {
  if (tier === "pro") return 14;
  if (tier === "today") return AD_TODAY_STRIP_DAYS;
  return tier === "free" ? FREE_STRIP_DAYS : ANON_STRIP_DAYS;
}

function lockTierAt(index: number, visible: number): LockTier | null {
  if (index < visible) return null;
  return index < FREE_STRIP_DAYS ? "free" : "pro";
}

export interface ForecastDay {
  index: number;
  iso: string; // YYYY-MM-DD
  dow: string; // "Wed" — day cells uppercase via CSS (rc-label); the
  //              best-window callout keeps it title case ("Best window Wed…")
  date: string; // "May 14"
  score: number | null; // 0–100 day peak for the driver species
  peakLabel: string | null; // "11 AM"
  tier: Tier;
  locked: boolean;
  /** null when unlocked; otherwise the plan that unlocks this day. */
  lockTier: LockTier | null;
  isBest: boolean;
  /** True when the selected species can't be retained on this day (a score
   *  would read as bad fishing when the fish are there but non-retention).
   *  Set for days before the species' reopen date; the cell shows a label. */
  nonRetention: boolean;
  /** Dominant daylight weather (best-window-weighted); null until the 14-day
   *  conditions grid loads, or on the viewport strip. Drives the weather icon. */
  weather: WeatherCondition | null;
  /**
   * We do not yet know whether this day is locked, so it renders as a skeleton
   * rather than committing to either answer.
   *
   * Only the server-prefetched strip sets this. That payload is built without a
   * session — it is baked into a statically rendered page — so it carries the
   * anonymous horizon and nothing beyond it. For a signed-out visitor that is
   * already the truth. For a Pro account it is not, and drawing a padlock over
   * days they have paid for, for as long as it takes the tier to resolve, is
   * the lock-then-unlock flash this app has fixed twice on the spot page. So
   * the days past the anonymous horizon stay pending until either the tier
   * comes back anonymous (they were locked all along) or the tier-correct
   * payload lands (they fill in).
   */
  pending: boolean;
}

/**
 * One viewport day's cloud/precip arrays → the `HourlyConditions` shape
 * `dominantWeather` reads. The map payload carries only the two fields the
 * classifier actually looks at (see `MapForecastDayConditions`), so the rest
 * are filled null rather than invented — this feeds an icon, not a readout.
 */
function viewportHours(
  day: MapForecastDayConditions | null | undefined,
): (HourlyConditions | null)[] | undefined {
  if (!day) return undefined;
  return Array.from({ length: 24 }, (_, h) => ({
    windKt: null,
    windGustKt: null,
    windDir: null,
    windDirDeg: null,
    cloudPct: day.cloud_pct[h] ?? null,
    airTempC: null,
    precipMm: day.precip_mm[h] ?? null,
    seaTempC: null,
    swellM: null,
    waveM: null,
    tideM: null,
    tideTrend: null,
  })) as HourlyConditions[];
}

/** Per-day dominant weather — daylight hours, weighted toward the day's best
 *  window (its peak hour). Falls back to a 06–20 band when sun isn't available. */
function dayWeather(
  hours: (HourlyConditions | null | undefined)[] | undefined,
  sun: SunHours | null | undefined,
  peakHour: number | null,
): WeatherCondition | null {
  if (!hours || hours.length === 0) return null;
  return dominantWeather(hours, {
    sunriseHour: sun ? Math.round(sun.sunrise) : 6,
    sunsetHour: sun ? Math.round(sun.sunset) : 20,
    bestWindow:
      peakHour != null ? { start: peakHour - 1, end: peakHour + 1 } : null,
  });
}

/** The selected species' effective regulation, enough to decide per-day
 *  non-retention: status "today" + the next retention-open date. */
export interface StripRegulation {
  status: string; // "Open" | "Release" | "Closed"
  nextOpenDate: string | null; // YYYY-MM-DD, or null when no reopening
}

/** Whether the selected species is non-retention on `iso` (YYYY-MM-DD):
 *  currently release-only/closed AND before its reopen date (or no reopen). */
function isNonRetentionOn(reg: StripRegulation | null | undefined, iso: string): boolean {
  if (!reg) return false;
  if (reg.status !== "Release" && reg.status !== "Closed") return false;
  return reg.nextOpenDate == null || iso < reg.nextOpenDate;
}

/**
 * Height of the desktop docked strip, in px.
 *
 * Sized to the tallest thing it has to contain — a whole `DayCell` — rather
 * than picked. It was 128, which left the cells row 83px for a cell whose
 * content measures 93, so every collapsed day hung its peak-time chip 11px
 * below its own border and 1px below the bar. Three files encoded 128
 * independently (the bar, the map inset, the rail's bottom inset), which is
 * how it could be wrong in one place and right in the others; they now all
 * read this.
 *
 * Budget: py-2.5 (20) + header (17) + mb-2 (8) + cells (93) = 138, plus 2 of
 * slack. Raise it if DayCell grows.
 */
export const DESKTOP_STRIP_H = 140;

export interface ForecastStripModel {
  days: ForecastDay[];
  /** ISO of the highest-scoring unlocked day — drives the "best window" line. */
  bestIso: string | null;
  bestDay: ForecastDay | null;
}

function peakOf(series: (number | null)[] | undefined): {
  score: number | null;
  hour: number | null;
} {
  if (!series) return { score: null, hour: null };
  let score = -1;
  let hour = -1;
  for (let h = 0; h < series.length; h++) {
    const v = series[h];
    if (typeof v === "number" && v > score) {
      score = v;
      hour = h;
    }
  }
  return score >= 0 ? { score, hour } : { score: null, hour: null };
}

export function buildForecastDays(
  payload: Forecast14dPayload,
  bestSpeciesId: string | null,
  accessTier: ForecastTier,
  // The map-spots hourly series for one day (the selected day). The map
  // pins and spot drawer render from map/spots, the strip from forecast-14d
  // — two payloads cached independently, so a forecast re-bake between the
  // fetches can leave the selected day's cell a couple points off the card.
  // The override pins that day's cell to the exact series the other
  // surfaces show.
  override?: { iso: string; hours: (number | null)[] } | null,
  // The selected species' regulation — when it's non-retention, days before
  // its reopen date show a "Non-retention" label instead of a (misleading) score.
  reg?: StripRegulation | null,
  // Sun times for the daylight window used by the per-day weather icon.
  sun?: SunHours | null,
): ForecastStripModel {
  const grid = bestSpeciesId
    ? payload.hourlyScoreGrid[bestSpeciesId]
    : undefined;
  const visible = stripDaysFor(accessTier);

  const days: ForecastDay[] = payload.daily14.map((d, i) => {
    let fromGrid = peakOf(grid?.[i]);
    if (override && d.iso === override.iso) {
      const fromOverride = peakOf(override.hours);
      if (fromOverride.score !== null) fromGrid = fromOverride;
    }
    // Prefer the species-specific daily peak; fall back to the overall
    // daily score the engine already computed.
    const score = fromGrid.score ?? d.score ?? null;
    const nonRetention = isNonRetentionOn(reg, d.iso);
    // A non-retention day has no retention score to gate — show the label
    // ungated rather than a lock/paywall.
    const lockTier = nonRetention ? null : lockTierAt(i, visible);
    const locked = lockTier !== null;
    return {
      index: i,
      iso: d.iso,
      dow: d.dow.charAt(0).toUpperCase() + d.dow.slice(1).toLowerCase(),
      date: d.date,
      score,
      peakLabel: locked || nonRetention ? null : fmtPeak(fromGrid.hour),
      tier: tierFor(score),
      locked,
      lockTier,
      isBest: false,
      nonRetention,
      weather: dayWeather(payload.hourlyConditionsGrid?.[i], sun, fromGrid.hour),
      // The spot page fetches its own payload under the caller's session, so
      // its lock states are final on arrival — nothing to resolve later.
      pending: false,
    };
  });

  return finishModel(days);
}

/**
 * Viewport variant: builds the strip from the map/forecast-14d payload —
 * each day's cell is the best score across every spot in the current map
 * viewport (honouring the species filter), so panning the map re-answers
 * "when should I fish the area I'm looking at".
 */
export function buildViewportForecastDays(
  payload: MapForecast14dPayload,
  speciesFilter: string | null,
  accessTier: ForecastTier,
  /**
   * Index from which the payload cannot be trusted to say whether a day is
   * locked — see `ForecastDay.pending`. null (the default) means the payload
   * and the tier agree and every cell is final.
   */
  pendingFrom: number | null = null,
): ForecastStripModel {
  const series = speciesFilter
    ? payload.by_species[speciesFilter] ?? []
    : payload.best;
  const visible = stripDaysFor(accessTier);

  const days: ForecastDay[] = payload.days.map((d, i) => {
    const cell = series[i] ?? null;
    const pending = pendingFrom !== null && i >= pendingFrom;
    const lockTier = pending ? null : lockTierAt(i, visible);
    const locked = lockTier !== null;
    return {
      index: i,
      iso: d.iso,
      dow: d.dow.charAt(0).toUpperCase() + d.dow.slice(1).toLowerCase(),
      date: d.date,
      score: pending ? null : cell?.score ?? null,
      peakLabel: locked || pending ? null : fmtPeak(cell?.peak_hour ?? null),
      tier: tierFor(pending ? null : cell?.score ?? null),
      locked,
      lockTier,
      isBest: false,
      // Viewport strip is the best-across-spots score, not a single species'
      // legality — no per-day non-retention concept here.
      nonRetention: false,
      // Same classifier the spot page's tiles use, over the fortnight's sky at
      // the payload's representative in-scope spot (`meta.weather_spot_id`).
      // Sun times are per-spot and the viewport has no single one, so this
      // falls back to `dayWeather`'s 06–20 daylight band.
      weather: dayWeather(
        viewportHours(payload.hourly_conditions?.[i]),
        null,
        cell?.peak_hour ?? null,
      ),
      pending,
    };
  });

  return finishModel(days);
}

// "Best" = highest-scoring unlocked, retainable day (the BEST ★ badge +
// best-window line). Non-retention days never win it, and neither do pending
// ones — a day still resolving has no score to compare, and letting the badge
// land on it would make it jump when the real payload arrives.
function finishModel(days: ForecastDay[]): ForecastStripModel {
  let bestDay: ForecastDay | null = null;
  for (const day of days) {
    if (day.locked || day.pending || day.nonRetention || day.score === null) continue;
    if (!bestDay || day.score > (bestDay.score ?? -1)) bestDay = day;
  }
  if (bestDay) bestDay.isBest = true;

  return { days, bestIso: bestDay?.iso ?? null, bestDay };
}
