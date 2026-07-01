"use client";

import type { RightNowSnapshot } from "@/lib/bluecaster/live-spot-types";

// ── mini visualizations ─────────────────────────────────────────────────

/** Compass dial with a needle pointing in the wind-from bearing. */
function CompassArrow({ deg }: { deg: number }) {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0" aria-hidden>
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="var(--rc-rule)"
        strokeWidth="1.5"
      />
      <g transform={`rotate(${deg} 16 16)`}>
        <path d="M16 5 L20 18 L16 15 L12 18 Z" fill="var(--rc-brand)" />
      </g>
    </svg>
  );
}

/** Compact tide curve over the day. */
function TideSpark({ series }: { series: (number | null)[] }) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * 100;
    const y = v == null ? 50 : 100 - ((v - min) / span) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-14 h-6 shrink-0"
      aria-hidden
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--rc-brand)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Small vertical bar cluster for the SEA tile (decorative, scaled to sea state). */
function SeaBars({ level }: { level: number }) {
  const pattern = [0.45, 0.7, 0.55, 0.9, 0.65, 1];
  return (
    <div className="flex items-end gap-[2px] h-6 w-10 shrink-0" aria-hidden>
      {pattern.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px] bg-rc-brand"
          style={{
            height: `${Math.max(18, p * (0.4 + 0.6 * level) * 100)}%`,
            opacity: 0.45 + 0.5 * p,
          }}
        />
      ))}
    </div>
  );
}

/** Direction-only pressure trend line (no hourly series is available). */
function PressureSpark({ trend }: { trend: number | null }) {
  if (trend == null) return null;
  const y1 = trend > 0.2 ? 80 : trend < -0.2 ? 20 : 50;
  const y2 = trend > 0.2 ? 20 : trend < -0.2 ? 80 : 50;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-14 h-6 shrink-0"
      aria-hidden
    >
      <polyline
        points={`2,${y1} 98,${y2}`}
        fill="none"
        stroke="var(--rc-brand)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Horizontal gradient gauge (cool→warm) with a knob at the current temp. */
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
      <div
        className="relative h-1.5 rounded-full"
        style={{
          background: "linear-gradient(90deg, #3B82F6, #10B981, #F59E0B)",
        }}
      >
        <span
          className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rc-panel border-2 border-rc-ink shadow-sm"
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
 * Rendered flush (no card) as a 2 col × 3 row divided grid per the mockup.
 */
export default function NowConditions({
  rightNow,
  pressureMb,
  pressureTrend,
  tideSeries,
  label = "RIGHT NOW",
}: {
  rightNow: RightNowSnapshot | null;
  pressureMb: number | null;
  pressureTrend: number | null;
  tideSeries: (number | null)[];
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
      viz:
        rn?.waveM != null ? (
          <SeaBars level={Math.min(1, rn.waveM / 2)} />
        ) : null,
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
