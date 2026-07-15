"use client";

/**
 * Full-width tide curve for the spot page — sized to match the 24h score chart
 * beneath it. A smooth line with a soft fill and the same 06·12·18·24 hour axis,
 * plus a marker that tracks the scrubbed hour.
 */
export default function TideChart({
  series,
  selectedHour = null,
}: {
  /** Tide height (m) per local hour; nulls are bridged. */
  series: (number | null)[];
  selectedHour?: number | null;
}) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = series.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  // 5% padding top and bottom so peaks/troughs aren't clipped.
  const y = (v: number) => 100 - (((v - min) / span) * 90 + 5);

  const pts = series.map(
    (v, i) => `${x(i).toFixed(2)},${(v == null ? 50 : y(v)).toFixed(2)}`,
  );
  const line = pts.join(" ");
  const area = `0,100 ${line} 100,100`;
  const marker = selectedHour != null ? x(selectedHour) : null;

  return (
    <div>
      <div className="relative h-16 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          role="img"
          aria-label={`24-hour tide, ${min.toFixed(1)} m to ${max.toFixed(1)} m`}
        >
          <polygon points={area} fill="var(--rc-brand)" opacity={0.08} />
          <polyline
            points={line}
            fill="none"
            stroke="var(--rc-brand)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {marker != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-rc-ink/40 pointer-events-none"
            style={{ left: `${marker}%` }}
          />
        )}
      </div>
      <div className="flex justify-between font-rc-mono text-[9px] text-rc-ink-mute mt-1.5">
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
