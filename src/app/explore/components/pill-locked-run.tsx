"use client";

import { useRef } from "react";
import { Crown } from "lucide-react";
import type { ForecastDay } from "../lib/forecast-strip";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { btn } from "@/app/components/ui/button";
import {
  usePinnedToVisibleRun,
  useTrialButtonLabel,
} from "./locked-fortnight-overlay";

/**
 * Arm b of `fortnight_lock_overlay_v1` at pill scale: the locked tail of
 * Explore's phone date rail as blank tiles (day and date, nothing under) with
 * one panel pinned over the part of the run on screen.
 *
 * The pill is locked to the tab bar's 64px, so each tile is 52px tall and only
 * about 140px of the run shows beside Today and Tue. The spot page's
 * headline-under-the-dates panel does not fit there, so this one covers the
 * whole tile height: "See All 14 Days with Pro" over a full-width green crown
 * button. The dates under the panel are hidden; the ones that scroll out from
 * under it on either side still read.
 */

/** Narrower than this and the headline clips. */
const MIN_PANEL_PX = 128;

export default function PillLockedRun({
  days,
  placeName,
  from,
  onPress,
}: {
  /** The run from the first locked day to the end of the rail. */
  days: ForecastDay[];
  placeName?: string;
  /** Analytics origin for the trial modal. */
  from: string;
  onPress: () => void;
}) {
  const runRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const label = useTrialButtonLabel();
  usePinnedToVisibleRun(runRef, panelRef, MIN_PANEL_PX, days.length);

  if (days.length === 0) return null;

  return (
    <div
      ref={runRef}
      className="relative flex shrink-0 items-stretch gap-1"
      // The rail's grain: 52px tiles, 4px gaps.
      style={{ width: `${days.length * 52 + (days.length - 1) * 4}px` }}
    >
      {days.map((day) => (
        <div
          key={day.index}
          aria-hidden
          className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 rounded border border-rc-rule bg-rc-panel pt-1.5 text-rc-ink select-none"
        >
          <span className="rc-label text-[9px] leading-none">{day.dow}</span>
          <span className="font-rc-mono text-[10px] leading-none text-rc-ink-soft">
            {day.date}
          </span>
        </div>
      ))}

      <div ref={panelRef} className="absolute inset-y-0 left-0 w-full flex">
        <div className="w-full rounded border border-rc-rule bg-rc-brand-soft flex flex-col items-stretch justify-center gap-1 px-1">
          <span className="text-center text-[11px] min-[375px]:text-[12px] font-semibold leading-none tracking-[-0.01em] text-rc-ink whitespace-nowrap">
            See All 14 Days with Pro
          </span>
          <TrialModalButton
            from={from}
            placeName={placeName}
            onPress={onPress}
            data-testid="fortnight-lock-cta"
            className={`${btn.pillPro} gap-1`}
          >
            <Crown aria-hidden className="w-3 h-3" fill="currentColor" />
            {label}
          </TrialModalButton>
        </div>
      </div>
    </div>
  );
}
