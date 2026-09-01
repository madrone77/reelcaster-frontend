"use client";

import type {
  RightNowSnapshot,
  PointConditions,
} from "@/lib/bluecaster/live-spot-types";
import type { CurrentSample } from "@/lib/bluecaster-client";
import { niceCurrentScale, nextSlackHour } from "../../lib/current-series";
import { windCardinal } from "../../lib/wind-rose";
import { tierFor, type Tier } from "../../lib/explore-data";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertHeight,
  convertTemp,
  convertWind,
  formatHeight,
  formatWind,
} from "@/app/utils/unit-conversions";
import { formatFractionalHour12 } from "@/lib/time-format";
import { resolveSea, SEA_ESTIMATE_NOTE } from "../../lib/sea-state";
import WeatherIcon, {
  weatherFromHour,
  type WeatherCondition,
} from "./weather-icon";

const DASH = "—";

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

const hh = (t: number) => formatFractionalHour12(t);

/**
 * Tidal acceleration term from the signed current series: Turning (slack),
 * Building (magnitude rising), Peak Flood / Peak Ebb (at a local max), or
 * Easing (magnitude falling). Falls back to the coarse tide trend when the
 * predicted current series hasn't loaded.
 */
function tideAccel(
  signed: (number | null)[] | null,
  hour: number,
  slackThr: number,
  tideTrend: "rising" | "falling" | null,
): string | null {
  const v = signed?.[hour];
  if (v == null) {
    // No current series yet — name the direction from the tide trend.
    return tideTrend === "rising" ? "Flooding" : tideTrend === "falling" ? "Ebbing" : null;
  }
  const mag = Math.abs(v);
  if (mag < slackThr) return "Turning";
  const prev = signed?.[hour - 1];
  const next = signed?.[hour + 1];
  const magPrev = prev != null ? Math.abs(prev) : mag;
  const magNext = next != null ? Math.abs(next) : mag;
  if (mag >= magPrev && mag >= magNext) return v > 0 ? "Peak flood" : "Peak ebb";
  if (magNext > mag) return "Building";
  return "Easing";
}

type Cell = {
  label: string;
  value: string;
  /** ReactNode, not string — a couple of subs carry a shorter mobile variant. */
  sub?: React.ReactNode;
  /** Trailing glyph (trend arrow / weather icon). */
  glyph?: React.ReactNode;
  /** Tier ink override for the value (score cell). */
  valueClass?: string;
  /**
   * Hidden from the desktop row. `display:none` drops the cell out of grid flow
   * entirely, so the lg layout stays a clean 7-across without a spare column.
   */
  mobileOnly?: boolean;
};

/**
 * The spot's data strip — a single row of the numbers that drive the read:
 * score, then the conditions in the same order the 24h graph stacks them
 * (tide · current · wind · sea state · air temp), capped with a weather cell.
 * This is the ONE place these values live; the 24h graph no longer repeats them
 * as right-gutter readouts.
 *
 * It sits directly above the graph's score strip and READS THE SCRUBBED HOUR —
 * every cell is the hour under the cursor, so dragging the chart drives the
 * numbers. `hour` indexes the same per-day series the chart is drawing, so the
 * two can't disagree. When the cursor is parked on the live hour of today,
 * `isNow` is set and the heading says "now" rather than a clock time.
 */
