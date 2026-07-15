"use client";

import { useRef } from "react";
import { TIER_PILL, tierFor, type Tier } from "../lib/explore-data";

/** Bar fill per tier for the compact hourly track. */
const TIER_TICK: Record<Tier, string> = {
  good: "bg-rc-good",
  fair: "bg-rc-fair",
  poor: "bg-rc-poor",
  none: "bg-rc-rule",
};

/** 0–23 → "12am", "5am", "12pm", "11pm". */
function fmtHour12(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

/**
 * "Daybreak" hour scrubber — an inline row inside the combined bottom forecast
 * panel, below the day cells. Left: the hour + tier score readout. Right: a
 * slim tier-tinted hour track with a draggable knob. Scrubbing recolors the
 * map pins and re-scores the rail to that hour.
 *
 * `hours` is the regional best score per hour (0–23) across visible spots —
 * the envelope the readout and ticks report.
 */
export default function HourScrubber({
  hours,
  hour,
  onScrub,
}: {
  hours: (number | null)[];
  hour: number;
  onScrub: (h: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const hourFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return hour;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 23);
  };

  const score = hours[hour] ?? null;
  const tier = tierFor(score);
  const leftPct = (hour / 23) * 100;

  return (
    <div className="flex items-center gap-3">
      {/* Readout */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-rc-mono text-[15px] font-bold text-rc-brand tabular-nums">
          {fmtHour12(hour)}
        </span>
        {score !== null && (
          <span
            className={`font-rc-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${TIER_PILL[tier]}`}
          >
            {score}
          </span>
        )}
      </div>

      {/* Track — regional hourly curve, draggable */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Hour of day"
        aria-valuemin={0}
        aria-valuemax={23}
        aria-valuenow={hour}
        aria-valuetext={`${fmtHour12(hour)}${score !== null ? `, best score ${score}` : ""}`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onScrub(hourFromClientX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) onScrub(hourFromClientX(e.clientX));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onScrub(Math.max(0, hour - 1));
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onScrub(Math.min(23, hour + 1));
          }
        }}
        className="relative flex-1 h-[26px] flex items-end gap-[2px] cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-rc-brand rounded"
      >
        {hours.length === 24 &&
          hours.map((s, h) => {
            const t = tierFor(s);
            const pct = s === null ? 12 : Math.max(12, s);
            return (
              <div
                key={h}
                className={`flex-1 rounded-[1px] ${TIER_TICK[t]} ${h === hour ? "" : "opacity-70"}`}
                style={{ height: `${pct}%` }}
              />
            );
          })}

        {/* Handle */}
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-rc-brand pointer-events-none"
          style={{ left: `${leftPct}%` }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-rc-panel border-2 border-rc-brand pointer-events-none"
          style={{ left: `${leftPct}%`, top: "50%", transform: "translate(-50%, -50%)" }}
        />
      </div>
    </div>
  );
}
