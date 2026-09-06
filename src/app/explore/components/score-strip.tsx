"use client";

import { useMemo, useRef, useState } from "react";

import { bestWindow } from "../lib/best-window";
import { currentLocalHour, STRIP_FILL, tierFor } from "../lib/explore-data";
import { formatHour12 } from "@/lib/time-format";

const HOURS = 24;

/** Fractional position of hour `h`'s center across the track, 0–1. */
const centerOf = (h: number) => (h + 0.5) / HOURS;

/**
 * Nearest hour CENTER to a pointer x, so the gaps between cells are not dead
 * zones and the live hour flips at the midpoint between two cells.
 */
function hourAtX(x: number, width: number): number {
  if (width <= 0) return 0;
  const h = Math.round((x / width) * HOURS - 0.5);
  return Math.min(HOURS - 1, Math.max(0, h));
}

/** Strip heights. `thin` is the phone list row, `dense` the rail and
 *  neighbour cards, `tall` the drawer, where nothing sits inside the cells. */
const HEIGHT = {
  thin: "h-3",
  dense: "h-4",
  regular: "h-[26px]",
  tall: "h-[34px]",
} as const;

/**
 * The 24-hour score strip: one tinted cell per hour, colour = rating, the
 * same cells the spot page's terminal chart leads with. Colour only — the
 * number for an hour lives in the readout pill that follows the pointer, and
 * the card around the strip states the peak in words. A bracket under the
 * strip marks the best window (`bestWindow`, the same rule the share card and
 * the spot page use).
 *
 * This replaced the tier-tinted bars: bar height said the score but colour
 * said nothing about rating, so a 23 and a 61 looked the same apart from
 * height, and the card and the spot page drew two different objects for the
 * same day.
 *
 * Interactive when `onHoverHour` or `onSelectHour` is supplied. The whole
 * track is one scrubber: pointer x snaps to the nearest hour center, the
 * marker glides there, and the pill floats above the live cell. Leaving the
 * track reports null so the caller reverts to its resting hour. Keyboard
 * users get one tab stop with arrow/Home/End/PageUp/PageDown.
 */
