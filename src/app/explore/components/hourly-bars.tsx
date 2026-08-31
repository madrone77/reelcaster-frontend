"use client";

import { useMemo, useRef, useState } from "react";

// Lives in lib/ so server code (the share card) can use the same rule.
import { bestWindow } from "../lib/best-window";
export { bestWindow };
import { currentLocalHour } from "../lib/explore-data";
import { formatHour12 } from "@/lib/time-format";

const HOURS = 24;

const hhmm = (h: number) => formatHour12(h);

/** Fractional position of hour `h`'s center across the track, 0–1. */
const centerOf = (h: number) => (h + 0.5) / HOURS;

/**
 * The magnet: nearest hour *center* to a pointer x, not "whichever bar the
 * pixel landed in". Snapping to centers means the 2px inter-bar gaps stop
 * being dead zones and the active hour flips at the midpoint between two
 * bars — the scrub reads as hour-to-hour detents rather than edge crossings.
 */
function hourAtX(x: number, width: number): number {
  if (width <= 0) return 0;
  const h = Math.round((x / width) * HOURS - 0.5);
  return Math.min(HOURS - 1, Math.max(0, h));
}

/**
 * Drawer 24h mini chart per the Figma: tier-tinted bars, the best
 * contiguous window highlighted in solid green, a marker line, and an hour
 * axis (00 · 06 · 12 · 18 · 24). Plain divs — no chart lib.
 *
 * Interactive when `onHoverHour` (hover-scrub) or `onSelectHour` (click-scrub)
 * is supplied. The whole track is one scrubber rather than 24 sibling buttons:
 * pointer x snaps to the nearest hour center (see `hourAtX`), the marker glides
 * to that center, and a readout pill floats above the live bar so the hour and
 * its score sit under the cursor instead of only in the drawer header. Leaving
 * the track reports null so the caller reverts to its resting hour. Keyboard
 * users get one tab stop with arrow/Home/End/PageUp/PageDown, not 24.
 */
