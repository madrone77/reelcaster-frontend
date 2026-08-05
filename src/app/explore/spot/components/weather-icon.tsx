"use client";

import type { HourlyConditions } from "@/lib/bluecaster/live-spot-types";

// Single source of truth for spot-page weather iconography. One classifier +
// one icon set, consumed by BOTH the 24-hour graph (imperative SVG string, via
// `weatherIconMarkup`) and the 14-day strip (React, via `<WeatherIcon>`).
//
// Deliberately monochrome: line icons, single stroke weight, chrome gray, no
// fill, no brand blue. Precipitation is the ONE condition that earns emphasis
// (it changes whether someone goes out) — rain/heavy-rain draw their drops in a
// heavier ink stroke. Everything else renders at equal weight.
//
// Fog is intentionally absent: the spot-page hourly payload carries no
// visibility field to derive it (see PHASE-TWO.md).

export type WeatherCondition =
  | "clear"
  | "partly"
  | "overcast"
  | "rain"
  | "heavy-rain";

// mm/h thresholds. ≥0.2 = rain, ≥2.5 = heavy. Cloud bins mirror the (now
// retired) skyWord helpers, unified here.
const HEAVY_RAIN_MM = 2.5;
const RAIN_MM = 0.2;

/** Classify one hour from cloud cover (%) + precipitation (mm/h). */
export function weatherFromHour(
  cloudPct: number | null,
  precipMm: number | null,
): WeatherCondition | null {
  if (precipMm != null && precipMm >= HEAVY_RAIN_MM) return "heavy-rain";
  if (precipMm != null && precipMm >= RAIN_MM) return "rain";
  if (cloudPct == null) return null;
  if (cloudPct < 25) return "clear";
  if (cloudPct < 70) return "partly";
  return "overcast";
}

/**
 * Dominant condition across a set of hours, weighted toward daylight and the
 * best fishing window — a clear morning with an evening squall reads "clear"
 * when the best window is at 09:00. Hours inside `[sunriseHour, sunsetHour]`
 * count; hours inside `bestWindow` count double.
 */
export function dominantWeather(
  hours: (HourlyConditions | null | undefined)[],
  opts: {
    sunriseHour?: number | null;
    sunsetHour?: number | null;
    bestWindow?: { start: number; end: number } | null;
  } = {},
): WeatherCondition | null {
  const sr = opts.sunriseHour ?? 0;
  const ss = opts.sunsetHour ?? 23;
  const bw = opts.bestWindow ?? null;
  const weight: Record<WeatherCondition, number> = {
    clear: 0,
    partly: 0,
    overcast: 0,
    rain: 0,
    "heavy-rain": 0,
  };
  let any = false;
  for (let h = 0; h < hours.length; h++) {
    // Only daylight hours vote (fall back to all hours if no sun window).
    if (opts.sunriseHour != null && opts.sunsetHour != null && (h < sr || h > ss)) {
      continue;
    }
    const cell = hours[h];
    if (!cell) continue;
    const cond = weatherFromHour(cell.cloudPct, cell.precipMm);
    if (!cond) continue;
    const inWindow = bw != null && h >= bw.start && h <= bw.end;
    weight[cond] += inWindow ? 2 : 1;
    any = true;
  }
  if (!any) return null;
  return (Object.entries(weight) as [WeatherCondition, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
}

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  overcast: "Overcast",
  rain: "Rain",
  "heavy-rain": "Heavy rain",
};

// ── icon geometry (one 24×24 source, shared by React + the SVG string) ──────

const CLOUD =
  "M17.2 18.5 H7.3 a4.3 4.3 0 0 1 0.9-8.5 A5.8 5.8 0 0 1 19.4 11 a3.7 3.7 0 0 1 -2.2 7.5 Z";

/**
 * Inner SVG markup for a condition on a 24×24 canvas. `stroke` colors the base
 * (cloud/sun) chrome; `accent` colors precipitation drops (the one emphasis).
 * Colors are passed in so the imperative graph can use hex and React can use
 * CSS custom properties.
 */
export function weatherIconInner(
  condition: WeatherCondition,
  stroke: string,
  accent: string,
): string {
  const line = (d: string, w = 1.6, color = stroke) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sunRays = (cx: number, cy: number, r: number) =>
    [0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => {
        const rad = (a * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * (r + 1.6);
        const y1 = cy + Math.sin(rad) * (r + 1.6);
        const x2 = cx + Math.cos(rad) * (r + 3.6);
        const y2 = cy + Math.sin(rad) * (r + 3.6);
        return line(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
      })
      .join("");

  switch (condition) {
    case "clear":
      return `<circle cx="12" cy="12" r="4.2" fill="none" stroke="${stroke}" stroke-width="1.6"/>${sunRays(12, 12, 4.2)}`;
    case "partly":
      return (
        `<circle cx="9" cy="8.5" r="3.1" fill="none" stroke="${stroke}" stroke-width="1.6"/>` +
        [0, 90, 180, 270]
          .map((a) => {
            const rad = (a * Math.PI) / 180;
            return line(
              `M${(9 + Math.cos(rad) * 4.4).toFixed(1)},${(8.5 + Math.sin(rad) * 4.4).toFixed(1)} L${(9 + Math.cos(rad) * 6).toFixed(1)},${(8.5 + Math.sin(rad) * 6).toFixed(1)}`,
            );
          })
          .join("") +
        line(CLOUD, 1.6)
      );
    case "overcast":
      return line(CLOUD, 1.6);
    case "rain":
      return (
        line(CLOUD, 1.6) +
        line("M9.5 20.5 L8.5 22.5", 1.9, accent) +
        line("M14.5 20.5 L13.5 22.5", 1.9, accent)
      );
    case "heavy-rain":
      return (
        line(CLOUD, 1.6) +
        line("M8.5 20.3 L7.3 23", 2.1, accent) +
        line("M12.2 20.3 L11 23", 2.1, accent) +
        line("M15.9 20.3 L14.7 23", 2.1, accent)
      );
  }
}

/**
 * `<g>` wrapper for the imperative 24h-graph SVG string, translated + scaled to
 * a `size`-px box centered on `(x, y)`. Uses hex chrome so it matches the
 * graph's other marks; precip accent is a heavier ink, never brand blue.
 */
export function weatherIconMarkup(
  condition: WeatherCondition,
  o: { x: number; y: number; size: number; stroke?: string; accent?: string },
): string {
  const s = o.size / 24;
  const stroke = o.stroke ?? "#64748B"; // rc-ink-mute
  const accent = o.accent ?? "#0F172A"; // rc-ink
  return `<g transform="translate(${(o.x - o.size / 2).toFixed(1)},${(o.y - o.size / 2).toFixed(1)}) scale(${s.toFixed(3)})">${weatherIconInner(condition, stroke, accent)}</g>`;
}

/**
 * React weather glyph for the 14-day strip. Inherits `currentColor` so a cell
 * can recolor it (gray on white, white on the selected brand cell); precip
 * stays the emphasized condition via its heavier drop stroke.
 */
export default function WeatherIcon({
  condition,
  size = 14,
  className = "",
}: {
  condition: WeatherCondition | null;
  size?: number;
  className?: string;
}) {
  if (!condition) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={WEATHER_LABEL[condition]}
      dangerouslySetInnerHTML={{
        __html: weatherIconInner(condition, "currentColor", "currentColor"),
      }}
    />
  );
}
