"use client";

import { useState } from "react";
import { CloudSun } from "lucide-react";
import type {
  ForecastStripModel,
  ForecastDay,
  LockTier,
} from "../lib/forecast-strip";
import DayCell from "./day-cell";
import DayScrubCell from "./day-scrub-cell";
import UpgradeDialog from "./upgrade-dialog";

const CONFIDENCE_NOTE = "Data from: ECMWF + GFS + BlueCaster";

/**
 * Docked 14-day forecast strip (desktop) — a full-bleed instrument panel
 * pinned to the bottom edge (square, no card chrome), the map sitting above
 * it. Day cells pick the day (drives the map); every cell shows the day's
 * peak score. Per-hour exploration lives on the spot drawer's 24h chart.
 */
export default function ForecastStrip({
  model,
  speciesName,
  selectedIso,
  loading,
  onSelectDay,
  selectedDayHours,
  scrubHour,
  onScrubHour,
  signedIn,
  hidden,
  onHide,
  onShow,
  onLockedAdDay,
}: {
  model: ForecastStripModel | null;
  speciesName: string | null;
  selectedIso: string;
  loading: boolean;
  onSelectDay: (day: ForecastDay) => void;
  /** Regional best score per hour for the selected day (length 24) — the
   *  selected cell expands into a scrub lane over these. */
  selectedDayHours: (number | null)[];
  /** 0–23 scrubbed hour, or null = day peak (no scrub yet). */
  scrubHour: number | null;
  onScrubHour: (h: number) => void;
  /** Signed-out visitors get the sign-up dialog on locked days instead of pricing. */
  signedIn: boolean;
  /**
   * The ad frame's handler for a locked day: focus the one offer already on
   * the page instead of opening a dialog.
   *
   * Set only on `/explore?ad=…`. A modal there would be a SECOND way to buy,
   * attributed to a different `from` than the bar under the map, which is
   * exactly the comparison a wall test is trying to make. It also drops the
   * plan name from the tiles, because "Sign up free" beside a form asking for
   * a card is a cheaper offer winning by being cheaper.
   */
  onLockedAdDay?: () => void;
  /** Whole-strip hide/show. */
  hidden?: boolean;
  onHide?: () => void;
  onShow?: () => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Which plan the tapped day needs. A "Sign up free" day (3-7) sells the
  // account; an "Upgrade to Pro" day (8-14) sells Pro even to a signed-out
  // visitor, who would otherwise get a sign-up form after a Pro promise.
  const [lockTier, setLockTier] = useState<LockTier>("pro");
  const hasHours = selectedDayHours.some((v) => typeof v === "number");

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      if (onLockedAdDay) {
        onLockedAdDay();
        return;
      }
      setLockTier(day.lockTier ?? "pro");
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
        /* Clears whatever is pinned to the bottom of the viewport. That is
           nothing on the product, where the variable is 0 on desktop, and the
           ad frame's bar when one is on screen. */
        style={{ bottom: "calc(1rem + var(--rc-tabbar-clearance))" }}
        className="hidden lg:flex fixed left-6 z-30 items-center gap-2 px-3 py-2 rounded bg-rc-panel/88 backdrop-blur-md border border-rc-rule shadow-rc-panel hover:border-rc-ink-mute transition-colors"
      >
        <CloudSun className="w-4 h-4 text-rc-ink-mute" />
        <span className="rc-label text-[9px]">14-Day Forecast</span>
        <span className="text-xs font-semibold text-rc-brand ml-1">Show</span>
      </button>
    );
  }

  return (
    <>
      {/* Pinned to the viewport, so it needs the same bottom clearance every
          other pinned thing takes: 0 on desktop normally, the ad frame's bar
          when there is one. Without it the strip's day cells render underneath
          that bar. */}
      <div
        style={{ bottom: "var(--rc-tabbar-clearance)" }}
        className="hidden lg:flex flex-col h-[128px] fixed inset-x-0 z-30 bg-rc-panel/88 backdrop-blur-md border-t border-rc-rule shadow-rc-bar px-6 py-2.5"
      >
      {/* Content column, capped and centred. The bar itself still spans the
          window — it is the instrument's ground — but its CONTENTS stop
          growing.

          The cells are flex-1 against the scrub cell's flex-[5] with no
          ceiling, so on a wide display they simply kept stretching: at 2200px
          each day became a 116px box holding a 28px numeral and the scrub lane
          reached 571px, and at 2560px 135px and 666px. Eight mostly-empty
          boxes stretched across a third of the screen read as padding rather
          than as an instrument. Capping the column keeps the density the thing
          was designed at, and capping BOTH rows together (rather than the cells
          alone) keeps "Hide" and the attribution over the ends of the row they
          label. Below 1600px nothing changes. */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col min-h-0">
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
            {model.days.map((day) => {
              const isSel = day.iso === selectedIso;
              // The selected, unlocked day expands into the 24h scrub lane;
              // every other day stays a compact peak cell (flex ratios let the
              // row compress the rest automatically).
              if (isSel && !day.locked && hasHours) {
                return (
                  <DayScrubCell
                    key={day.index}
                    day={day}
                    hours={selectedDayHours}
                    scrubHour={scrubHour}
                    onScrubHour={onScrubHour}
                  />
                );
              }
              return (
                <DayCell
                  neutralLock={!!onLockedAdDay}
                  key={day.index}
                  day={day}
                  selected={isSel}
                  onSelect={() => handleDay(day)}
                />
              );
            })}
          </div>
        )}
      </div>
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!signedIn && lockTier === "free" ? "signup" : "pro"}
      />
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
  signedIn,
  onLockedAdDay,
}: {
  model: ForecastStripModel | null;
  selectedIso: string;
  onSelectDay: (day: ForecastDay) => void;
  /** Signed-out visitors get the sign-up dialog on locked days instead of pricing. */
  signedIn: boolean;
  /**
   * The ad frame's handler for a locked day: focus the one offer already on
   * the page instead of opening a dialog.
   *
   * Set only on `/explore?ad=…`. A modal there would be a SECOND way to buy,
   * attributed to a different `from` than the bar under the map, which is
   * exactly the comparison a wall test is trying to make. It also drops the
   * plan name from the tiles, because "Sign up free" beside a form asking for
   * a card is a cheaper offer winning by being cheaper.
   */
  onLockedAdDay?: () => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Which plan the tapped day needs. A "Sign up free" day (3-7) sells the
  // account; an "Upgrade to Pro" day (8-14) sells Pro even to a signed-out
  // visitor, who would otherwise get a sign-up form after a Pro promise.
  const [lockTier, setLockTier] = useState<LockTier>("pro");
  if (!model) return null;

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      if (onLockedAdDay) {
        onLockedAdDay();
        return;
      }
      setLockTier(day.lockTier ?? "pro");
      setUpgradeOpen(true);
      return;
    }
    onSelectDay(day);
  };

  return (
    <>
      <div className="lg:hidden fixed top-16 inset-x-2 z-20 flex gap-1.5 overflow-x-auto scrollbar-hide bg-rc-panel/95 backdrop-blur border border-rc-rule rounded-xl shadow-rc-bar px-1.5 pb-1.5 pt-3">
        {model.days.map((day) => (
          <div key={day.index} className="w-14 shrink-0">
            <DayCell
              neutralLock={!!onLockedAdDay}
              day={day}
              selected={day.iso === selectedIso}
              onSelect={() => handleDay(day)}
            />
          </div>
        ))}
      </div>
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!signedIn && lockTier === "free" ? "signup" : "pro"}
      />
    </>
  );
}
