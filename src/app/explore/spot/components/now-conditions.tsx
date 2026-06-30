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
      className="w-14 h-6"
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

/** Two stacked wavelets for the SEA tile. */
function WaveGlyph() {
  return (
    <svg viewBox="0 0 28 20" className="w-7 h-5 shrink-0" aria-hidden>
      <path
        d="M1 7 q3.5 -5 7 0 t7 0 t7 0"
        fill="none"
        stroke="var(--rc-brand)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M1 14 q3.5 -5 7 0 t7 0 t7 0"
        fill="none"
        stroke="var(--rc-brand)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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

// ── metric cell ───────────────────────────────────────────────────────────

type Metric = {
  label: string;
  value: string;
  sub?: string | null;
  viz?: React.ReactNode;
};

/**
 * RIGHT NOW conditions panel. Wind / sea / water / air come from the spot-page
 * `rightNow` snapshot; pressure (+3h trend) comes from point-conditions, which
 * the spot-page payload omits. Tide curve is drawn from the day's tide series.
 * Rendered as a single divided panel (2 cols × 3 rows) per the mockup.
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
      sub: rn?.waveM != null ? `${rn.waveM.toFixed(1)} m` : null,
      viz: <WaveGlyph />,
    },
    {
      label: "PRESSURE",
      value: pressureMb != null ? `${Math.round(pressureMb)}` : "—",
      sub: pTrend ?? (pressureMb != null ? "mb" : null),
    },
    {
      label: "WATER",
      value: rn?.seaTempC != null ? `${rn.seaTempC.toFixed(1)}°` : "—",
    },
    {
      label: "AIR",
      value: rn?.airTempC != null ? `${rn.airTempC.toFixed(1)}°` : "—",
    },
  ];

  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
      <div className="rc-label text-[9px] mb-1">{label}</div>
      <div className="grid grid-cols-2">
        {metrics.map((m, i) => {
          const isLeft = i % 2 === 0;
          const isLastRow = i >= metrics.length - 2;
          return (
            <div
              key={m.label}
              className={`flex items-start justify-between gap-2 py-3 ${
                isLeft ? "pr-4 border-r border-rc-rule-soft" : "pl-4"
              } ${isLastRow ? "" : "border-b border-rc-rule-soft"}`}
            >
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
          );
        })}
      </div>
    </div>
  );
}
