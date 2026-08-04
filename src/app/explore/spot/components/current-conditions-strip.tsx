"use client";

import type {
  RightNowSnapshot,
  PointConditions,
} from "@/lib/bluecaster/live-spot-types";
import type { CurrentSample } from "@/lib/bluecaster-client";
import { niceCurrentScale, nextSlackHour } from "../../lib/current-series";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertHeight,
  convertTemp,
  convertWind,
  formatHeight,
  formatWind,
} from "@/app/utils/unit-conversions";

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

// Optimal water-temp band (°C). Coarse, species-agnostic heuristic — see
// PHASE-TWO.md for a species-aware model.
const WATER_OPTIMAL_MIN = 8;
const WATER_OPTIMAL_MAX = 14;

type Cell = {
  label: string;
  value: string;
  sub?: string | null;
  /** Trailing glyph (trend arrow / optimal dot) — one max. */
  glyph?: React.ReactNode;
};

/**
 * Condensed "now" conditions — the data that used to live in the standalone
 * RIGHT NOW panel, collapsed into a single header band: two groups of three,
 * water (primary) then air & surface (secondary), split by a hairline. Water
 * leads because tide and current drive the score more than wind does. Group A's
 * value type is fractionally larger — no colour is used to rank the groups.
 */
export default function CurrentConditionsStrip({
  rightNow,
  currentSigned = null,
  currentSample = null,
  point = null,
  nowHour = 0,
}: {
  rightNow: RightNowSnapshot | null;
  currentSigned?: (number | null)[] | null;
  currentSample?: CurrentSample | null;
  point?: PointConditions | null;
  nowHour?: number;
}) {
  const { windUnit, tempUnit, heightUnit } = useUnitPreferences();
  const rn = rightNow;
  const cond = point?.conditions ?? null;

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

  // ── pressure ────────────────────────────────────────────────────────────
  const pressure = cond?.barometric_pressure_hpa ?? null;
  const pTrend = cond?.pressure_trend_3h ?? null;
  const pArrow = pTrend == null ? "" : pTrend > 0.5 ? "↑" : pTrend < -0.5 ? "↓" : "→";
  const pWord = pTrend == null ? null : pTrend > 0.5 ? "rising" : pTrend < -0.5 ? "falling" : "steady";

  // ── water temp ───────────────────────────────────────────────────────
  const waterC = rn?.seaTempC ?? cond?.sea_surface_temp_c ?? null;
  const waterOptimal =
    waterC == null ? null : waterC >= WATER_OPTIMAL_MIN && waterC <= WATER_OPTIMAL_MAX;

  const gusty =
    rn?.windKt != null && rn?.windGustKt != null && rn.windGustKt - rn.windKt > 8;

  const groupA: Cell[] = [
    {
      label: "Tide",
      value:
        rn?.tideM != null
          ? `${formatHeight(convertHeight(rn.tideM, "m", heightUnit), heightUnit)} ${tideArrow}`.trim()
          : DASH,
      sub: accel,
    },
    {
      label: "Current",
      value:
        curSpeed != null
          ? formatWind(convertWind(curSpeed, "knots", windUnit), windUnit, 1)
          : DASH,
      sub:
        curSet == null
          ? null
          : slackAt != null && curSet !== "Slack"
            ? `${curSet} · slack ~${hh(slackAt)}`
            : curSet,
    },
    {
      label: "Pressure",
      value: pressure != null ? `${Math.round(pressure)} hPa` : DASH,
      sub: pWord,
      glyph: pArrow ? (
        <span className="font-rc-mono text-sm text-rc-ink-mute leading-none">{pArrow}</span>
      ) : null,
    },
  ];

  const groupB: Cell[] = [
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
          ? formatHeight(convertHeight(rn.waveM, "m", heightUnit), heightUnit)
          : null,
    },
    {
      label: "Water temp",
      value: waterC != null ? `${convertTemp(waterC, "C", tempUnit).toFixed(1)}°` : DASH,
      sub: waterOptimal == null ? null : waterOptimal ? "optimal" : "suboptimal",
      glyph:
        waterOptimal == null ? null : (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${waterOptimal ? "bg-rc-good" : "bg-rc-ink-mute"}`}
            aria-hidden
          />
        ),
    },
  ];

  return (
    <div>
      <div className="rc-label text-[9px] mb-2">Conditions · now</div>
      <div className="flex flex-col sm:flex-row border-y border-rc-rule">
        <Group cells={groupA} primary />
        <div className="border-t sm:border-t-0 sm:border-l border-rc-rule" aria-hidden />
        <Group cells={groupB} />
      </div>
    </div>
  );
}

function Group({ cells, primary = false }: { cells: Cell[]; primary?: boolean }) {
  return (
    <div className="grid grid-cols-3 flex-1">
      {cells.map((c) => (
        <div key={c.label} className="px-3 py-2.5 min-w-0">
          <div className="rc-label text-[10px]">{c.label}</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className={`font-bold text-rc-ink leading-none truncate ${
                primary ? "text-base" : "text-sm"
              }`}
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
        </div>
      ))}
    </div>
  );
}
