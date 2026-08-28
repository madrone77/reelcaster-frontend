"use client";

import { useCallback, useMemo, useRef } from "react";
import type { SunHours } from "@/lib/bluecaster/live-spot-types";
import { haptic } from "@/lib/haptics";
import type { FlowKind } from "../../lib/use-flow";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import { convertWind, formatWind } from "@/app/utils/unit-conversions";
import { formatHour12 } from "@/lib/time-format";
import { niceCurrentScale } from "../../lib/current-series";
import { windCardinal } from "../../lib/wind-rose";

const num = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

/**
 * The hours this bar is allowed to land on. Matches the 24h chart's rule
 * exactly — leading/trailing hours with no fishing score are empty cells there,
 * and the two scrubbers share one `selectedHour`, so a map-only hour would put
 * the chart's cursor on a blank cell and the conditions strip on nulls.
 */
function scoredRange(scores: (number | null)[] | null): [number, number] {
  if (!scores) return [0, 23];
  const lo = scores.findIndex((v) => num(v) != null);
  if (lo < 0) return [0, 23];
  let hi = 23;
  while (hi > lo && num(scores[hi]) == null) hi--;
  return [lo, hi];
}

/**
 * The hour scrubber that lives on the spot map, docked inside its bottom edge
 * whenever the Currents or Winds field is running.
 *
 * It exists because the map and the 24-hour chart are a thousand pixels apart.
 * The flow field has always been drawn at the chart's scrubbed hour, but from
 * up here that was invisible: nothing on the map said which hour it was
 * painting, and the only control was far below the fold. On desktop it was
 * worse than invisible — the chart snapped back to the live hour the moment the
 * pointer left it, so scrolling up to look at the map undid the pick on the way.
 *
 * There is still exactly ONE hour on the page. This bar reads and writes the
 * shell's `selectedHour`, so dragging it moves the chart cursor and the
 * conditions strip, and dragging the chart moves this.
 *
 * The track is not a bare slider. It plots the running layer's own 24 hours —
 * wind as bars, current as a signed curve around slack — so the thing you are
 * scrubbing shows you where its own peaks are, in the same shapes and colours
 * the chart's WIND and CURRENT rows use.
 */
