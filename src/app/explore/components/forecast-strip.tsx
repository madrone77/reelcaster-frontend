"use client";

import { useState } from "react";
import { ChevronDown, CloudSun } from "lucide-react";
import type { ForecastStripModel, ForecastDay } from "../lib/forecast-strip";
import DayCell from "./day-cell";
import HourScrubber from "./hour-scrubber";
import UpgradeDialog from "./upgrade-dialog";

const CONFIDENCE_NOTE = "confidence fades past day 7 · ECMWF + GFS";

/**
 * Docked 14-day forecast strip (desktop) — a full-bleed instrument panel
 * pinned to the bottom edge (square, no card chrome), the map sitting above
 * it. Day cells pick the day (drives the map); tapping a day reveals the
 * hourly scrubber (progressive disclosure — collapsed to cells by default).
 */
export default function ForecastStrip({
  model,
  speciesName,
  selectedIso,
  loading,
  onSelectDay,
  scrub,
  hourlyAvailable,
  hourExpanded,
  onToggleHours,
  hidden,
  onHide,
  onShow,
}: {
  model: ForecastStripModel | null;
  speciesName: string | null;
  selectedIso: string;
  loading: boolean;
  onSelectDay: (day: ForecastDay) => void;
  /** Hour scrubber — present only when expanded. Null = cells only. */
  scrub?: {
    hours: (number | null)[];
    hour: number;
    onScrub: (h: number) => void;
  } | null;
  /** Whether hourly data exists (controls the show/hide-hours toggle). */
  hourlyAvailable?: boolean;
  hourExpanded?: boolean;
  /** Toggle the hourly scrubber open/closed. */
  onToggleHours?: () => void;
  /** Whole-strip hide/show. */
  hidden?: boolean;
  onHide?: () => void;
  onShow?: () => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      setUpgradeOpen(true);
      return;
    }
    onSelectDay(day);
  };

  // Hidden → a compact "Show" chip pinned bottom-left (aligned to the rail).
  if (hidden) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="hidden lg:flex fixed bottom-4 left-6 z-30 items-center gap-2 px-3 py-2 rounded bg-rc-panel/88 backdrop-blur-md border border-rc-rule shadow-rc-panel hover:border-rc-ink-mute transition-colors"
      >
        <CloudSun className="w-4 h-4 text-rc-ink-mute" />
        <span className="rc-label text-[9px]">14-Day Forecast</span>
        <span className="text-xs font-semibold text-rc-brand ml-1">Show</span>
      </button>
    );
  }

  return (
    <>
      <div className={`hidden lg:flex flex-col ${scrub ? "h-[184px]" : "h-[128px]"} fixed inset-x-0 bottom-0 z-30 bg-rc-panel/88 backdrop-blur-md border-t border-rc-rule shadow-rc-bar px-6 py-2.5`}>
        {/* Header — single compact row */}
        <div className="flex items-center justify-between gap-4 mb-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <CloudSun className="w-4 h-4 text-rc-ink-mute" />
              <span className="rc-label text-[9px] text-rc-ink">
                14-Day Forecast{speciesName ? ` · ${speciesName}` : ""}
              </span>
            </div>
            {model?.bestDay && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rc-good shrink-0" />
                <span className="font-rc-mono text-[11px] tracking-[0.02em] text-rc-ink truncate">
                  Best window {model.bestDay.dow} {model.bestDay.date}
                </span>
                {model.bestDay.peakLabel && (
                  <span className="font-rc-mono text-[11px] tracking-[0.02em] font-bold text-rc-ink shrink-0">
                    {model.bestDay.peakLabel}
                  </span>
                )}
              </div>
            )}
            {hourlyAvailable && onToggleHours && (
              <button
                type="button"
                onClick={onToggleHours}
                aria-label={hourExpanded ? "Hide hours" : "Show hours"}
                className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded border border-rc-rule text-[11px] font-medium text-rc-ink-soft hover:bg-rc-surface transition-colors"
              >
                {hourExpanded ? "Hide hours" : "Show hours"}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${hourExpanded ? "" : "rotate-180"}`}
                />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-rc-mono text-[10px] text-rc-ink-mute italic hidden xl:inline">
              {CONFIDENCE_NOTE}
            </span>
            {onHide && (
              <button
                type="button"
                onClick={onHide}
                className="text-xs font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors"
              >
                Hide
              </button>
            )}
          </div>
        </div>

        {/* Hour scrubber — progressive: shown only when a day is expanded */}
        {!loading && model && scrub && (
          <div className="mb-2.5 pb-2.5 border-b border-rc-rule-soft shrink-0">
            <HourScrubber
              hours={scrub.hours}
              hour={scrub.hour}
              onScrub={scrub.onScrub}
            />
          </div>
        )}

        {/* Cells */}
        {loading || !model ? (
          <div className="flex gap-1.5 flex-1 min-h-0">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded bg-rc-surface animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 flex-1 min-h-0">
            {model.days.map((day) => (
              <DayCell
                key={day.index}
                day={day}
                selected={day.iso === selectedIso}
                onSelect={() => handleDay(day)}
              />
            ))}
          </div>
        )}
      </div>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}

/**
 * Compact mobile variant — a horizontal day scroller docked under the top
 * bar. Same selection + lock semantics.
 */
export function MobileForecastStrip({
  model,
  selectedIso,
  onSelectDay,
}: {
  model: ForecastStripModel | null;
  selectedIso: string;
  onSelectDay: (day: ForecastDay) => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  if (!model) return null;

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      setUpgradeOpen(true);
      return;
    }
    onSelectDay(day);
  };

  return (
    <>
      <div className="lg:hidden fixed top-16 inset-x-2 z-20 flex gap-1.5 overflow-x-auto scrollbar-hide bg-rc-panel/95 backdrop-blur border border-rc-rule rounded-xl shadow-rc-bar p-1.5">
        {model.days.map((day) => (
          <div key={day.index} className="w-14 shrink-0">
            <DayCell
              day={day}
              selected={day.iso === selectedIso}
              onSelect={() => handleDay(day)}
            />
          </div>
        ))}
      </div>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
