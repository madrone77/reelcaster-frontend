"use client";

import { useMemo, useRef } from "react";
import { tierFor, type Tier } from "../lib/explore-data";
import type { ForecastDay } from "../lib/forecast-strip";

const num = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// Score-numeral color for the live hour reading — fair drops to its -ink
// variant so it clears the contrast floor at 26px on a white cell.
const NUMERAL: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

// Lane segment soft-tint fills + the 2px tier cap that gives the day its shape.
const SEG_BG: Record<Tier, string> = {
  good: "bg-rc-good-bg",
  fair: "bg-rc-fair-bg",
  poor: "bg-rc-poor-bg",
  none: "bg-rc-surface",
};
const SEG_CAP: Record<Tier, string> = {
  good: "#16A34A",
  fair: "#D78711",
  poor: "#DC2626",
  none: "#CBD5E1",
};

function argmax(hours: (number | null)[]): number {
  let hi = -1;
  let at = 0;
  hours.forEach((v, i) => {
    const n = num(v);
    if (n != null && n > hi) {
      hi = n;
      at = i;
    }
  });
  return at;
}

/**
 * The 14-day strip's SELECTED day cell, expanded in place into a 24-hour scrub
 * lane (the "Drillspan" concept). The cell keeps the day's identity but its
 * width becomes a lane of 24 tier-tinted hour segments — the day's whole shape
 * at a glance — with a single brand playhead. Dragging (or arrow-keying) snaps
 * to whole hours (a detent), so the parent commits the map-pin recolor + rail
 * re-rank once per hour-step, never per frame. At rest (scrubHour null) the
 * cell reads the day's peak, identical in spirit to the collapsed cell.
 */
export default function DayScrubCell({
  day,
  hours,
  scrubHour,
  onScrubHour,
}: {
  day: ForecastDay;
  /** Regional best score per hour for this day (length 24). */
  hours: (number | null)[];
  scrubHour: number | null;
  onScrubHour: (h: number) => void;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const peakHour = useMemo(() => argmax(hours), [hours]);
  const activeHour = scrubHour ?? peakHour;
  const liveScore = num(hours[activeHour]) ?? day.score ?? null;
  const liveTier = tierFor(liveScore);

  // Detent: map pointer x to the nearest whole hour and commit that hour.
  const hourFromEvt = (clientX: number) => {
    const el = laneRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    const t = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(23, Math.round(t * 23)));
  };

  const draggingRef = useRef(false);
  const commit = (clientX: number) => {
    const h = hourFromEvt(clientX);
    if (h != null && h !== scrubHour) onScrubHour(h);
  };

  return (
    <div className="relative flex-[5] min-w-0 h-full rounded border border-rc-brand bg-rc-panel flex">
      {day.isBest && (
        <span className="absolute -top-2 left-3 px-1.5 py-0.5 rounded font-rc-mono text-[8px] font-bold tracking-wide bg-rc-badge text-rc-ink leading-none z-10">
          BEST
        </span>
      )}

      {/* Left anchor — day identity over the live hour reading. The day-peak
          number morphs to the scrubbed hour; nothing new appears. */}
      <div className="shrink-0 w-[62px] flex flex-col justify-between px-2.5 py-2 border-r border-rc-rule-soft">
        <div>
          <div className="rc-label text-[9px] leading-none">{day.dow}</div>
          <div className="font-rc-mono text-[10px] text-rc-ink-soft mt-0.5">
            {day.date}
          </div>
        </div>
        <div>
          <div
            className={`text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums ${NUMERAL[liveTier]}`}
          >
            {liveScore ?? "—"}
          </div>
          <div className="font-rc-mono text-[11px] text-rc-ink mt-0.5">
            {String(activeHour).padStart(2, "0")}:00
          </div>
        </div>
      </div>

      {/* Lane — 24 tier segments (the day's shape) + brand playhead. */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-3">
        <div
          ref={laneRef}
          role="slider"
          tabIndex={0}
          aria-label={`Scrub hour for ${day.dow} ${day.date}`}
          aria-valuemin={0}
          aria-valuemax={23}
          aria-valuenow={activeHour}
          aria-valuetext={`${String(activeHour).padStart(2, "0")}:00, score ${liveScore ?? "unavailable"}`}
          className="relative h-5 flex gap-px cursor-ew-resize touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand rounded-sm"
          onPointerDown={(e) => {
            draggingRef.current = true;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            commit(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) commit(e.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              onScrubHour(Math.max(0, activeHour - 1));
              e.preventDefault();
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              onScrubHour(Math.min(23, activeHour + 1));
              e.preventDefault();
            } else if (e.key === "Home") {
              onScrubHour(0);
              e.preventDefault();
            } else if (e.key === "End") {
              onScrubHour(23);
              e.preventDefault();
            }
          }}
        >
          {hours.map((v, h) => {
            const t = tierFor(num(v));
            return (
              <div
                key={h}
                className={`flex-1 rounded-[1px] ${SEG_BG[t]}`}
                style={{ borderTop: `2px solid ${SEG_CAP[t]}` }}
              />
            );
          })}
          {/* Playhead */}
          <div
            className="absolute -top-1 -bottom-1 w-[2px] bg-rc-brand rounded-full pointer-events-none"
            style={{ left: `${(activeHour / 23) * 100}%` }}
          >
            <span className="absolute -top-1 -left-[3px] w-2 h-1.5 rounded-[2px] bg-rc-brand" />
          </div>
        </div>
        {/* Full 24h scale — evenly spaced marks land on hours 0·6·12·18·24
            (midnight → midnight), matching the calendar-day lane. */}
        <div className="flex justify-between font-rc-mono text-[8px] text-rc-ink-mute mt-1 px-px">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>
      </div>
    </div>
  );
}