export default function MapHourBar({
  kind,
  hour,
  onSelectHour,
  nowHour,
  isToday,
  scrubbed,
  onNow,
  dayLabel,
  scores,
  wind,
  gust,
  windDir,
  current,
  sun,
}: {
  /** Which flow field is running — decides what the track plots and reads out. */
  kind: FlowKind;
  hour: number;
  onSelectHour: (hour: number) => void;
  nowHour: number;
  /** The active forecast day is today, so "now" is a point on this track. */
  isToday: boolean;
  /** The angler has pinned an hour; until then the bar is following the clock. */
  scrubbed: boolean;
  onNow: () => void;
  /** "Wed" when the strip is showing another day, null on today. */
  dayLabel: string | null;
  /** Hourly score row for the active day — clamps the scrub, nothing more. */
  scores: (number | null)[] | null;
  wind: (number | null)[];
  gust: (number | null)[];
  windDir: (number | null)[];
  /** Signed knots, +flood / −ebb. Null before the predicted series lands. */
  current: (number | null)[] | null;
  sun: SunHours;
}) {
  const { windUnit, currentUnit } = useUnitPreferences();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const lastHourRef = useRef<number | null>(null);

  const [loH, hiH] = useMemo(() => scoredRange(scores), [scores]);
  const clamp = useCallback(
    (h: number) => Math.max(loH, Math.min(hiH, h)),
    [loH, hiH],
  );

  const isWind = kind === "wind";

  // ── track geometry ────────────────────────────────────────────────────
  // Wind bars scale to the day's own gust ceiling so a calm day still reads as
  // a shape rather than a flat line; current keeps a symmetric scale around
  // slack, the same `niceCurrentScale` the chart's CURRENT row fits to.
  const windMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < 24; i++) {
      m = Math.max(m, num(gust[i]) ?? 0, num(wind[i]) ?? 0);
    }
    return Math.max(5, m);
  }, [wind, gust]);
  // The current track fits the day's own peak, NOT `niceCurrentScale`. That
  // helper exists to put a labelled axis on round numbers, and this track has no
  // axis: rounding 2.1 kn up to a 3 kn scale here just spends a third of 28px on
  // nothing, and flattens the shape it is there to show.
  const curMax = useMemo(() => {
    if (!current) return 1;
    let m = 0;
    for (const v of current) m = Math.max(m, Math.abs(num(v) ?? 0));
    return Math.max(0.2, m);
  }, [current]);

  // Daylight as a fraction of the track, for the band behind the plot. Civil
  // twilight, not sunrise/sunset: the chart shades the same way, and the
  // shoulders are when people actually launch.
  const dayBand = useMemo(() => {
    const a = Math.max(0, Math.min(24, sun.civilRise));
    const b = Math.max(a, Math.min(24, sun.civilSet));
    return { left: a / 24, width: (b - a) / 24 };
  }, [sun.civilRise, sun.civilSet]);

  // ── readout ───────────────────────────────────────────────────────────
  const readout = useMemo(() => {
    if (isWind) {
      const kt = num(wind[hour]);
      const g = num(gust[hour]);
      const dir = windDir[hour] ?? null;
      const name = windCardinal(dir);
      return {
        value:
          kt == null
            ? "—"
            : formatWind(convertWind(kt, "knots", windUnit), windUnit),
        // Gust only when it is actually a gust. A "G14" beside "14 kn" is noise.
        sub:
          kt != null && g != null && g - kt > 5
            ? `${name ?? ""} · gusting ${convertWind(g, "knots", windUnit).toFixed(0)}`.trim()
            : name,
        /** Degrees the arrow is rotated. See the glyph below for the convention. */
        dir,
      };
    }
    const v = current ? num(current[hour]) : null;
    // Same slack threshold the conditions strip uses, so the two never disagree
    // about whether the water is moving.
    const slackThr = current
      ? Math.min(0.3, Math.max(0.1, 0.2 * niceCurrentScale(current)))
      : 0.3;
    return {
      value:
        v == null
          ? "—"
          : formatWind(convertWind(Math.abs(v), "knots", currentUnit), currentUnit, 1),
      sub:
        v == null
          ? null
          : Math.abs(v) < slackThr
            ? "Slack"
            : v > 0
              ? "Flood"
              : "Ebb",
      dir: null as number | null,
    };
  }, [isWind, wind, gust, windDir, current, hour, windUnit, currentUnit]);

  // ── pointer scrubbing ─────────────────────────────────────────────────
  const hourAt = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return null;
    const f = (clientX - r.left) / r.width;
    return clamp(Math.floor(f * 24));
  }, [clamp]);

  const move = useCallback(
    (e: React.PointerEvent, force = false) => {
      if (!force && !draggingRef.current) return;
      const h = hourAt(e.clientX);
      if (h == null || !Number.isFinite(h)) return;
      // Light haptic per hour crossed while dragging with a finger — the same
      // tick the 24h chart gives, so the two scrubbers feel like one control.
      if (
        lastHourRef.current != null &&
        h !== lastHourRef.current &&
        e.pointerType !== "mouse"
      ) {
        haptic();
      }
      lastHourRef.current = h;
      if (h !== hour) onSelectHour(h);
    },
    [hourAt, hour, onSelectHour],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = hour - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = hour + 1;
    else if (e.key === "Home") next = loH;
    else if (e.key === "End") next = hiH;
    if (next == null) return;
    e.preventDefault();
    onSelectHour(clamp(next));
  };

  const hourLabel = `${dayLabel ? `${dayLabel} ` : ""}${formatHour12(hour)}`;
  const atNow = isToday && hour === nowHour;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-rc-panel/95 backdrop-blur-sm border-t border-rc-rule px-2.5 pt-1.5 pb-2">
      {/* Readout row: what the field is doing at the scrubbed hour, then the
          hour itself. The map is showing a whole field; this names the one
          number a reader would otherwise have to scroll down for. */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="rc-label text-rc-ink-mute shrink-0">
            {isWind ? "Wind" : "Current"}
          </span>
          {readout.dir != null && (
            /* Points at where the wind is COMING FROM, matching the arrows in
               the chart's WIND row: the glyph is drawn pointing south and
               rotated by (deg + 180). */
            <svg
              viewBox="-8 -8 16 16"
              className="w-3.5 h-3.5 shrink-0 text-rc-ink-soft"
              aria-hidden
              style={{ transform: `rotate(${(readout.dir + 180) % 360}deg)` }}
            >
              <path
                d="M0,-6 L0,6 M0,6 L-3,2 M0,6 L3,2"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span className="font-bold text-rc-ink text-[13px] leading-none shrink-0">
            {readout.value}
          </span>
          {readout.sub && (
            <span className="font-rc-mono text-[10px] text-rc-ink-mute truncate">
              {readout.sub}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-rc-mono text-[11px] font-semibold text-rc-ink tabular-nums">
            {hourLabel}
          </span>
          {/* The way back. The chart used to do this implicitly on mouse-leave,
              which is why a pinned hour could not survive the scroll up to this
              map; it is an explicit button now, on both breakpoints. */}
          {isToday && (scrubbed || !atNow) ? (
            <button
              type="button"
              onClick={onNow}
              className="rounded px-1.5 py-0.5 bg-rc-brand-soft text-rc-brand font-rc-mono text-[10px] font-semibold hover:bg-rc-brand-soft/70 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rc-brand"
            >
              Now
            </button>
          ) : (
            isToday && (
              <span className="font-rc-mono text-[10px] text-rc-ink-mute">Now</span>
            )
          )}
        </div>
      </div>

      {/* The track. Also a 24-hour plot of the running layer, so it shows its
          own peaks instead of being an undifferentiated slider. */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`Hour shown on the map, ${isWind ? "wind" : "current"} field`}
        aria-valuemin={loH}
        aria-valuemax={hiH}
        aria-valuenow={hour}
        aria-valuetext={`${hourLabel}, ${readout.value}${readout.sub ? ` ${readout.sub}` : ""}`}
        onPointerDown={(e) => {
          draggingRef.current = true;
          lastHourRef.current = null;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          move(e, true);
        }}
        onPointerMove={(e) => move(e)}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
        onKeyDown={onKeyDown}
        /* 28px of plot plus padding clears the 44px touch target without the
           bar eating the map. `touch-action:none` keeps a finger drag scrubbing
           rather than scrolling the page out from under it — the same trade the
           24h chart makes. */
        className="relative mt-1.5 h-8 py-[2px] cursor-crosshair select-none touch-none rounded-sm bg-rc-surface overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rc-brand"
      >
        {/* Daylight band behind the plot. Night is the tinted part, so the
            track reads dark at the ends the way the day does. */}
        <div className="absolute inset-0 bg-rc-ink/5" aria-hidden />
        <div
          className="absolute inset-y-0 bg-rc-panel"
          style={{ left: pct(dayBand.left), width: pct(dayBand.width) }}
          aria-hidden
        />

        {/* Per-hour plot. Flex columns rather than a measured SVG: the bar has
            to survive the map going fullscreen, and percentage heights re-fit
            without a ResizeObserver. */}
        <div className="absolute inset-0 flex items-end px-0" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => {
            if (isWind) {
              const v = num(wind[i]);
              const g = num(gust[i]);
              return (
                <div key={i} className="relative flex-1 h-full">
                  {g != null && (
                    /* Gust cap, the same hairline the chart's WIND row draws
                       above each bar. */
                    <div
                      className="absolute inset-x-[15%] h-px bg-rc-ink-mute/70"
                      style={{ bottom: pct(Math.min(1, g / windMax)) }}
                    />
                  )}
                  {v != null && (
                    <div
                      className="absolute inset-x-[15%] bottom-0 rounded-t-[1px] bg-[#818CF8]"
                      style={{ height: pct(Math.min(1, v / windMax)) }}
                    />
                  )}
                </div>
              );
            }
            const v = current ? num(current[i]) : null;
            const f = v == null ? 0 : Math.max(-1, Math.min(1, v / curMax));
            return (
              <div key={i} className="relative flex-1 h-full">
                {v != null && (
                  /* Signed around the midline: flood grows up, ebb grows down,
                     the sign convention the chart's CURRENT row plots. Columns
                     butt together (no inset) so the day reads as one stepped
                     flood/ebb shape — the wind row is a bar chart because wind
                     hours are independent readings, and a tide cycle is not. */
                  <div
                    className="absolute inset-x-0 bg-rc-ink/70"
                    style={
                      f >= 0
                        ? { bottom: "50%", height: `max(1px, ${pct(f * 0.5)})` }
                        : { top: "50%", height: `max(1px, ${pct(-f * 0.5)})` }
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
        {!isWind && (
          <div className="absolute inset-x-0 top-1/2 h-px bg-rc-rule" aria-hidden />
        )}

        {/* Hours the chart has no score for are outside the scrub, so they are
            dimmed rather than left looking pickable. */}
        {loH > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-rc-surface/70"
            style={{ width: pct(loH / 24) }}
            aria-hidden
          />
        )}
        {hiH < 23 && (
          <div
            className="absolute inset-y-0 right-0 bg-rc-surface/70"
            style={{ width: pct((23 - hiH) / 24) }}
            aria-hidden
          />
        )}

        {/* Live hour, so a scrubbed reader can see how far from now they are. */}
        {isToday && (
          <div
            className="absolute inset-y-0 w-px bg-rc-ink-mute/60"
            style={{ left: pct((nowHour + 0.5) / 24) }}
            aria-hidden
          />
        )}

        {/* Cursor. Brand, full height, with a grab handle at the foot — the
            same cobalt the chart's cursor line uses. */}
        <div
          className="absolute inset-y-0 w-[2px] bg-rc-brand -ml-px pointer-events-none"
          style={{ left: pct((hour + 0.5) / 24) }}
          aria-hidden
        >
          <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-rc-brand border-2 border-rc-panel" />
        </div>
      </div>
    </div>
  );
}
