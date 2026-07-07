"use client";

import { useRef } from "react";
import { hourClock } from "./scoring-ui";

interface HourScrubberProps {
  scores: (number | null)[]; // any scale; peak computed internally
  hour: number; // selected hour
  onHour: (h: number) => void;
  colorFor: (v: number | null) => string;
  nowHour?: number; // optional "now" marker
  homeHour?: number; // if set, scrubber reverts here when the pointer leaves
  best?: { start: number; end: number } | null;
  height?: number;
}

/**
 * Draggable 24-hour scrubber over a bar chart. The handle snaps to the nearest
 * hour ("magnetic per hour") and eases between hours via a short CSS transition
 * for a semi-magnetic feel. Dragging calls onHour with the snapped hour.
 */
export function HourScrubber({ scores, hour, onHour, colorFor, nowHour, homeHour, best, height = 120 }: HourScrubberProps) {
  const ref = useRef<HTMLDivElement>(null);
  const n = scores.length || 24;
  const peak = scores.reduce<number>((m, s) => Math.max(m, s ?? 0), 0) || 1;

  const hourFromClientX = (clientX: number) => {
    const el = ref.current;
    if (!el) return hour;
    const r = el.getBoundingClientRect();
    const f = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(n - 1, Math.round(f * n - 0.5)));
  };

  // Scrub on rollover (any pointer move over the chart) — no click needed.
  const onPointerMove = (e: React.PointerEvent) => {
    onHour(hourFromClientX(e.clientX));
  };
  // Touch fallback (no hover): tapping/dragging still scrubs.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") onHour(hourFromClientX(e.clientX));
  };
  const onPointerLeave = () => {
    if (homeHour != null) onHour(homeHour);
  };

  const handlePct = ((hour + 0.5) / n) * 100;
  const sel = scores[hour];

  return (
    <div>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative cursor-crosshair touch-none select-none"
        style={{ height }}
      >
        <div className="flex h-full items-end gap-[3px]">
          {scores.map((s, h) => {
            const inWin = best && h >= best.start && h <= best.end;
            const active = h === hour;
            return (
              <div
                key={h}
                className="pointer-events-none flex-1 rounded-t-[2px]"
                style={{
                  height: `${Math.max(3, ((s ?? 0) / peak) * 100)}%`,
                  background: colorFor(s),
                  opacity: s == null ? 0.12 : active ? 1 : inWin ? 0.95 : 0.45,
                }}
              />
            );
          })}
        </div>

        {nowHour != null && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-rcc-ink/25"
            style={{ left: `${((nowHour + 0.5) / n) * 100}%` }}
          />
        )}

        {/* scrubber handle */}
        <div
          className="pointer-events-none absolute -top-2 bottom-0 flex flex-col items-center transition-[left] duration-100 ease-out"
          style={{ left: `${handlePct}%`, transform: "translateX(-50%)" }}
        >
          <span className="whitespace-nowrap rounded-[3px] bg-rcc-brand px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-sm">
            {hourClock(hour)} · {sel ?? "—"}
          </span>
          <span className="w-[2px] flex-1 bg-rcc-brand/80" />
        </div>
      </div>
    </div>
  );
}
