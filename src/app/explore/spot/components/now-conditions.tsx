"use client";

import type { RightNowSnapshot } from "@/lib/bluecaster/live-spot-types";
import type { CurrentSample } from "@/lib/bluecaster-client";
import { nextSlackHour, niceCurrentScale } from "../../lib/current-series";

// ── mini visualizations ─────────────────────────────────────────────────

// One shared accent (brand blue, on a light-blue fill) across every RIGHT NOW
// viz — the compass needles, the tide curve, the sea bars, the pressure chip,
// and the temp-gauge knobs — so the row reads as one system, not six one-offs.

/** Compass dial with cardinal ticks and a needle at the given bearing. */
function CompassArrow({ deg }: { deg: number }) {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--rc-rule)" strokeWidth="1.5" />
      {[0, 90, 180, 270].map((t) => (
        <line
          key={t}
          x1="16"
          y1="3"
          x2="16"
          y2="6"
          stroke="var(--rc-ink-mute)"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform={`rotate(${t} 16 16)`}
        />
      ))}
      <g transform={`rotate(${deg} 16 16)`}>
        <line x1="16" y1="16" x2="16" y2="6" stroke="var(--rc-brand)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="6" r="2.6" fill="var(--rc-brand)" />
      </g>
    </svg>
  );
}

/** Compact tide curve over today — filled area, mean line, dot at NOW. */
function TideSpark({
  series,
  nowHour,
}: {
  series: (number | null)[];
  nowHour: number;
}) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const yFor = (v: number) => 100 - ((v - min) / span) * 100;
  const pts = series.map((v, i) => ({
    x: (i / (series.length - 1)) * 100,
    y: v == null ? null : yFor(v),
  }));
  const line = pts
    .filter((p): p is { x: number; y: number } => p.y != null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  // The marker anchors the headline number to its place on the day's curve —
  // "you are here", not the day's high (the next H/L lives in the sub text).
  const nowPt = pts[Math.max(0, Math.min(series.length - 1, nowHour))];
  const meanY = yFor(mean);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-14 h-7 shrink-0" aria-hidden>
      <line x1="0" y1={meanY} x2="100" y2={meanY} stroke="var(--rc-rule)" strokeWidth={1} strokeDasharray="3 3" />
      <path d={`${line} L100,100 L0,100 Z`} fill="var(--rc-brand-soft)" stroke="none" />
      <path d={line} fill="none" stroke="var(--rc-brand)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {nowPt?.y != null && <circle cx={nowPt.x} cy={nowPt.y} r={3.2} fill="var(--rc-brand)" />}
    </svg>
  );
}

/** Compact wave-height bars over the day on an absolute 0–1 m scale (matching
 * the 24h chart's Sea State row) — a calm day now *looks* calm instead of
 * being stretched to fill the thumbnail. */
function SeaSpark({ series }: { series: (number | null)[] }) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const N = 8;
  const bars = Array.from({ length: N }, (_, i) => {
    const idx = Math.round((i / (N - 1)) * (series.length - 1));
    return series[idx];
  });
  const bw = 100 / N;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-14 h-7 shrink-0" aria-hidden>
      {bars.map((v, i) => {
        if (v == null) return null;
        const h = Math.max(6, Math.min(1, v) * 100);
        return (
          <rect
            key={i}
            x={(i * bw + bw * 0.2).toFixed(1)}
            y={(100 - h).toFixed(1)}
            width={(bw * 0.6).toFixed(1)}
            height={h.toFixed(1)}
            rx={1.5}
            fill="var(--rc-brand)"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

/** Cloud-cover strip over the day — darker = more cloud, same encoding as the
 * 24h chart's SKY row. */
function CloudStrip({ series }: { series: (number | null)[] }) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const N = 8;
  const cells = Array.from({ length: N }, (_, i) => {
    const idx = Math.round((i / (N - 1)) * (series.length - 1));
    return series[idx];
  });
  const bw = 100 / N;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-14 h-7 shrink-0" aria-hidden>
      {cells.map((v, i) =>
        v == null ? null : (
          <rect
            key={i}
            x={(i * bw + bw * 0.15).toFixed(1)}
            y="34"
            width={(bw * 0.7).toFixed(1)}
            height="32"
            rx={2}
            fill="var(--rc-ink-mute)"
            opacity={(0.12 + (v / 100) * 0.7).toFixed(2)}
          />
        ),
      )}
    </svg>
  );
}

/** Horizontal range gauge with a knob at the current temp. */
function TempGauge({
  value,
  min,
  max,
}: {
  value: number | null;
  min: number;
  max: number;
}) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="mt-1 w-full">
      <div className="relative h-1.5 rounded-full bg-rc-brand-soft">
        <span
          className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rc-brand shadow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-rc-mono text-[8px] text-rc-ink-mute mt-1">
        <span>{min}°</span>
        <span>{max}°</span>
      </div>
    </div>
  );
}

