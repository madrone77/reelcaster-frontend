import type { HourlyConditions } from "@/lib/bluecaster/live-spot-types";
import type { TerminalHours } from "@/app/explore/spot/components/spot-terminal";
import { readSea } from "./sea-state";

/**
 * One day of hourly conditions, folded into the arrays SpotTerminal draws.
 *
 * Written down once because it was written down three times. The spot page,
 * the city instrument and the landing page's conditions phone all draw the
 * same chart from the same payload, and all three had their own copy of this
 * — identical, and free to drift the next time the sea-state fallback or the
 * key list changes. A chart that means one thing on the spot page and another
 * on the ad it was sold with is the kind of disagreement nobody notices until
 * a reader does.
 *
 * `scores` is the species' 24 hourly scores for the same day; it rides along
 * rather than being derived here because each caller picks its own species.
 */
export function buildTerminalHours(
  day: HourlyConditions[] | null | undefined,
  scores: (number | null)[],
): TerminalHours {
  const g = day ?? [];
  const pick = (
    key:
      | "tideM"
      | "windKt"
      | "windGustKt"
      | "windDirDeg"
      | "waveM"
      | "cloudPct"
      | "precipMm"
      | "airTempC",
  ) =>
    Array.from(
      { length: 24 },
      (_, i) => (g[i]?.[key] ?? null) as number | null,
    );
  const wind = pick("windKt");
  const gust = pick("windGustKt");
  // Sea state reads BlueCaster's `sea` object (swell and chop split out, a
  // label the scorer agrees with) and falls back to the combined height, then
  // to a wind-derived estimate, hour by hour: the wave grid has dry-land cells
  // (Point Robinson never gets a wave height at all) and its wave partition
  // runs out around day 10. `seaEst` flags which hours are inferred so the
  // chart can say so rather than passing an estimate off as a model reading.
  const seaRead = Array.from({ length: 24 }, (_, i) => readSea(g[i]));
  return {
    score: scores,
    tide: pick("tideM"),
    wind,
    gust,
    windDir: pick("windDirDeg"),
    sea: seaRead.map((r) => r?.heightM ?? null),
    seaEst: seaRead.map((r) => r?.estimated ?? false),
    seaLabel: seaRead.map((r) => r?.label ?? null),
    swell: seaRead.map((r) => r?.swell ?? null),
    chop: seaRead.map((r) => r?.chop ?? null),
    seaReason: seaRead.map((r) => r?.reason ?? null),
    cloud: pick("cloudPct"),
    precip: pick("precipMm"),
    air: pick("airTempC"),
  };
}

/**
 * Tide min/max across every forecast day in the grid.
 *
 * Fixed across days on purpose, so flipping the day moves the curve rather
 * than re-fitting the axis under it — a tide row whose scale changed with the
 * day would make a 2 ft range and a 12 ft range draw the same picture.
 */
export function tideRangeFrom(
  grid: HourlyConditions[][] | null | undefined,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const day of grid ?? []) {
    for (const h of day ?? []) {
      const t = h?.tideM;
      if (typeof t === "number" && Number.isFinite(t)) {
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
  }
  return min <= max ? { min, max } : null;
}
