// Builds the 14-day forecast strip from a spot's forecast-14d payload.
// Day scores come from the spot's best-species hourly grid (0–100, same
// scale the engine emits) so the strip stays species-consistent with its
// "· CHINOOK" header; dow/date come from daily14. Days past the free
// horizon are locked for non-paying users (Boat Pro).

import type { Forecast14dPayload } from "@/lib/bluecaster/live-spot-types";
import { tierFor, fmtPeak, type Tier } from "./explore-data";

/** Free users see the first 10 days; days 11–14 are Boat Pro. */
export const FREE_STRIP_DAYS = 10;

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
  isBest: boolean;
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
  isPaid: boolean,
): ForecastStripModel {
  const grid = bestSpeciesId
    ? payload.hourlyScoreGrid[bestSpeciesId]
    : undefined;

  const days: ForecastDay[] = payload.daily14.map((d, i) => {
    const fromGrid = peakOf(grid?.[i]);
    // Prefer the species-specific daily peak; fall back to the overall
    // daily score the engine already computed.
    const score = fromGrid.score ?? d.score ?? null;
    const locked = !isPaid && i >= FREE_STRIP_DAYS;
    return {
      index: i,
      iso: d.iso,
      dow: d.dow.charAt(0).toUpperCase() + d.dow.slice(1).toLowerCase(),
      date: d.date,
      score,
      peakLabel: locked ? null : fmtPeak(fromGrid.hour),
      tier: tierFor(score),
      locked,
      isBest: false,
    };
  });

  // "Best" = highest-scoring unlocked day (the BEST ★ badge + best-window line).
  let bestDay: ForecastDay | null = null;
  for (const day of days) {
    if (day.locked || day.score === null) continue;
    if (!bestDay || day.score > (bestDay.score ?? -1)) bestDay = day;
  }
  if (bestDay) bestDay.isBest = true;

  return { days, bestIso: bestDay?.iso ?? null, bestDay };
}
