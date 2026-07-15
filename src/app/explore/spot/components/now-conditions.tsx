"use client";

import type { RightNowSnapshot } from "@/lib/bluecaster/live-spot-types";

// ── mini visualizations ─────────────────────────────────────────────────

// One shared accent (brand blue, on a light-blue fill) across every RIGHT NOW
// viz — the compass needle, the tide/pressure curves, the sea bars, and the
// temp-gauge knob — so the row reads as one system instead of six one-offs.

/** Compass dial with cardinal ticks and a needle pointing in the wind-from bearing. */
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

/** Compact tide curve over the day — filled area, peak marker, mean reference line. */
function TideSpark({ series }: { series: (number | null)[] }) {
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
  let peakIdx = 0;
  series.forEach((v, i) => {
    if (v != null && (series[peakIdx] == null || v > (series[peakIdx] as number))) peakIdx = i;
  });
  const peak = pts[peakIdx];
  const meanY = yFor(mean);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-14 h-7 shrink-0" aria-hidden>
      <line x1="0" y1={meanY} x2="100" y2={meanY} stroke="var(--rc-rule)" strokeWidth={1} strokeDasharray="3 3" />
      <path d={`${line} L100,100 L0,100 Z`} fill="var(--rc-brand-soft)" stroke="none" />
      <path d={line} fill="none" stroke="var(--rc-brand)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {peak.y != null && <circle cx={peak.x} cy={peak.y} r={3.2} fill="var(--rc-brand)" />}
    </svg>
  );
}

/** Compact wave-height bars over the day — real hourly data, not decoration. */
function SeaSpark({ series }: { series: (number | null)[] }) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
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
        const rel = (v - min) / span;
        const h = Math.max(8, rel * 100);
        return (
          <rect
            key={i}
            x={(i * bw + bw * 0.2).toFixed(1)}
            y={(100 - h).toFixed(1)}
            width={(bw * 0.6).toFixed(1)}
            height={h.toFixed(1)}
            rx={1.5}
            fill="var(--rc-brand)"
            opacity={(0.35 + 0.65 * rel).toFixed(2)}
          />
        );
      })}
    </svg>
  );
}

/** Pressure trend as a smooth curve between the two known readings (now, and
 * 3h ago derived from the trend) — same fill/stroke language as tide, without
 * implying an hourly series we don't have. */
function PressureSpark({ trend }: { trend: number | null }) {
  if (trend == null) return null;
  const y1 = trend > 0.2 ? 78 : trend < -0.2 ? 22 : 50;
  const y2 = trend > 0.2 ? 22 : trend < -0.2 ? 78 : 50;
  const path = `M2,${y1} Q50,${(y1 + y2) / 2} 98,${y2}`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-14 h-7 shrink-0" aria-hidden>
      <path d={`${path} L98,100 L2,100 Z`} fill="var(--rc-brand-soft)" stroke="none" />
      <path d={path} fill="none" stroke="var(--rc-brand)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx="98" cy={y2} r={3.2} fill="var(--rc-brand)" />
    </svg>
  );
}

/** Horizontal range gauge with a knob at the current temp — same blue accent
 * as the other RIGHT NOW visualizations. */
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
    <div className="mt-2.5 w-full">
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

function seaState(wav: number | null): string {
  if (wav == null) return "—";
  if (wav < 0.2) return "Calm";
  if (wav < 0.5) return "Light";
  if (wav < 1.0) return "Light Chop";
  if (wav < 2.0) return "Moderate";
  return "Rough";
}

function waterLabel(t: number | null): string | null {
  if (t == null) return null;
  if (t < 9) return "Cold";
  if (t <= 17) return "Optimal";
  return "Warm";
}

function airLabel(t: number | null): string | null {
  if (t == null) return null;
  if (t < 7) return "Cold";
  if (t <= 20) return "Comfortable";
  return "Warm";
}

// ── metric cell ───────────────────────────────────────────────────────────

type Metric = {
  label: string;
  value: string;
  sub?: string | null;
  /** Right-aligned glyph (compass, spark). */
  viz?: React.ReactNode;
  /** Full-width element rendered below the value (temp gauge). */
  gauge?: React.ReactNode;
};

/**
 * RIGHT NOW conditions panel. Wind / sea / water / air come from the spot-page
 * `rightNow` snapshot; pressure (+3h trend) comes from point-conditions, which
 * the spot-page payload omits. Tide curve is drawn from the day's tide series.
 * Rendered flush (no card) as a 2 col × 3 row divided grid per the mockup —
 * labels IBM Plex Mono uppercase, values Inter, hairline dividers.
 */
export default function NowConditions({
  rightNow,
  pressureMb,
  pressureTrend,
  tideSeries,
  seaSeries,
  label = "RIGHT NOW",
}: {
  rightNow: RightNowSnapshot | null;
  pressureMb: number | null;
  pressureTrend: number | null;
  tideSeries: (number | null)[];
  seaSeries: (number | null)[];
  label?: string;
}) {
  const rn = rightNow;
  const gusty =
    rn?.windKt != null && rn?.windGustKt != null && rn.windGustKt - rn.windKt > 8;

  const tideArrow =
    rn?.tideTrend === "rising" ? "▲" : rn?.tideTrend === "falling" ? "▼" : "·";
  const pTrend =
    pressureTrend == null
      ? null
      : `${pressureTrend > 0.2 ? "▲" : pressureTrend < -0.2 ? "▼" : "·"} ${
          pressureTrend >= 0 ? "+" : ""
        }${pressureTrend.toFixed(1)} / 3hr`;

  const seaRange = (() => {
    const s = rn?.swellM;
    const w = rn?.waveM;
    if (s != null && w != null && Math.abs(s - w) > 0.05) {
      return `${Math.min(s, w).toFixed(1)} – ${Math.max(s, w).toFixed(1)} m`;
    }
    if (w != null) return `${w.toFixed(1)} m`;
    return null;
  })();

  const metrics: Metric[] = [
    {
      label: "WIND",
      value: rn?.windKt != null ? `${Math.round(rn.windKt)} kn` : "—",
      sub: rn?.windDir ? `${rn.windDir} · ${gusty ? "gusty" : "steady"}` : null,
      viz: rn?.windDirDeg != null ? <CompassArrow deg={rn.windDirDeg} /> : null,
    },
    {
      label: "TIDE",
      value:
        rn?.tideM != null
          ? `${rn.tideM >= 0 ? "+" : ""}${rn.tideM.toFixed(1)} m`
          : "—",
      sub: rn?.tideTrend ? `${rn.tideTrend} ${tideArrow}` : null,
      viz: <TideSpark series={tideSeries} />,
    },
    {
      label: "SEA",
      value: seaState(rn?.waveM ?? null),
      sub: seaRange,
      viz: <SeaSpark series={seaSeries} />,
    },
    {
      label: "PRESSURE",
      value: pressureMb != null ? `${Math.round(pressureMb)}` : "—",
      sub: pTrend ?? (pressureMb != null ? "mb" : null),
      viz: <PressureSpark trend={pressureTrend} />,
    },
    {
      label: "WATER",
      value: rn?.seaTempC != null ? `${rn.seaTempC.toFixed(1)}°` : "—",
      sub: waterLabel(rn?.seaTempC ?? null),
      gauge: <TempGauge value={rn?.seaTempC ?? null} min={5} max={20} />,
    },
    {
      label: "AIR",
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
