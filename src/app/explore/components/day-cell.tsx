"use client";

import { Lock } from "lucide-react";
import type { Tier } from "../lib/explore-data";
import type { ForecastDay } from "../lib/forecast-strip";
import WeatherIcon from "../spot/components/weather-icon";

/**
 * Score-numeral colors for the big cell number. Uses tier tokens that clear
 * the large-text contrast floor on a white cell — fair drops to its -ink
 * variant (#D78711 fails 3:1 at 28px; #92400E passes).
 */
const TIER_NUMERAL: Record<Tier, string> = {
  prime: "text-rc-prime",
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

/**
 * Peak-time chip tinted to the day's own tier, so the chip color stays
 * coherent with the score above it (a green chip under a red score would
 * contradict state).
 */
const TIER_CHIP: Record<Tier, string> = {
  prime: "bg-rc-prime-bg text-rc-prime-ink",
  good: "bg-rc-good-soft text-rc-good-ink",
  fair: "bg-rc-fair-bg text-rc-fair-ink",
  poor: "bg-rc-poor-bg text-rc-poor-ink",
  none: "bg-rc-surface text-rc-ink-soft",
};

/**
 * One forecast-strip day cell per the reference: DOW · date (two lines) ·
 * large tier-colored score · tier-tinted peak-time chip. Selected = brand
 * fill; best day gets a gold "BEST" badge tab on the top edge; locked days
 * show a lock + "Upgrade to Pro" ("Sign up free" for signed-out visitors
 * on days the free plan unlocks).
 */
export default function DayCell({
  day,
  selected,
  onSelect,
  neutralLock = false,
}: {
  day: ForecastDay;
  selected: boolean;
  onSelect: () => void;
  /**
   * Drop the plan name from a locked tile, leaving the lock alone.
   *
   * Set on the ad frame of the spot page, where "Sign up free" would sit four
   * tiles wide directly above a form asking for a card. Two offers on one
   * screen is one too many, and the cheaper one wins by being cheaper rather
   * than by being what the visit was bought for. The tile still says there is
   * more here and still leads to the same place; it just stops naming a
   * second price.
   *
   * Everywhere else the plan name stays, because on the product a locked day
   * SHOULD say what unlocks it.
   */
  neutralLock?: boolean;
}) {
  // Non-retention day: the selected species can't be kept on this date, so a
  // score would mislead. Show the regulatory label instead (takes precedence
  // over the lock — there's no retention score to gate).
  if (day.nonRetention) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 h-full rounded border border-rc-rule bg-rc-surface flex flex-col items-center justify-center gap-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
      >
        <div className="rc-label text-[9px] leading-none text-center">{day.dow}</div>
        <div className="font-rc-mono text-[10px] text-rc-ink-soft">{day.date}</div>
        <div className="font-rc-mono text-[9px] text-rc-ink-soft text-center leading-tight px-0.5 my-1">
          Non-retention
        </div>
      </button>
    );
  }

  // Still resolving whether this day is ours to show (see ForecastDay.pending).
  // Keeps the date, drops the number: the strip's shape is already correct, so
  // nothing shifts when the answer lands — and we never draw a padlock we might
  // have to take back.
  if (day.pending) {
    return (
      <div
        aria-busy="true"
        className="flex-1 min-w-0 h-full rounded border border-rc-rule bg-rc-surface flex flex-col items-center justify-center gap-1 py-2"
      >
        <div className="rc-label text-[9px] leading-none text-center text-rc-ink-soft">
          {day.dow}
        </div>
        <div className="font-rc-mono text-[10px] text-rc-ink-soft">{day.date}</div>
        <div className="w-8 h-6 my-0.5 rounded bg-rc-panel animate-pulse" />
      </div>
    );
  }

  if (day.locked) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 h-full rounded border border-rc-rule bg-rc-surface flex flex-col items-center justify-center gap-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
      >
        <div className="rc-label text-[9px] leading-none text-center">{day.dow}</div>
        <div className="font-rc-mono text-[10px] text-rc-ink-soft">{day.date}</div>
        <Lock className="w-5 h-5 text-rc-ink-soft my-0.5" />
        <div className="font-rc-mono text-[9px] text-rc-ink-soft text-center leading-tight px-0.5">
          {neutralLock
            ? "Locked"
            : day.lockTier === "free"
              ? "Sign up free"
              : "Upgrade to Pro"}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex-1 min-w-0 h-full rounded border flex flex-col items-center justify-between py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand ${
        selected
          ? "border-rc-brand bg-rc-brand text-white"
          : "border-rc-rule bg-rc-panel hover:border-rc-brand hover:bg-rc-brand-soft/40"
      }`}
    >
      {day.isBest && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded font-rc-mono text-[8px] font-bold tracking-wide bg-rc-badge text-rc-ink leading-none">
          BEST
        </span>
      )}

      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`rc-label text-[9px] leading-none ${selected ? "text-white/70" : ""}`}
        >
          {day.dow}
        </div>
        <div
          className={`font-rc-mono text-[10px] ${selected ? "text-white/85" : "text-rc-ink-soft"}`}
        >
          {day.date}
        </div>
      </div>

      <div
        className={`text-[28px] font-bold leading-none tracking-[-0.04em] ${
          selected ? "text-white" : TIER_NUMERAL[day.tier]
        }`}
      >
        {day.score ?? "—"}
      </div>

      {/* Dominant daylight weather — a small icon between the score and the
          peak chip. Inherits the cell's text color (white when selected). */}
      <div className={`h-3.5 flex items-center ${selected ? "text-white" : "text-rc-ink-mute"}`}>
        <WeatherIcon condition={day.weather} size={14} />
      </div>

      <div
        className={`h-[18px] flex items-center font-rc-mono text-[9px] px-1.5 rounded ${
          !day.peakLabel
            ? "opacity-0"
            : selected
              ? "bg-white/20 text-white"
              : TIER_CHIP[day.tier]
        }`}
      >
        {day.peakLabel ?? "—"}
      </div>
    </button>
  );
}