export default function HourlyBars({
  hours,
  tz,
  selectedHour = null,
  onSelectHour,
  onHoverHour,
  dense = false,
  hideLabel = false,
}: {
  /** Hourly scores 0–100, null = unavailable. */
  hours: (number | null)[];
  tz: string;
  selectedHour?: number | null;
  onSelectHour?: (hour: number) => void;
  /** Hover-scrub: fires per hovered hour, null when the pointer leaves. */
  onHoverHour?: (hour: number | null) => void;
  /** Compact variant for the narrow rail card — shorter label + bars. */
  dense?: boolean;
  /** Omit the "24H · BEST WINDOW" header row (the card carries that in its conclusion line). */
  hideLabel?: boolean;
}) {
  const nowHour = currentLocalHour(tz);
  const marker = selectedHour ?? nowHour;
  const interactive = Boolean(onSelectHour || onHoverHour);

  const trackRef = useRef<HTMLDivElement>(null);
  // The chart's own live hour — drives the readout pill. Distinct from
  // `marker`, which the caller may be parking on a resting hour.
  const [liveHour, setLiveHour] = useState<number | null>(null);

  const { window, label } = useMemo(() => bestWindow(hours), [hours]);

  const hourFromEvent = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return hourAtX(clientX - rect.left, rect.width);
  };

  const scrubTo = (h: number) => {
    if (h === liveHour) return; // pointermove fires per pixel; only act on detent changes
    setLiveHour(h);
    onHoverHour?.(h);
  };

  const endScrub = () => {
    setLiveHour(null);
    onHoverHour?.(null);
  };

  // Keyboard steps the same detents the pointer snaps to.
  const stepTo = (h: number) => {
    const next = Math.min(HOURS - 1, Math.max(0, h));
    setLiveHour(next);
    onHoverHour?.(next);
    onSelectHour?.(next);
  };

  const readoutHour = liveHour;
  const readoutScore = readoutHour !== null ? hours[readoutHour] : null;
  // Anchor the pill on the live bar, but pin it inside the track at the ends
  // so hours 00 and 23 don't push it under the panel's rounded clip.
  const readoutPct = readoutHour !== null ? centerOf(readoutHour) * 100 : 0;
  const readoutShift =
    readoutPct < 8
      ? "translateX(-8px)"
      : readoutPct > 92
        ? "translateX(calc(-100% + 8px))"
        : "translateX(-50%)";

  return (
    <div>
      {!hideLabel && (
        <div className="flex items-baseline justify-between mb-1.5 gap-2">
          <div className="rc-label text-[9px] whitespace-nowrap">
            24H{label ? ` · BEST WINDOW ${label}` : ""}
          </div>
          {onSelectHour && !onHoverHour && (
            <div className="font-rc-mono text-[9px] text-rc-ink-mute italic shrink-0">
              tap a bar to scrub
            </div>
          )}
          {onHoverHour && (
            <div className="font-rc-mono text-[9px] text-rc-ink-mute italic shrink-0">
              hover to scrub
            </div>
          )}
        </div>
      )}

      {/* Reserve the readout's row up front so the bars don't jump on hover. */}
      <div className={interactive ? "relative pt-6" : "relative"}>
        {readoutHour !== null && (
          <div
            className="absolute top-0 z-10 pointer-events-none whitespace-nowrap rounded bg-rc-ink px-1.5 py-0.5 font-rc-mono text-[10px] font-semibold text-white tabular-nums"
            style={{ left: `${readoutPct}%`, transform: readoutShift }}
          >
            {hhmm(readoutHour)}
            {readoutScore !== null ? ` · ${readoutScore}` : " · —"}
          </div>
        )}

        <div
          ref={trackRef}
          role={interactive ? "slider" : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? "Scrub the 24-hour forecast" : undefined}
          aria-valuemin={interactive ? 0 : undefined}
          aria-valuemax={interactive ? HOURS - 1 : undefined}
          aria-valuenow={interactive ? marker : undefined}
          aria-valuetext={
            interactive
              ? `${hhmm(marker)}${hours[marker] !== null ? ` · ${hours[marker]}` : ""}`
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
          onPointerLeave={interactive ? endScrub : undefined}
          onPointerDown={
            onSelectHour
              ? (e) => {
                  const h = hourFromEvent(e.clientX);
                  if (h !== null) {
                    setLiveHour(h);
                    onSelectHour(h);
                  }
                }
              : undefined
          }
          onBlur={interactive ? endScrub : undefined}
          onKeyDown={
            interactive
              ? (e) => {
                  const from = liveHour ?? marker;
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
          className={`relative flex items-end gap-[2px] ${dense ? "h-10" : "h-16"} ${
            interactive
              ? "cursor-pointer touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-rc-brand/40"
              : ""
          }`}
        >
          {hours.map((score, i) => {
            const inWindow = window !== null && i >= window[0] && i <= window[1];
            const maxH = dense ? 40 : 64;
            const h = score === null ? 6 : Math.max(6, (score / 100) * maxH);
            const live = i === liveHour;
            const color =
              score === null
                ? "bg-rc-rule-soft"
                : inWindow
                  ? "bg-rc-good"
                  : "bg-rc-good/30";

            return (
              <div
                key={i}
                className="relative flex-1 h-full flex items-end pointer-events-none"
              >
                {/* Detent wash — the bar the magnet has locked onto. */}
                {live && (
                  <span className="absolute inset-0 rounded-sm bg-rc-brand/[0.09]" />
                )}
                <span
                  className={`relative w-full rounded-sm transition-transform duration-100 ${color} ${
                    live || i === marker ? "ring-1 ring-rc-ink" : ""
                  } ${live ? "-translate-y-0.5" : ""}`}
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
          {/* Marker — glides between hour centers so the snap is visible. */}
          <div
            className="absolute top-0 bottom-0 w-px bg-rc-poor pointer-events-none transition-[left] duration-100 ease-out"
            style={{ left: `${centerOf(marker) * 100}%` }}
          />
        </div>
      </div>

      {/* ink-soft, not ink-mute. At 9px these are the smallest text on the
          chart and ink-mute measures 2.8:1 on the surface this now sits on
          (3.2:1 even on white), under the 4.5:1 floor. The axis is how a
          reader locates the window in the day, so it is not decoration that
          can be allowed to fade. */}
      <div className="flex justify-between font-rc-mono text-[9px] text-rc-ink-soft mt-1.5">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