export default function CurrentConditionsStrip({
  rightNow,
  score = null,
  currentSigned = null,
  currentSample = null,
  point = null,
  hour = 0,
  isNow = true,
  phone = false,
}: {
  rightNow: RightNowSnapshot | null;
  /** Score at `hour` for the selected species (0–100). */
  score?: number | null;
  currentSigned?: (number | null)[] | null;
  currentSample?: CurrentSample | null;
  point?: PointConditions | null;
  /** The hour being read — the chart's scrubbed hour, not the wall clock. */
  hour?: number;
  /** True when `hour` is the live hour of today, so the heading reads "now". */
  isNow?: boolean;
  /**
   * Stay narrow whatever the window is doing.
   *
   * Every `lg:` below asks how wide the WINDOW is, which is the right question
   * on a page whose strip is as wide as the page and the wrong one inside a
   * phone frame on a landing page: the cells are 375px wide and the window is
   * a laptop, so the box laid itself out 7 across in a 375px phone. Same fix,
   * same reason, as SpotTerminal's `phone`.
   */
  phone?: boolean;
}) {
  /** A `lg:` class, dropped when the container is a phone. */
  const wide = (cls: string) => (phone ? "" : cls);
  const { windUnit, currentUnit, tempUnit, tideUnit, waveUnit } = useUnitPreferences();
  const rn = rightNow;

  // ── current (signed series first, point sample fallback) ──────────────
  const signedNow = currentSigned?.[hour] ?? null;
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
  const slackAt = currentSigned ? nextSlackHour(currentSigned, hour) : null;

  // ── tide ──────────────────────────────────────────────────────────────
  const tideArrow =
    rn?.tideTrend === "rising" ? "▲" : rn?.tideTrend === "falling" ? "▼" : "";
  const accel = tideAccel(currentSigned, hour, slackThr, rn?.tideTrend ?? null);

  // ── air temp + weather ─────────────────────────────────────────────────
  const airC = rn?.airTempC ?? null;
  const wx: WeatherCondition | null =
    rn ? weatherFromHour(rn.cloudPct, rn.precipMm) : null;

  const gusty =
    rn?.windKt != null && rn?.windGustKt != null && rn.windGustKt - rn.windKt > 8;
  const windName = windCardinal(rn?.windDirDeg) ?? rn?.windDir ?? null;

  // Falls back to a wind-derived sea at spots the wave grid calls dry land, where
  // `waveM` is null for every hour of every day. See lib/sea-state.ts.
  const sea = resolveSea(rn?.waveM, rn?.windKt, rn?.windGustKt);

  const scoreTier = tierFor(score);

  const cells: Cell[] = [
    // Mobile packs 8 cells into 4×2. There are only 7 readings, so the hour
    // being read takes the eighth slot — which is the one thing a scrubbable
    // strip actually needs and the heading alone was carrying. On desktop the
    // row is 7-across with no spare slot, so this drops out and the heading
    // keeps the hour instead.
    {
      label: "Time",
      value: hh(hour),
      sub: isNow ? "Now" : null,
      mobileOnly: true,
    },
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
      // "Flood · slack ~15:36" overruns a quarter-width mobile cell by 42px.
      // The slack time is worth keeping there — on a narrow phone the chart's
      // own SLACK annotations are suppressed, so this is the only place it
      // shows — so mobile drops the connecting words, not the time.
      sub:
        curSet == null ? null : slackAt != null && curSet !== "Slack" ? (
          <>
            <span className={wide("lg:hidden")}>{`${curSet} ~${hh(slackAt)}`}</span>
            <span className={`hidden ${wide("lg:inline")}`}>{`${curSet} · slack ~${hh(slackAt)}`}</span>
          </>
        ) : (
          curSet
        ),
    },
    {
      label: "Wind",
      value:
        rn?.windKt != null
          ? formatWind(convertWind(rn.windKt, "knots", windUnit), windUnit)
          : DASH,
      // Named from DEGREES, not from the API's `windDir` string: that string is
      // rounded to an 8-point rose upstream, so the same hour read "W" here and
      // "WSW" under the chart's arrow a few pixels below. Falls back to the
      // string on the older payloads that carry no degrees.
      sub: windName
        ? `${windName} · ${gusty ? "gusty" : "steady"}`
        : null,
    },
    {
      label: "Sea state",
      value: seaState(sea?.m ?? null) ?? DASH,
      // An estimate wears the word but never a height. A wind-derived number
      // is not a wave measurement and should not read like one.
      sub: sea
        ? sea.estimated
          ? SEA_ESTIMATE_NOTE
          : formatHeight(convertHeight(sea.m, "m", waveUnit), waveUnit)
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
      // Was "24-hour graph ↓" linking to #conditions-24h. The strip now lives
      // INSIDE that section, so the link pointed at its own container. Carries
      // the reading behind the icon instead: rain when there is any, else cloud.
      sub:
        rn?.precipMm != null && rn.precipMm >= 0.2
          ? `${rn.precipMm.toFixed(1)} mm/h`
          : rn?.cloudPct != null
            ? `${Math.round(rn.cloudPct)}% cloud`
            : null,
      // Hidden on mobile: the icon plus its gap costs 22px of a 67px cell, and
      // "Overcast" needs all of it. The word already names the condition, and
      // the graph's weather band sits a few pixels below with the icons in it.
      glyph: wx ? (
        <span className={`hidden ${wide("lg:block")} text-rc-ink-soft shrink-0`}>
          <WeatherIcon condition={wx} size={18} />
        </span>
      ) : null,
    },
  ];

  return (
    <div>
      {/* The Time cell carries the hour on mobile, so the heading only repeats
          it where that cell is hidden. */}
      <div className="rc-label text-[9px] mb-1.5">
        Conditions
        <span className={`hidden ${wide("lg:inline")}`}> · {isNow ? "now" : hh(hour)}</span>
      </div>
      {/* Bordered box, not the old border-y band: this sits directly on top of
          the graph's score strip, and the chart draws every one of its rows as
          a bordered box. Same shape = reads as the top row of one instrument.
          4 across on mobile — 8 cells, 2 clean rows — then 7 across on desktop
          once the Time cell drops out.

          The internal rules are a 1px grid gap over a rule-coloured parent,
          NOT divide-x / divide-y. Tailwind's divide utilities key off
          :not(:last-child), which knows nothing about where a row wraps: on
          the 4-across mobile layout every cell but the eighth drew a right AND
          a bottom border, so Current's right border landed on the box's right
          edge and Wind / Sea state / Air temp's bottom borders landed on its
          bottom edge, 2px there against 1px everywhere else. A gap is
          column-count agnostic, and a `lg:hidden` cell leaves grid flow
          entirely, so it can't strand a rule behind it either. */}
      <div className={`grid grid-cols-4 ${wide("lg:grid-cols-7")} gap-px rounded border border-rc-rule bg-rc-rule overflow-hidden`}>
        {cells.map((c) => (
          // Quarter-width cells are tight at 375px, so the type and padding
          // step down below lg and every line truncates rather than wraps —
          // a wrapped value would push its row taller than its neighbours.
          // bg-rc-panel is what makes the gap read as a rule: the cells cover
          // the grid's rule-coloured background except in the 1px gutters, so
          // the cell fill has to stay opaque and match the page.
          <div
            key={c.label}
            className={`bg-rc-panel px-1.5 py-2 ${wide("lg:px-3 lg:py-2.5")} min-w-0 ${c.mobileOnly ? wide("lg:hidden") : ""}`}
          >
            {/* No font-size utility here: .rc-label sets `font:` shorthand,
                which resets size and wins, so a text-[9px] would be a no-op
                that only looked like it did something. The labels stay 10px and
                the cell padding is what buys "SEA STATE" its room — at px-2 its
                uppercase tracking put it 1px over and it ellipsised. */}
            <div className="rc-label truncate">{c.label}</div>
            <div className={`flex items-baseline gap-1 ${wide("lg:gap-1.5")} mt-1`}>
              <span
                className={`font-bold leading-none truncate ${c.valueClass ?? "text-rc-ink"} text-sm ${wide("lg:text-base")}`}
              >
                {c.value}
              </span>
              {c.glyph}
            </div>
            {c.sub && (
              <div className={`font-rc-mono text-[9px] ${wide("lg:text-[10px]")} text-rc-ink-mute mt-0.5 truncate`}>
                {c.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
