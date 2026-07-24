// Builds the 14-day forecast strip from a spot's forecast-14d payload.
// Day scores come from the spot's best-species hourly grid (0–100, same
// scale the engine emits) so the strip stays species-consistent with its
// "· CHINOOK" header; dow/date come from daily14. Days past the caller's
// horizon are locked: signed-out visitors see 2 days, free accounts 7,
// Pro all 14.

import type { Forecast14dPayload } from "@/lib/bluecaster/live-spot-types";
import type { MapForecast14dPayload } from "@/lib/bluecaster";
import { tierFor, fmtPeak, type Tier } from "./explore-data";

/** Signed-out visitors see the first 2 days. */
export const ANON_STRIP_DAYS = 2;
/** Free accounts see the first 7 days; days 8–14 are Pro. */
export const FREE_STRIP_DAYS = 7;

/** The caller's access level — decides how many strip days are unlocked. */
export type ForecastTier = "anonymous" | "free" | "pro";

/** Which plan a locked day belongs to — drives the tile label + tap action. */
export type LockTier = "free" | "pro";

export function stripDaysFor(tier: ForecastTier): number {
  if (tier === "pro") return 14;
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
  peakLabel: string | null; // "11:00"
  tier: Tier;
  locked: boolean;
  /** null when unlocked; otherwise the plan that unlocks this day. */
  lockTier: LockTier | null;
  isBest: boolean;
  /** True when the selected species can't be retained on this day (a score
   *  would read as bad fishing when the fish are there but non-retention).
   *  Set for days before the species' reopen date; the cell shows a label. */
  nonRetention: boolean;
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
): ForecastStripModel {
  const series = speciesFilter
    ? payload.by_species[speciesFilter] ?? []
    : payload.best;
  const visible = stripDaysFor(accessTier);

  const days: ForecastDay[] = payload.days.map((d, i) => {
    const cell = series[i] ?? null;
    const lockTier = lockTierAt(i, visible);
    const locked = lockTier !== null;
    return {
      index: i,
      iso: d.iso,
      dow: d.dow.charAt(0).toUpperCase() + d.dow.slice(1).toLowerCase(),
      date: d.date,
      score: cell?.score ?? null,
      peakLabel: locked ? null : fmtPeak(cell?.peak_hour ?? null),
      tier: tierFor(cell?.score ?? null),
      locked,
      lockTier,
      isBest: false,
      // Viewport strip is the best-across-spots score, not a single species'
      // legality — no per-day non-retention concept here.
      nonRetention: false,
    };
  });

  return finishModel(days);
}

// "Best" = highest-scoring unlocked, retainable day (the BEST ★ badge +
// best-window line). Non-retention days never win it.
function finishModel(days: ForecastDay[]): ForecastStripModel {
  let bestDay: ForecastDay | null = null;
  for (const day of days) {
    if (day.locked || day.nonRetention || day.score === null) continue;
    if (!bestDay || day.score > (bestDay.score ?? -1)) bestDay = day;
  }
  if (bestDay) bestDay.isBest = true;

  return { days, bestIso: bestDay?.iso ?? null, bestDay };
}
