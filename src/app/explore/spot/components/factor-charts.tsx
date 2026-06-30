"use client";

import { useMemo } from "react";
import type {
  FactorContributions,
  ScoreSpeciesEntry,
} from "@/lib/bluecaster/live-spot-types";

// Human labels for the engine's factor keys (mirrors bluecaster/lib/factor-format).
const FACTOR_LABEL: Record<string, string> = {
  tide_phase: "Tide timing",
  tide_range_24h_m: "Tide swing",
  tidal_current_speed_kt: "Current",
  tidal_current_direction_deg: "Current direction",
  tidal_current_rate_of_change_kt_per_hr: "Current trend",
  minutes_to_next_slack: "Bite window",
  swell_height_m: "Swell",
  swell_period_s: "Swell period",
  wave_height_m: "Waves",
  sea_surface_temp_c: "Water temp",
  solar_elevation_deg: "Light",
  daylight_hours: "Daylight",
  barometric_pressure_hpa: "Pressure trend",
  pressure_trend_3h: "Pressure trend",
  moon_phase: "Moon",
  moon_illumination_pct: "Moon brightness",
  visibility_km: "Visibility",
  wind: "Wind",
  air_temp: "Air temp",
  precipitation: "Precip",
  visibility: "Visibility",
  season: "Season",
};

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const pad = (n: number): string => String(n).padStart(2, "0");

// ── value sub-line formatting ─────────────────────────────────────────────

const VALUE_UNIT: Record<string, (v: number) => string> = {
  barometric_pressure_hpa: (v) => `${Math.round(v)} mb`,
  minutes_to_next_slack: (v) => `${Math.round(v)} min to slack`,
  sea_surface_temp_c: (v) => `${v.toFixed(1)}° water`,
  air_temp: (v) => `${v.toFixed(1)}° air`,
  wind: (v) => `${Math.round(v)} kn wind`,
  tidal_current_speed_kt: (v) => `${v.toFixed(1)} kn current`,
  tidal_current_rate_of_change_kt_per_hr: (v) => `${v.toFixed(1)} kn/hr`,
  swell_height_m: (v) => `${v.toFixed(1)} m swell`,
  swell_period_s: (v) => `${Math.round(v)} s period`,
  wave_height_m: (v) => `${v.toFixed(1)} m`,
  tide_range_24h_m: (v) => `${v.toFixed(1)} m swing`,
  solar_elevation_deg: (v) => `${Math.round(v)}° sun`,
  daylight_hours: (v) => `${v.toFixed(1)} h light`,
  moon_illumination_pct: (v) => `${Math.round(v)}% moon`,
  visibility: (v) => `${Math.round(v)} km vis`,
  visibility_km: (v) => `${Math.round(v)} km vis`,
  precipitation: (v) => (v > 0 ? `${v.toFixed(1)} mm rain` : "Dry"),
};

function titleCase(v: string): string {
  return v
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Best-effort human value for a factor at the selected hour. */
function formatFactorValue(
  key: string,
  raw: number | string | null,
  fit: number | null,
): string {
  if (key === "pressure_trend_3h" && typeof raw === "number") {
    const word = raw > 0.2 ? "Rising" : raw < -0.2 ? "Falling" : "Steady";
    return `${word} · ${raw >= 0 ? "+" : ""}${raw.toFixed(1)}/3hr`;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const fmt = VALUE_UNIT[key];
    return fmt ? fmt(raw) : `${Math.round(raw * 10) / 10}`;
  }
  if (typeof raw === "string" && raw.trim()) return titleCase(raw);
  const f = fit ?? 0;
  return f >= 0.66 ? "Strong fit" : f >= 0.33 ? "Fair fit" : "Weak fit";
}

// ── series extraction ─────────────────────────────────────────────────────

type FactorKind = "curve" | "bars";
type FactorPoint = {
  fit: number;
  weight: number;
  contribution: number;
  raw: number | string | null;
  kind: FactorKind;
};

const rawOf = (v: unknown): number | string | null =>
  typeof v === "number" || typeof v === "string" ? v : null;

/** Flatten a factor_contributions object into {key → point}. Engine factors
 *  (`factors`) are curve-type; comfort factors (`comfort.factors`) are bars. */
function extractFactors(fc: FactorContributions | null): Record<string, FactorPoint> {
  const out: Record<string, FactorPoint> = {};
  for (const [k, v] of Object.entries(fc?.factors ?? {})) {
    out[k] = {
      fit: num(v.normalized_contribution),
      weight: num(v.weight),
      contribution: num(v.weighted_contribution),
      raw: rawOf(v.raw_value),
      kind: "curve",
    };
  }
  for (const [k, v] of Object.entries(fc?.comfort?.factors ?? {})) {
    const fit = num(v.fit);
    const weight = num(v.weight);
    out[k] = {
      fit,
      weight,
      contribution: fit * weight,
      raw: rawOf(v.raw),
      kind: "bars",
    };
  }
  return out;
}

interface FactorSeries {
  key: string;
  label: string;
  weight: number; // 0–100
  kind: FactorKind;
  fits: (number | null)[]; // 24 slots, 0–1
  contribs: (number | null)[]; // 24 slots, weighted contribution 0–1
  raws: (number | string | null)[]; // 24 slots, raw factor value
}

function localHour(iso: string, tz: string): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        hour12: false,
      }).format(new Date(iso)),
    ) % 24
  );
}