export default function ScoreStrip({
  hours,
  tz,
  selectedHour = null,
  onSelectHour,
  onHoverHour,
  size = "regular",
  axis = true,
  bracket = true,
  className = "",
}: {
  /** Hourly scores 0–100, null = unavailable. */
  hours: (number | null)[];
  /** The spot's clock; the marker rests on its current hour. Omitted (the
   *  dashboard's cards carry none), the strip rests on nothing. */
  tz?: string;
  selectedHour?: number | null;
  onSelectHour?: (hour: number) => void;
  /** Hover-scrub: fires per hovered hour, null when the pointer leaves. */
  onHoverHour?: (hour: number | null) => void;
  size?: keyof typeof HEIGHT;
  /** The 00 · 06 · 12 · 18 · 24 row under the strip. */
  axis?: boolean;
  /** The best-window bracket under the strip. */
  bracket?: boolean;
  className?: string;
}) {
  const marker = selectedHour ?? (tz ? currentLocalHour(tz) : null);
  const interactive = Boolean(onSelectHour || onHoverHour);

  const trackRef = useRef<HTMLDivElement>(null);
  const [liveHour, setLiveHour] = useState<number | null>(null);

  const { window } = useMemo(() => bestWindow(hours), [hours]);

  const hourFromEvent = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return hourAtX(clientX - rect.left, rect.width);
  };

  const scrubTo = (h: number) => {
    if (h === liveHour) return;
    setLiveHour(h);
    onHoverHour?.(h);
  };

  const endScrub = () => {
    setLiveHour(null);
    onHoverHour?.(null);
  };

  const stepTo = (h: number) => {
    const next = Math.min(HOURS - 1, Math.max(0, h));
    setLiveHour(next);
    onHoverHour?.(next);
    onSelectHour?.(next);
  };

  const readoutHour = liveHour;
  const readoutScore = readoutHour !== null ? hours[readoutHour] : null;
  const readoutPct = readoutHour !== null ? centerOf(readoutHour) * 100 : 0;
  const readoutShift =
    readoutPct < 8
      ? "translateX(-8px)"
      : readoutPct > 92
        ? "translateX(calc(-100% + 8px))"
        : "translateX(-50%)";

  return (
    <div className={className}>
      {/* The pill's row is reserved up front so the strip does not jump on
          hover. */}
      <div className={interactive ? "relative pt-6" : "relative"}>
        {readoutHour !== null && (
          <div
            className="absolute top-0 z-10 pointer-events-none whitespace-nowrap rounded bg-rc-ink px-1.5 py-0.5 font-rc-mono text-[10px] font-semibold text-white tabular-nums"
            style={{ left: `${readoutPct}%`, transform: readoutShift }}
          >
            {formatHour12(readoutHour)}
            {readoutScore !== null ? ` · ${readoutScore}` : " · —"}
          </div>
        )}

        <div
          ref={trackRef}
          role={interactive ? "slider" : "img"}
          tabIndex={interactive ? 0 : undefined}
          aria-label={
            interactive ? "Scrub the 24-hour forecast" : "24-hour score strip"
          }
          aria-valuemin={interactive ? 0 : undefined}
          aria-valuemax={interactive ? HOURS - 1 : undefined}
          aria-valuenow={interactive && marker !== null ? marker : undefined}
          aria-valuetext={
            interactive && marker !== null
              ? `${formatHour12(marker)}${hours[marker] !== null ? ` · ${hours[marker]}` : ""}`
              : undefined
          }
          onPointerMove={
            interactive
              ? (e) => {
                  const h = hourFromEvent(e.clientX);
                  if (h !== null) scrubTo(h);
                }
              : undefined
          }
          onPointerDown={
            interactive
              ? (e) => {
                  const h = hourFromEvent(e.clientX);
                  if (h === null) return;
                  setLiveHour(h);
                  onHoverHour?.(h);
                  onSelectHour?.(h);
                }
              : undefined
          }
          onPointerLeave={interactive ? endScrub : undefined}
          onBlur={interactive ? endScrub : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  const from = liveHour ?? marker ?? 0;
                  if (e.key === "ArrowLeft") stepTo(from - 1);
                  else if (e.key === "ArrowRight") stepTo(from + 1);
                  else if (e.key === "PageDown") stepTo(from - 6);
                  else if (e.key === "PageUp") stepTo(from + 6);
                  else if (e.key === "Home") stepTo(0);
                  else if (e.key === "End") stepTo(HOURS - 1);
                  else if (e.key === "Escape") endScrub();
                  else return;
                  e.preventDefault();
                }
              : undefined
          }
          className={`relative flex gap-[2px] ${HEIGHT[size]} ${
            interactive
              ? "cursor-pointer touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-rc-brand/40"
              : ""
          }`}
        >
          {hours.map((score, i) => (
            <span
              key={i}
              className={`flex-1 h-full rounded-[2px] ${
                i === liveHour
                  ? "outline outline-2 -outline-offset-1 outline-rc-brand z-[1]"
                  : ""
              }`}
              style={{ background: STRIP_FILL[tierFor(score)] }}
            />
          ))}
          {/* Marker — glides between hour centers so the snap is visible. */}
          {marker !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-rc-poor pointer-events-none transition-[left] duration-100 ease-out motion-reduce:transition-none"
              style={{ left: `${centerOf(marker) * 100}%` }}
            />
          )}
        </div>

        {/* Best-window bracket: an open box hung under the cells it spans. */}
        {bracket && window !== null && (
          <div className="relative h-[6px] mt-[2px]" aria-hidden>
            <span
              className="absolute top-0 h-[5px] border-[1.5px] border-t-0 border-rc-ink rounded-b-[3px]"
              style={{
                left: `calc(${(window[0] / HOURS) * 100}% + 1px)`,
                width: `calc(${((window[1] - window[0] + 1) / HOURS) * 100}% - 2px)`,
              }}
            />
          </div>
        )}
      </div>

      {axis && (
        <div className="flex justify-between font-rc-mono text-[9px] text-rc-ink-soft mt-1.5">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      )}
    </div>
  );
}
