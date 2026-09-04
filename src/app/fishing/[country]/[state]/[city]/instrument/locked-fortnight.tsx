"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { ForecastDay } from "@/app/explore/lib/forecast-strip";

/**
 * The locked tail of the city page's 14-day strip, drawn as ONE ask instead
 * of twelve.
 *
 * Twelve grey padlock tiles each say "Upgrade to Pro" in 9px mono, which
 * nobody reads. This draws the same run of days as ghost tiles, the shape of
 * an open day (weekday, date, score numeral, peak-hour chip), with the
 * numeral and the chip blurred and grey, and one plain-type panel over the
 * run that names the city and the plan.
 *
 * ⚠ The numbers under the blur are PLACEHOLDERS. The client is never sent a
 * score past the reader's horizon (the payload nulls them), so there is
 * nothing true to draw. They are grey and blurred so they cannot be read as
 * a score, and the sequence is fixed so nothing about it is a claim. The
 * weekday and date are real. Do not tint the numeral or the chip: a colour
 * under a lock says the day is good, which is the dark pattern the gauze
 * test was pulled for. See DayCell for the treatment everywhere else.
 *
 * The panel's text is `sticky`, so on a phone, where the strip scrolls, it
 * stays in the visible part of the run instead of sitting off the right edge.
 * Its width is the part of the run that is on screen at scroll 0 (the
 * scroller's visible width minus the open days before the run), so the text
 * is centred in what the reader can see, and it keeps that width as the
 * strip scrolls under it. On desktop the whole run fits and that is the run.
 */

const GHOST_SCORES = [72, 64, 81, 58, 69, 77, 61, 74, 66, 79, 63, 70];
const GHOST_PEAKS = [
  "7 AM",
  "6 AM",
  "8 AM",
  "5 PM",
  "7 AM",
  "6 PM",
  "9 AM",
  "7 AM",
  "6 AM",
  "8 AM",
  "5 PM",
  "7 AM",
];

export default function LockedFortnight({
  days,
  cityName,
  onSelect,
}: {
  /** The contiguous locked run at the end of the strip. */
  days: ForecastDay[];
  cityName: string;
  onSelect: () => void;
}) {
  const runRef = useRef<HTMLButtonElement | null>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const run = runRef.current;
    const scroller = run?.parentElement;
    if (!run || !scroller) return;
    const measure = () => {
      const visible = scroller.clientWidth - run.offsetLeft;
      setPanelWidth(Math.max(160, Math.min(run.clientWidth, visible)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    ro.observe(run);
    return () => ro.disconnect();
  }, [days.length]);

  if (days.length === 0) return null;
  // What the cheapest locked day costs. On an anonymous read days 3–7 are a
  // free account's; the panel asks for Pro (which covers all of them) and
  // says the free path in one small line under it.
  const freeDaysFirst = days[0].lockTier === "free";

  return (
    <button
      ref={runRef}
      type="button"
      onClick={onSelect}
      aria-label={`Upgrade to Pro to get the full 14-day fishing forecast for ${cityName}`}
      className="relative h-full flex gap-1.5 rounded border border-rc-rule bg-rc-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
      style={{ flex: days.length, minWidth: `${days.length * 54 + (days.length - 1) * 6}px` }}
    >
      {days.map((day, i) => (
        <div
          key={day.index}
          aria-hidden
          className="flex-1 min-w-0 h-full flex flex-col items-center justify-between py-2 select-none"
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="rc-label text-[9px] leading-none text-rc-ink-soft">
              {day.dow}
            </div>
            <div className="font-rc-mono text-[10px] text-rc-ink-soft">
              {day.date}
            </div>
          </div>
          <div className="text-[28px] font-bold leading-none tracking-[-0.04em] text-rc-ink-mute blur-[3px]">
            {GHOST_SCORES[i % GHOST_SCORES.length]}
          </div>
          <div className="h-3.5" />
          <div className="h-[18px] flex items-center font-rc-mono text-[9px] px-1.5 rounded bg-rc-rule text-rc-ink-soft blur-[3px]">
            {GHOST_PEAKS[i % GHOST_PEAKS.length]}
          </div>
        </div>
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex"
      >
        <div
          className="sticky left-0 h-full flex items-center justify-center px-3"
          style={{ width: panelWidth === null ? "100%" : `${panelWidth}px` }}
        >
          {/* A light wash so the words read over the ghost numerals without
              hiding them. */}
          <div className="flex flex-col items-center gap-0.5 sm:gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded bg-rc-panel/70 text-center max-w-[26rem]">
            {/* The lock drops on a phone: the panel there is ~170px wide and
                the copy wraps to four lines, which is the strip's height. */}
            <Lock className="hidden sm:block w-4 h-4 text-rc-ink-soft" />
            <div className="text-[13px] sm:text-[16px] font-semibold leading-tight sm:leading-snug text-rc-ink">
              Upgrade to Pro to get the full 14-day fishing forecast for {cityName}
            </div>
            {freeDaysFirst && (
              <div className="font-rc-mono text-[9px] sm:text-[10px] text-rc-ink-soft">
                or see 7 days with a free account
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
