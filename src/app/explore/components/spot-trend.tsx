"use client";

import { bestWindow } from "./hourly-bars";

/**
 * Compact inline 24h trend for the rail card meta row: 12 two-hour buckets,
 * best-window buckets at full score-green, the rest at the light tint. No hour
 * axis, no marker — it's a glanceable sparkline. Exposed as a single `img` to
 * assistive tech with the peak window described.
 */
export default function SpotTrend({ hours }: { hours: (number | null)[] }) {
  const { window, label } = bestWindow(hours);

  const buckets = Array.from({ length: 12 }, (_, i) => {
    const pair = [hours[2 * i], hours[2 * i + 1]].filter(
      (v): v is number => v != null,
    );
    const score = pair.length
      ? pair.reduce((s, v) => s + v, 0) / pair.length
      : null;
    const inWindow =
      window !== null &&
      ((2 * i >= window[0] && 2 * i <= window[1]) ||
        (2 * i + 1 >= window[0] && 2 * i + 1 <= window[1]));
    return { score, inWindow };
  });

  return (
    <div
      role="img"
      aria-label={
        label
          ? `24-hour score trend, best window ${label}`
          : "24-hour score trend"
      }
      className="flex flex-1 min-w-[80px] items-end gap-[2px] h-6"
    >
      {buckets.map((b, i) => {
        const h = b.score == null ? 3 : Math.max(3, (b.score / 100) * 24);
        const color =
          b.score == null
            ? "bg-rc-rule-soft"
            : b.inWindow
              ? "bg-rc-good"
              : "bg-rc-good/30";
        return (
          <span
            key={i}
            className={`flex-1 rounded-t-[2px] ${color}`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}
