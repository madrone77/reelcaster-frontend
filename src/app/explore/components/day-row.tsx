"use client";

import { ChevronDown, Lock } from "lucide-react";
import type { Tier } from "../lib/explore-data";
import type { ForecastDay } from "../lib/forecast-strip";

// Right-aligned score numeral, tier-colored (fair drops to its -ink variant to
// clear contrast). Matches the spot-card score language.
const NUMERAL: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

const CHIP: Record<Tier, string> = {
  good: "bg-rc-good-soft text-rc-good-ink",
  fair: "bg-rc-fair-bg text-rc-fair-ink",
  poor: "bg-rc-poor-bg text-rc-poor-ink",
  none: "bg-rc-surface text-rc-ink-soft",
};

/**
 * One day of the 14-day forecast as a full-width ledger ROW (mobile) — dow/date
 * left, peak-time chip, right-aligned tier-colored peak score, expand chevron.
 * Shares the spot-card visual language so the "All spots ⇄ 14-day" toggle moves
 * between two lists that read the same. Selecting a row expands it (in the
 * parent) into the 24h scrub lane.
 */
export default function DayRow({
  day,
  selected,
  onSelect,
  neutralLock = false,
}: {
  day: ForecastDay;
  selected: boolean;
  onSelect: () => void;
  /** Drop the plan name from a locked row. Set on the ad frame, where naming
   *  a cheaper plan beside a form asking for a card is a second offer. */
  neutralLock?: boolean;
}) {
  if (day.locked) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <div className="w-12 shrink-0">
          <div className="rc-label text-[9px] leading-none">{day.dow}</div>
          <div className="mt-0.5 font-rc-mono text-[11px] text-rc-ink-soft">
            {day.date}
          </div>
        </div>
        <Lock className="h-3.5 w-3.5 shrink-0 text-rc-ink-mute" />
        <span className="text-[13px] text-rc-ink-mute">
          {neutralLock
            ? "Locked"
            : day.lockTier === "free"
              ? "Sign up free"
              : "Upgrade to Pro"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={`flex w-full items-center gap-3 py-3 text-left transition-colors ${
        selected ? "" : "hover:bg-rc-surface/50"
      }`}
    >
      <div className="w-12 shrink-0">
        <div className="flex items-center gap-1">
          <span className="rc-label text-[9px] leading-none">{day.dow}</span>
          {day.isBest && (
            <span className="rounded bg-rc-badge px-1 py-0.5 font-rc-mono text-[7px] font-bold leading-none tracking-wide text-rc-ink">
              BEST
            </span>
          )}
        </div>
        <div className="mt-0.5 font-rc-mono text-[11px] text-rc-ink-soft">
          {day.date}
        </div>
      </div>

      {day.peakLabel && (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 font-rc-mono text-[10px] ${CHIP[day.tier]}`}
        >
          {day.peakLabel}
        </span>
      )}

      <span
        className={`ml-auto font-rc-mono text-[24px] font-bold leading-none tabular-nums tracking-[-0.03em] ${NUMERAL[day.tier]}`}
      >
        {day.score ?? "—"}
      </span>
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-rc-ink-mute transition-transform ${
          selected ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}
