"use client";

import { useMemo } from "react";
import { currentLocalHour } from "../lib/explore-data";

/**
 * Drawer 24h mini chart per the Figma: tier-tinted bars, the best
 * contiguous window highlighted in solid green, a marker line, and an hour
 * axis (06 · 12 · 18 · 24). Plain divs — no chart lib.
 *
 * When `onSelectHour` is supplied the bars become a scrubber: each hour is a
 * full-height click target, the marker tracks `selectedHour`, and the picked
 * bar is ringed. Otherwise the marker sits on "now" (drawer behaviour).
 */
export default function HourlyBars({
  hours,
  tz,
  selectedHour = null,
  onSelectHour,
}: {
  /** Hourly scores 0–100, null = unavailable. */
  hours: (number | null)[];
  tz: string;
  selectedHour?: number | null;
  onSelectHour?: (hour: number) => void;
}) {
  const nowHour = currentLocalHour(tz);
  const marker = selectedHour ?? nowHour;

  const { window, label } = useMemo(() => bestWindow(hours), [hours]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="rc-label text-[9px]">
          24H{label ? ` · BEST WINDOW ${label}` : ""}
        </div>
        {onSelectHour && (
          <div className="font-rc-mono text-[9px] text-rc-ink-mute italic">
            tap a bar to scrub
          </div>
        )}
      </div>
      <div className="relative flex items-end gap-[3px] h-16">
        {hours.map((score, i) => {
          const inWindow = window !== null && i >= window[0] && i <= window[1];
          const h = score === null ? 6 : Math.max(6, (score / 100) * 64);
          const color =
            score === null
              ? "bg-rc-rule-soft"
              : inWindow
                ? "bg-rc-good"
                : "bg-rc-good/30";
          const ring = i === marker ? "ring-1 ring-rc-ink" : "";

          const hhmm = `${String(i).padStart(2, "0")}:00`;
          if (onSelectHour) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectHour(i)}
                title={`${hhmm}${score !== null ? ` · ${score}` : ""}`}
                aria-label={`${hhmm}${score !== null ? ` · ${score}` : ""}`}
                aria-pressed={i === marker}
                className="group relative flex-1 h-full flex items-end cursor-pointer"
              >
                <span className="absolute inset-0 rounded-sm bg-rc-brand/[0.07] opacity-0 group-hover:opacity-100 transition-opacity" />
                <span
                  className={`relative w-full rounded-sm transition-transform group-hover:-translate-y-0.5 ${color} ${ring}`}
                  style={{ height: `${h}px` }}
                />
              </button>
            );
          }
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm ${color} ${ring}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
        {/* marker (now, or the scrubbed hour) */}
        <div
          className="absolute top-0 bottom-0 w-px bg-rc-poor pointer-events-none"
          style={{ left: `${((marker + 0.5) / 24) * 100}%` }}
        />
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

/** Longest contiguous run of hours ≥75 (fallback: ≥ max−10). */
export function bestWindow(hours: (number | null)[]): {
  window: [number, number] | null;
  label: string | null;
} {
  const max = Math.max(...hours.map((h) => h ?? 0));
  if (max <= 0) return { window: null, label: null };
  const threshold = max >= 75 ? 75 : max - 10;

  let best: [number, number] | null = null;
  let start: number | null = null;
  for (let i = 0; i <= hours.length; i++) {
    const qualifies = i < hours.length && (hours[i] ?? 0) >= threshold;
    if (qualifies && start === null) start = i;
    if (!qualifies && start !== null) {
      const run: [number, number] = [start, i - 1];
      if (!best || run[1] - run[0] > best[1] - best[0]) best = run;
      start = null;
    }
  }
  if (!best) return { window: null, label: null };
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return { window: best, label: `${fmt(best[0])}–${fmt(best[1] + 1)}` };
}
