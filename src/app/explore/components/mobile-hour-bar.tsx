"use client";

import { useRef } from "react";
import { Waves, Wind, X } from "lucide-react";
import { tierFor, TIER_PILL, type Tier } from "../lib/explore-data";
import type { FlowKind } from "../lib/use-flow";
import { formatHour12 } from "@/lib/time-format";

const num = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// The same segment tints and caps the desktop scrub lane draws, so the day has
// one shape on both breakpoints.
const SEG_BG: Record<Tier, string> = {
  good: "bg-rc-good-bg",
  fair: "bg-rc-fair-bg",
  poor: "bg-rc-poor-bg",
  none: "bg-rc-surface",
};
const SEG_CAP: Record<Tier, string> = {
  good: "#3D8B4F",
  fair: "#C97A1C",
  poor: "#B23A2F",
  none: "#CBD5E1",
};

/**
 * The phone's hour scrubber, docked on the map's bottom edge above the spot
 * sheet whenever a flow layer is running.
 *
 * A phone has no forecast strip and so, until now, no way to move the map off
 * the day's peak hour: the currents and wind fields were drawn at whatever hour
 * scored best across the spots in view, with nothing on screen saying which
 * hour that was. This bar names the hour and lets a thumb move it. It reads
 * and writes the shell's one `scrubHour`, so dragging it recolours the pins,
 * re-ranks the sheet, and re-samples the running field, exactly as the desktop
 * scrub lane does.
 *
 * The track plots the in-view best score per hour, tier-tinted, rather than
 * the flow layer's own series: the fishing question is "when is it good", and
 * the flow field on the map beside it is what the water is doing at that hour.
 * The label says which field is running so the two read as one instrument.
 *
 * The spot page's map runs this same bar, so the two maps scrub, reset and
 * close the same way. There it rests on the clock ("Now") instead of the peak
 * and adds the field's own reading at the hour.
 */
export default function MobileHourBar({
  kind,
  hours,
  scrubHour,
  peakHour,
  onScrubHour,
  onReset,
  onClose,
  resetLabel = "Peak",
  reading,
  dayLabel,
  range,
}: {
  kind: FlowKind;
  /** In-view best score per hour for the selected day (length 24). */
  hours: (number | null)[];
  /** The pinned hour, or null when resting at the day's peak. */
  scrubHour: number | null;
  peakHour: number | null;
  onScrubHour: (h: number) => void;
  /** Back to the day's peak. */
  onReset: () => void;
  /**
   * The X in the corner: turn the flow layer off, which takes this bar with
   * it. The layers menu can do the same in two taps; this is the one-tap way
   * out, sitting on the thing being dismissed.
   */
  onClose: () => void;
  /**
   * What the resting hour is called. Explore rests on the day's peak; the spot
   * page rests on the clock, so it passes "Now". Null drops the reset entirely,
   * for a day where the resting hour has no name (another day on the spot page).
   */
  resetLabel?: string | null;
  /** The running field's own reading at the hour ("1.4 kn Flood"). */
  reading?: string | null;
  /** "Wed" when the bar is on another day. */
  dayLabel?: string | null;
  /** Hours the thumb may land on. Defaults to the whole day. */
  range?: [number, number];
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const activeHour = scrubHour ?? peakHour ?? 12;
  const liveScore = num(hours[activeHour]);
  const liveTier = tierFor(liveScore);
  const Icon = kind === "wind" ? Wind : Waves;
  const [loH, hiH] = range ?? [0, 23];
  const clamp = (h: number) => Math.max(loH, Math.min(hiH, h));
  const hourLabel = `${dayLabel ? `${dayLabel} ` : ""}${formatHour12(activeHour)}`;

  // Detent: the hour whose column the pointer is in. Committed once per hour
  // crossed, never per frame, so the map re-samples its field at most 24 times
  // in a full drag.
  const hourFromEvt = (clientX: number) => {
    const el = laneRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return null;
    const t = (clientX - r.left) / r.width;
    return clamp(Math.floor(t * 24));
  };
  const commit = (clientX: number) => {
    const h = hourFromEvt(clientX);
    if (h != null && h !== scrubHour) onScrubHour(h);
  };

  return (
    <div data-rc-hour-bar="" className="relative">
      {/* The way out, as its own square above the panel's top-right corner
          rather than a glyph inside the readout row. It sits level with the
          layers button on the left, so the two read as the pair they are: one
          starts a layer, the other stops it. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${kind === "wind" ? "wind" : "currents"}`}
        className="absolute bottom-full right-0 mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-rc-rule bg-rc-panel/95 text-rc-ink shadow-rc-panel backdrop-blur transition-colors hover:bg-rc-surface"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="rounded-xl border border-rc-rule bg-rc-panel/95 px-3 pt-2 pb-1.5 shadow-rc-panel backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-1.5 rc-label text-[10px] text-rc-ink">
            <Icon className="h-3.5 w-3.5 text-rc-brand" />
            {kind === "wind" ? "Wind" : "Currents"}
          </span>
          {reading && (
            <span className="truncate font-rc-mono text-[10px] text-rc-ink-soft">
              {reading}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-rc-mono text-[11px] font-semibold tabular-nums text-rc-ink">
            {hourLabel}
          </span>
          <span
            className={`rounded-sm px-1.5 py-0.5 font-rc-mono text-[10px] font-semibold ${TIER_PILL[liveTier]}`}
          >
            {liveScore ?? "—"}
          </span>
          {/* The way back to the peak. Explicit, because a scrubbed hour has no
              other tell once the thumb lifts. */}
          {resetLabel == null ? null : scrubHour != null && peakHour != null && scrubHour !== peakHour ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded px-1.5 py-0.5 bg-rc-brand-soft font-rc-mono text-[10px] font-semibold text-rc-brand"
            >
              {resetLabel}
            </button>
          ) : (
            <span className="px-1.5 font-rc-mono text-[10px] text-rc-ink-mute">{resetLabel}</span>
          )}
        </span>
      </div>

      {/* Lane: 24 tier segments plus the brand playhead. `touch-none` keeps a
          finger drag on the scrubber instead of panning the map beneath it. */}
      <div
        ref={laneRef}
        role="slider"
        tabIndex={0}
        aria-label="Hour shown on the map"
        aria-valuemin={loH}
        aria-valuemax={hiH}
        aria-valuenow={activeHour}
        aria-valuetext={`${hourLabel}, score ${liveScore ?? "unavailable"}${reading ? `, ${reading}` : ""}`}
        className="relative mt-1.5 flex h-5 gap-px cursor-ew-resize touch-none select-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
        onPointerDown={(e) => {
          draggingRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
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
          let next: number | null = null;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = activeHour - 1;
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = activeHour + 1;
          else if (e.key === "Home") next = loH;
          else if (e.key === "End") next = hiH;
          if (next == null) return;
          e.preventDefault();
          onScrubHour(clamp(next));
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
        <div
          className="pointer-events-none absolute -top-1 -bottom-1 w-[2px] rounded-full bg-rc-brand"
          style={{ left: `calc(${((activeHour + 0.5) / 24) * 100}% - 1px)` }}
          aria-hidden
        >
          <span className="absolute -top-1 -left-[3px] h-1.5 w-2 rounded-[2px] bg-rc-brand" />
        </div>
      </div>
      <div className="mt-1 flex justify-between px-px font-rc-mono text-[8px] text-rc-ink-mute">
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