// Same thresholds as the 24h chart's sea-state words, so the page speaks one
// vocabulary for the same wave height.
function seaState(wav: number | null): string {
  if (wav == null) return "—";
  if (wav < 0.2) return "Calm";
  if (wav < 0.35) return "Rippled";
  if (wav < 0.65) return "Light chop";
  if (wav < 1.0) return "Choppy";
  return "Rough";
}

function skyWord(cloud: number | null): string | null {
  if (cloud == null) return null;
  if (cloud < 20) return "Clear";
  if (cloud < 50) return "Partly cloudy";
  if (cloud < 85) return "Mostly cloudy";
  return "Overcast";
}

function airLabel(t: number | null): string | null {
  if (t == null) return null;
  if (t < 7) return "Cold";
  if (t <= 20) return "Comfortable";
  return "Warm";
}

const hh = (t: number) => {
  let h = Math.floor(t);
  let m = Math.round((t - h) * 60);
  if (m === 60) { h++; m = 0; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Next tide extreme (H/L) after `fromHour`, from the day's hourly series. */
function nextTideEvent(
  series: (number | null)[],
  fromHour: number,
): { hour: number; v: number; hi: boolean } | null {
  for (let i = Math.max(1, Math.ceil(fromHour)); i < series.length - 1; i++) {
    const p = series[i - 1], c = series[i], n = series[i + 1];
    if (p == null || c == null || n == null) continue;
    if (c > p && c >= n) return { hour: i, v: c, hi: true };
    if (c < p && c <= n) return { hour: i, v: c, hi: false };
  }
  return null;
}

// ── metric cell ───────────────────────────────────────────────────────────

type Metric = {
  label: string;
  value: string;
  sub?: string | null;
  /** Right-aligned glyph (compass, spark, chip). */
  viz?: React.ReactNode;
  /** Full-width element rendered below the value (temp gauges). */
  gauge?: React.ReactNode;
};

/**
 * RIGHT NOW conditions panel. Wind / sea / sky / air come from the spot-page
 * `rightNow` snapshot; the current comes from the real predicted series (the
 * same data behind the 24h chart's CURRENT row), falling back to
 * point-conditions' single now-sample. Rendered flush as a 2 col × 3 row
 * divided grid, in the 24h chart's row order (tide → current → wind → sea →
 * sky → air) so the tiles read as the chart's "now" column.
 */
export default function NowConditions({
  rightNow,
  tideSeries,
  seaSeries,
  skySeries,
  currentSigned = null,
  currentSample = null,
  pointCurrent = null,
  nowHour = 0,
  label = "RIGHT NOW",
}: {
  rightNow: RightNowSnapshot | null;
  tideSeries: (number | null)[];
  seaSeries: (number | null)[];
  skySeries: (number | null)[];
  /** Signed hourly current for today (kn, +flood −ebb); null until loaded. */
  currentSigned?: (number | null)[] | null;
  /** Raw now-hour sample (for the flow bearing). */
  currentSample?: CurrentSample | null;
  /** point-conditions fallback when the series isn't available. */
  pointCurrent?: { speed_kn: number; dir_deg: number } | null;
  nowHour?: number;
  label?: string;
}) {
  const rn = rightNow;
  const gusty =
    rn?.windKt != null && rn?.windGustKt != null && rn.windGustKt - rn.windKt > 8;

  // ── current (real series first, single-sample fallback) ────────────────
  const signedNow = currentSigned?.[nowHour] ?? null;
  const slackThr = currentSigned
    ? Math.min(0.3, Math.max(0.1, 0.2 * niceCurrentScale(currentSigned)))
    : 0.3;
  const curSpeed =
    signedNow != null
      ? Math.abs(signedNow)
      : (currentSample?.speed_kn ?? pointCurrent?.speed_kn ?? null);
  const curPhase =
    signedNow != null
      ? Math.abs(signedNow) < slackThr
        ? "Slack"
        : signedNow > 0
          ? "Flood"
          : "Ebb"
      : // No signed series yet: name the phase from the tide trend (timing-true).
        rn?.tideTrend === "rising"
        ? "Flood"
        : rn?.tideTrend === "falling"
          ? "Ebb"
          : null;
  const slackAt = currentSigned ? nextSlackHour(currentSigned, nowHour) : null;
  const curSub =
    curPhase == null
      ? null
      : slackAt != null
        ? curPhase === "Slack"
          ? `Slack · turns ~${hh(slackAt)}`
          : `${curPhase} · slack ~${hh(slackAt)}`
        : curPhase;
  const curDir = currentSample?.dir_deg ?? pointCurrent?.dir_deg ?? null;

  // ── tide: trend now + the next event, so the number has a destination ──
  const tideEvt = nextTideEvent(tideSeries, nowHour);
  const tideArrow =
    rn?.tideTrend === "rising" ? "▲" : rn?.tideTrend === "falling" ? "▼" : "";
  const tideSub = tideEvt
    ? `${tideArrow} ${tideEvt.hi ? "high" : "low"} ${tideEvt.v.toFixed(1)} m · ${hh(tideEvt.hour)}`.trim()
    : rn?.tideTrend
      ? `${rn.tideTrend} ${tideArrow}`.trim()
      : null;

  // Same order as the 24h chart's rows, so this panel reads as its NOW column.
  const metrics: Metric[] = [
    {
      label: "TIDE",
      value: rn?.tideM != null ? `${rn.tideM.toFixed(1)} m` : "—",
      sub: tideSub,
      viz: <TideSpark series={tideSeries} nowHour={nowHour} />,
    },
    {
      label: "CURRENT",
      value: curSpeed != null ? `${curSpeed.toFixed(1)} kn` : "—",
      sub: curSub,
      viz: curDir != null ? <CompassArrow deg={curDir} /> : null,
    },
    {
      label: "WIND",
      value: rn?.windKt != null ? `${Math.round(rn.windKt)} kn` : "—",
      sub: rn?.windDir ? `${rn.windDir} · ${gusty ? "gusty" : "steady"}` : null,
      viz: rn?.windDirDeg != null ? <CompassArrow deg={rn.windDirDeg} /> : null,
    },
    {
      label: "SEA STATE",
      value: rn?.waveM != null ? `${rn.waveM.toFixed(1)} m` : "—",
      sub: [
        seaState(rn?.waveM ?? null),
        rn?.swellM != null ? `swell ${rn.swellM.toFixed(1)} m` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      viz: <SeaSpark series={seaSeries} />,
    },
    {
      label: "SKY",
      value: rn?.cloudPct != null ? `${Math.round(rn.cloudPct)}%` : "—",
      sub: [
        skyWord(rn?.cloudPct ?? null),
        rn?.precipMm != null
          ? rn.precipMm > 0
            ? `${rn.precipMm.toFixed(1)} mm/h`
            : "dry"
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      viz: <CloudStrip series={skySeries} />,
    },
    {
      label: "AIR TEMP",
      value: rn?.airTempC != null ? `${rn.airTempC.toFixed(1)}°` : "—",
      sub: airLabel(rn?.airTempC ?? null),
      gauge: <TempGauge value={rn?.airTempC ?? null} min={0} max={25} />,
    },
  ];

  return (
    <div>
      <div className="rc-label text-[9px] mb-1">{label}</div>
      <div className="grid grid-cols-2">
        {metrics.map((m, i) => {
          const isLeft = i % 2 === 0;
          const isLastRow = i >= metrics.length - 2;
          return (
            <div
              key={m.label}
              className={`py-3 ${
                isLeft ? "pr-4 border-r border-rc-rule-soft" : "pl-4"
              } ${isLastRow ? "" : "border-b border-rc-rule-soft"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="rc-label text-[9px]">{m.label}</div>
                  <div className="text-lg font-bold text-rc-ink leading-tight mt-1">
                    {m.value}
                  </div>
                  {m.sub && (
                    <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5">
                      {m.sub}
                    </div>
                  )}
                </div>
                {m.viz}
              </div>
              {m.gauge}
            </div>
          );
        })}
      </div>
    </div>
  );
}
