"use client";

import type {
  RightNowSnapshot,
  PointConditions,
} from "@/lib/bluecaster/live-spot-types";
import type { CurrentSample } from "@/lib/bluecaster-client";
import { niceCurrentScale, nextSlackHour } from "../../lib/current-series";
import { tierFor, type Tier } from "../../lib/explore-data";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertHeight,
  convertTemp,
  convertWind,
  formatHeight,
  formatWind,
} from "@/app/utils/unit-conversions";
import WeatherIcon, {
  weatherFromHour,
  type WeatherCondition,
} from "./weather-icon";

const DASH = "—";

/** Anchor on the 24-hour graph section; the weather cell links here. */
const CONDITIONS_ANCHOR = "#conditions-24h";

// Sea-state words — one vocabulary with the 24h chart and the old panel.
function seaState(wav: number | null): string | null {
  if (wav == null) return null;
  if (wav < 0.2) return "Calm";
  if (wav < 0.35) return "Rippled";
  if (wav < 0.65) return "Light chop";
  if (wav < 1.0) return "Choppy";
  return "Rough";
}

/** Air-temp word — same bands as the 24h chart's AIR row. */
function airWord(t: number | null): string | null {
  if (t == null) return null;
  return t < 11 ? "Cold" : t < 18 ? "Mild" : "Warm";
}

const WEATHER_WORD: Record<WeatherCondition, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  overcast: "Overcast",
  rain: "Rain",
  "heavy-rain": "Heavy rain",
};

// Score numeral color by tier — matches the day cells / terminal.
const TIER_INK: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};
const TIER_WORD: Record<Tier, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Tough",
  none: "—",
};