function buildSeries(
  entry: ScoreSpeciesEntry | undefined,
  tz: string,
): FactorSeries[] {
  if (!entry?.hours?.length) return [];

  const fitsByKey = new Map<string, (number | null)[]>();
  const contribsByKey = new Map<string, (number | null)[]>();
  const rawsByKey = new Map<string, (number | string | null)[]>();
  const weightByKey = new Map<string, number>();
  const kindByKey = new Map<string, FactorKind>();

  for (const hour of entry.hours) {
    const h = localHour(hour.hour_utc, tz);
    const fc = hour.stocks?.[0]?.factor_contributions ?? null;
    const factors = extractFactors(fc);
    for (const [k, p] of Object.entries(factors)) {
      if (!fitsByKey.has(k)) {
        fitsByKey.set(k, new Array(24).fill(null));
        contribsByKey.set(k, new Array(24).fill(null));
        rawsByKey.set(k, new Array(24).fill(null));
      }
      fitsByKey.get(k)![h] = p.fit;
      contribsByKey.get(k)![h] = p.contribution;
      rawsByKey.get(k)![h] = p.raw;
      weightByKey.set(k, Math.max(weightByKey.get(k) ?? 0, p.weight));
      kindByKey.set(k, p.kind);
    }
  }

  return [...fitsByKey.keys()]
    .map((key) => ({
      key,
      label: FACTOR_LABEL[key] ?? key.replace(/_/g, " "),
      weight: Math.round((weightByKey.get(key) ?? 0) * 100),
      kind: kindByKey.get(key) ?? "curve",
      fits: fitsByKey.get(key)!,
      contribs: contribsByKey.get(key)!,
      raws: rawsByKey.get(key)!,
    }))
    .filter((f) => f.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
}

// ── chart geometry ─────────────────────────────────────────────────────────

const CHART_H = 40; // viewBox units
const TOP = 5;
const BOT = 36;
const curveX = (i: number): number => (i / 23) * 100;
const curveY = (fit: number | null): number =>
  BOT - Math.max(0, Math.min(1, fit ?? 0)) * (BOT - TOP);

type Range = [number, number] | null;

/** Filled area + line with a dotted marker; the dot is an HTML span so it stays
 *  circular under preserveAspectRatio="none". */
function CurveChart({
  fits,
  marker,
  windowRange,
}: {
  fits: (number | null)[];
  marker: number;
  windowRange: Range;
}) {
  const linePts = fits.map((f, i) => `${curveX(i).toFixed(2)},${curveY(f).toFixed(2)}`);
  const areaPath = `M ${curveX(0).toFixed(2)},${BOT} L ${linePts.join(" L ")} L ${curveX(
    23,
  ).toFixed(2)},${BOT} Z`;
  const mx = curveX(marker);
  const my = curveY(fits[marker]);
  return (
    <>
      <svg
        viewBox={`0 0 100 ${CHART_H}`}
        preserveAspectRatio="none"
        className="w-full h-14 block"
        aria-hidden
      >
        {windowRange && (
          <rect
            x={curveX(windowRange[0])}
            y={0}
            width={Math.max(0, curveX(windowRange[1]) - curveX(windowRange[0]))}
            height={CHART_H}
            fill="var(--rc-brand)"
            opacity="0.07"
          />
        )}
        <path d={areaPath} fill="var(--rc-brand)" opacity="0.1" />
        <polyline
          points={linePts.join(" ")}
          fill="none"
          stroke="var(--rc-brand)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={mx}
          y1={0}
          x2={mx}
          y2={CHART_H}
          stroke="var(--rc-ink-mute)"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute w-2 h-2 rounded-full bg-rc-ink ring-2 ring-rc-panel pointer-events-none"
        style={{
          left: `${mx}%`,
          top: `${(my / CHART_H) * 100}%`,
          transform: "translate(-50%,-50%)",
        }}
      />
    </>
  );
}

/** Histogram of the factor's fit over the day (comfort factors). */
function BarChart({
  fits,
  marker,
  windowRange,
}: {
  fits: (number | null)[];
  marker: number;
  windowRange: Range;
}) {
  return (
    <div className="relative flex items-end gap-[2px] h-14">
      {fits.map((fit, i) => {
        const inWin =
          windowRange != null && i >= windowRange[0] && i <= windowRange[1];
        return (
          <div key={i} className="flex-1 h-full flex items-end">
            <span
              className={`w-full rounded-sm bg-rc-brand ${
                i === marker ? "ring-1 ring-rc-ink" : ""
              }`}
              style={{
                height: `${fit == null ? 4 : Math.max(4, fit * 100)}%`,
                opacity: fit == null ? 0.12 : inWin ? 0.95 : 0.3 + 0.6 * fit,
              }}
            />
          </div>
        );
      })}
      <div
        className="absolute top-0 bottom-0 w-px bg-rc-ink-mute pointer-events-none"
        style={{ left: `${((marker + 0.5) / 24) * 100}%` }}
      />
    </div>
  );
}

function FactorRow({
  f,
  marker,
  onSelectHour,
  windowRange,
  showNow,
}: {
  f: FactorSeries;
  marker: number;
  onSelectHour?: (hour: number) => void;
  windowRange: Range;
  showNow: boolean;
}) {
  // Contribution shown for the selected hour; fall back to the day's peak.
  const atMarker = f.contribs[marker];
  const peak = f.contribs.reduce<number>((m, v) => (v != null && v > m ? v : m), 0);
  const contribution = Math.round((atMarker ?? peak) * 100);
  const valueLine = formatFactorValue(f.key, f.raws[marker], f.fits[marker]);
  const markerPct =
    f.kind === "bars" ? ((marker + 0.5) / 24) * 100 : curveX(marker);

  return (
    <div className="py-3 border-b border-rc-rule-soft last:border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-rc-ink leading-tight">
            {f.label}
          </div>
          <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5 truncate">
            {valueLine}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-rc-good leading-none">
            +{contribution}
          </div>
          <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-1">
            weight {f.weight}
          </div>
        </div>
      </div>

      <div className="relative">
        {showNow && (
          <span
            className="absolute z-10 -translate-x-1/2 -translate-y-full bg-rc-ink text-white font-rc-mono text-[8px] font-bold px-1 py-0.5 rounded pointer-events-none"
            style={{ left: `${markerPct}%` }}
          >
            NOW
          </span>
        )}

        {f.kind === "bars" ? (
          <BarChart fits={f.fits} marker={marker} windowRange={windowRange} />
        ) : (
          <CurveChart fits={f.fits} marker={marker} windowRange={windowRange} />
        )}

        {onSelectHour && (
          <div className="absolute inset-0 flex">
            {Array.from({ length: 24 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectHour(i)}
                title={`${pad(i)}:00`}
                aria-label={`${pad(i)}:00`}
                aria-pressed={i === marker}
                className="group relative flex-1 h-full cursor-pointer"
              >
                <span className="absolute inset-0 bg-rc-brand/[0.06] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Score explained" — per-factor 24h charts for the selected species, sourced
 * entirely from the existing /score?days=1 breakdown. Engine factors render as
 * ideal-response area curves with a dot at the selected hour; comfort factors
 * render as bars. Clicking any chart scrubs `selectedHour`, moving every marker
 * and updating each contribution.
 */
export default function FactorCharts({
  entry,
  tz,
  selectedHour,
  onSelectHour,
  speciesName,
  tzAbbrev,
  nowHour,
  windowRange = null,
}: {
  entry: ScoreSpeciesEntry | undefined;
  tz: string;
  selectedHour: number;
  onSelectHour?: (hour: number) => void;
  speciesName: string | null;
  tzAbbrev?: string;
  nowHour?: number;
  windowRange?: Range;
}) {
  const series = useMemo(() => buildSeries(entry, tz), [entry, tz]);

  if (series.length === 0) return null;

  const timeLabel = `${pad(selectedHour)}:00${tzAbbrev ? ` ${tzAbbrev}` : ""}`;

  return (
    <div>
      <div className="rc-label text-[9px] mb-1">
        SCORE EXPLAINED{speciesName ? ` · ${speciesName}` : ""} · {timeLabel}
      </div>
      <div className="font-rc-mono text-[10px] text-rc-ink-mute italic mb-2">
        dot = current value on ideal-response curve · tap to scrub
      </div>

      <div>
        {series.map((f, i) => (
          <FactorRow
            key={f.key}
            f={f}
            marker={selectedHour}
            onSelectHour={onSelectHour}
            windowRange={windowRange}
            showNow={i === 0 && selectedHour === nowHour}
          />
        ))}
      </div>

      <div className="flex justify-between font-rc-mono text-[9px] text-rc-ink-mute mt-1.5">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
