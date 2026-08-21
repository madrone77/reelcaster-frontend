"use client";

import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import { convertHeight, formatHeight } from "@/app/utils/unit-conversions";

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
  const { tideUnit } = useUnitPreferences();
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = series.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  // 5% padding top and bottom so peaks/troughs aren't clipped.
  const y = (v: number) => 100 - (((v - min) / span) * 90 + 5);

  // Missing hours are SKIPPED, not plotted.
  //
  // They used to be drawn at y=50, the vertical middle, which is a fabricated
  // tide height rather than a gap: the curve dipped to mid-range and back for
  // every hour with no reading. Omitting the point lets the polyline bridge
  // the gap in a straight line, which is an honest interpolation between the
  // two real readings on either side. Visible on the city pages, where the
  // station feed starts six hours before now, so the small hours of today have
  // no data at all once it is past dawn.
  const covered = series
    .map((v, i) => (v == null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p !== null);
  if (covered.length < 2) return null;

  const pts = covered.map((p) => `${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`);
  const line = pts.join(" ");
  // The fill follows the data rather than stretching to the frame, so a
  // partly-covered day does not imply readings it does not have.
  const area = `${x(covered[0].i).toFixed(2)},100 ${line} ${x(
    covered[covered.length - 1].i,
  ).toFixed(2)},100`;
  const marker = selectedHour != null ? x(selectedHour) : null;

  return (
    <div>
      <div className="relative h-16 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          role="img"
          aria-label={`24-hour tide, ${formatHeight(convertHeight(min, "m", tideUnit), tideUnit)} to ${formatHeight(convertHeight(max, "m", tideUnit), tideUnit)}`}
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