const hh = (t: number) => {
  let h = Math.floor(t);
  let m = Math.round((t - h) * 60);
  if (m === 60) { h++; m = 0; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Tidal acceleration term from the signed current series: Turning (slack),
 * Building (magnitude rising), Peak Flood / Peak Ebb (at a local max), or
 * Easing (magnitude falling). Falls back to the coarse tide trend when the
 * predicted current series hasn't loaded.
 */
function tideAccel(
  signed: (number | null)[] | null,
  nowHour: number,
  slackThr: number,
  tideTrend: "rising" | "falling" | null,
): string | null {
  const v = signed?.[nowHour];
  if (v == null) {
    // No current series yet — name the direction from the tide trend.
    return tideTrend === "rising" ? "Flooding" : tideTrend === "falling" ? "Ebbing" : null;
  }
  const mag = Math.abs(v);
  if (mag < slackThr) return "Turning";
  const prev = signed?.[nowHour - 1];
  const next = signed?.[nowHour + 1];
  const magPrev = prev != null ? Math.abs(prev) : mag;
  const magNext = next != null ? Math.abs(next) : mag;
  if (mag >= magPrev && mag >= magNext) return v > 0 ? "Peak flood" : "Peak ebb";
  if (magNext > mag) return "Building";
  return "Easing";
}

type Cell = {
  label: string;
  value: string;
  sub?: string | null;
  /** Trailing glyph (trend arrow / weather icon). */
  glyph?: React.ReactNode;
  /** Tier ink override for the value (score cell). */
  valueClass?: string;
  /** When set, the cell renders as an in-page link. */
  href?: string;
};

/**
 * The spot's "now" data strip — a single row of the numbers that drive the
 * read: score, then the conditions in the same order the 24h graph stacks them
 * (tide · current · wind · sea state · air temp), capped with a weather cell
 * (icon) that links down to the full 24-hour graph. This is the ONE place the
 * now-state lives; the 24h graph no longer repeats these as right-gutter
 * readouts. Values are the current hour and don't follow the graph scrub.
 */
export default function CurrentConditionsStrip({
  rightNow,
  score = null,
  currentSigned = null,
  currentSample = null,
  point = null,
  nowHour = 0,
}: {
  rightNow: RightNowSnapshot | null;
  /** Current-hour score for the selected species (0–100). */
  score?: number | null;
  currentSigned?: (number | null)[] | null;
  currentSample?: CurrentSample | null;
  point?: PointConditions | null;
  nowHour?: number;
}) {
  const { windUnit, currentUnit, tempUnit, tideUnit, waveUnit } = useUnitPreferences();
  const rn = rightNow;

  // ── current (signed series first, point sample fallback) ──────────────
  const signedNow = currentSigned?.[nowHour] ?? null;
  const slackThr = currentSigned
    ? Math.min(0.3, Math.max(0.1, 0.2 * niceCurrentScale(currentSigned)))
    : 0.3;
  const curSpeed =
    signedNow != null
      ? Math.abs(signedNow)
      : (currentSample?.speed_kn ?? point?.current?.speed_kn ?? null);
  const curSet =
    signedNow != null
      ? Math.abs(signedNow) < slackThr
        ? "Slack"
        : signedNow > 0
          ? "Flood"
          : "Ebb"
      : rn?.tideTrend === "rising"
        ? "Flood"
        : rn?.tideTrend === "falling"
          ? "Ebb"
          : null;
  const slackAt = currentSigned ? nextSlackHour(currentSigned, nowHour) : null;

  // ── tide ──────────────────────────────────────────────────────────────
  const tideArrow =
    rn?.tideTrend === "rising" ? "▲" : rn?.tideTrend === "falling" ? "▼" : "";
  const accel = tideAccel(currentSigned, nowHour, slackThr, rn?.tideTrend ?? null);

  // ── air temp + weather ─────────────────────────────────────────────────
  const airC = rn?.airTempC ?? null;
  const wx: WeatherCondition | null =
    rn ? weatherFromHour(rn.cloudPct, rn.precipMm) : null;

  const gusty =
    rn?.windKt != null && rn?.windGustKt != null && rn.windGustKt - rn.windKt > 8;

  const scoreTier = tierFor(score);

  const cells: Cell[] = [
    {
      label: "Score",
      value: score != null ? String(Math.round(score)) : DASH,
      valueClass: TIER_INK[scoreTier],
      sub: score != null ? TIER_WORD[scoreTier] : null,
    },
    {
      label: "Tide",
      value:
        rn?.tideM != null
          ? `${formatHeight(convertHeight(rn.tideM, "m", tideUnit), tideUnit)} ${tideArrow}`.trim()
          : DASH,
      sub: accel,
    },
    {
      label: "Current",
      value:
        curSpeed != null
          ? formatWind(convertWind(curSpeed, "knots", currentUnit), currentUnit, 1)
          : DASH,
      sub:
        curSet == null
          ? null
          : slackAt != null && curSet !== "Slack"
            ? `${curSet} · slack ~${hh(slackAt)}`
            : curSet,
    },
    {
      label: "Wind",
      value:
        rn?.windKt != null
          ? formatWind(convertWind(rn.windKt, "knots", windUnit), windUnit)
          : DASH,
      sub: rn?.windDir ? `${rn.windDir} · ${gusty ? "gusty" : "steady"}` : null,
    },
    {
      label: "Sea state",
      value: seaState(rn?.waveM ?? null) ?? DASH,
      sub:
        rn?.waveM != null
          ? formatHeight(convertHeight(rn.waveM, "m", waveUnit), waveUnit)
          : null,
    },
    {
      label: "Air temp",
      value: airC != null ? `${convertTemp(airC, "C", tempUnit).toFixed(0)}°` : DASH,
      sub: airWord(airC),
    },
    {
      label: "Weather",
      value: wx ? WEATHER_WORD[wx] : DASH,
      sub: "24-hour graph ↓",
      href: CONDITIONS_ANCHOR,
      glyph: wx ? (
        <span className="text-rc-ink-soft shrink-0">
          <WeatherIcon condition={wx} size={18} />
        </span>
      ) : null,
    },
  ];

  return (
    <div>
      <div className="rc-label text-[9px] mb-2">Conditions · now</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-y border-rc-rule divide-x divide-rc-rule">
        {cells.map((c) => {
          const inner = (
            <>
              <div className="rc-label text-[10px]">{c.label}</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  className={`font-bold leading-none truncate ${c.valueClass ?? "text-rc-ink"} text-base`}
                >
                  {c.value}
                </span>
                {c.glyph}
              </div>
              {c.sub && (
                <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5 truncate">
                  {c.sub}
                </div>
              )}
            </>
          );
          return c.href ? (
            <a
              key={c.label}
              href={c.href}
              className="px-3 py-2.5 min-w-0 block group hover:bg-rc-brand-soft/40 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rc-brand"
            >
              {inner}
            </a>
          ) : (
            <div key={c.label} className="px-3 py-2.5 min-w-0">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
