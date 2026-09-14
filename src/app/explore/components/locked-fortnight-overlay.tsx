"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { Crown } from "lucide-react";
import type { ForecastDay } from "@/app/explore/lib/forecast-strip";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { btn } from "@/app/components/ui/button";
import { useSplitArms } from "@/app/components/split-test/use-pricing";
import {
  TRIAL_CTA_LABEL_TEST,
  TRIAL_CTA_LABELS,
} from "@/app/components/split-test/use-trial-cta-label";

/**
 * Arm b of `fortnight_lock_overlay_v1`: the locked tail of a 14-day strip as
 * blank tiles under one panel. Drawn by the spot page's strip and by the
 * docked strip under the Explore map on desktop.
 *
 * Each locked day is a white tile with the same border, weekday and date as
 * the open days before it, and nothing below the date. No placeholder score,
 * no chip, no colour: the client is never sent a score past the horizon, so
 * anything drawn there would be invented, and an invented score under a lock
 * is the dark pattern the gauze test was pulled for.
 *
 * The panel covers the tiles below their dates and carries the only action,
 * the same trial button the top bar and the ad bar carry, with the same words
 * (it reads the visitor's `trial_cta_label_v1` arm, without counting an
 * exposure to that test here).
 *
 * The panel is pinned to the part of the run that is on screen. On a phone
 * the strip scrolls sideways; the panel's left and width are recomputed on
 * scroll and written straight to its style, not through React state, so a
 * touch scroll re-renders nothing (the shell around this is large).
 */

/** Below this the headline and button stop fitting; the panel holds this width. */
const MIN_PANEL_PX = 200;

/**
 * The trial button's words, matching the visitor's top bar and ad bar. Reads
 * the `trial_cta_label_v1` arm without counting an exposure to that test.
 */
export function useTrialButtonLabel(): string {
  const arms = useSplitArms();
  return arms[TRIAL_CTA_LABEL_TEST] === "b" ? TRIAL_CTA_LABELS.b : TRIAL_CTA_LABELS.a;
}

/**
 * Keeps `panel` over the part of `run` that its scrolling parent shows, never
 * narrower than `minPx`. Writes left and width straight to the panel's style
 * on scroll and resize, so a touch scroll re-renders nothing.
 */
export function usePinnedToVisibleRun(
  runRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  minPx: number,
  dep: unknown,
): void {
  useLayoutEffect(() => {
    const run = runRef.current;
    const panel = panelRef.current;
    const scroller = run?.parentElement;
    if (!run || !panel || !scroller) return;
    let raf = 0;
    const place = () => {
      raf = 0;
      const r = run.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      const minW = Math.min(r.width, minPx);
      let left = Math.max(0, s.left - r.left);
      let right = Math.min(r.width, s.right - r.left);
      if (right - left < minW) {
        if (left === 0) right = minW;
        else left = Math.max(0, right - minW);
      }
      panel.style.left = `${left}px`;
      panel.style.width = `${right - left}px`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    ro?.observe(scroller);
    ro?.observe(run);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", schedule);
      ro?.disconnect();
    };
  }, [runRef, panelRef, minPx, dep]);
}

export default function LockedFortnightOverlay({
  days,
  spotName,
  placeName,
  from,
  onPress,
  tileMinWidth = 54,
}: {
  /** The run from the first locked day to the end of the strip. */
  days: ForecastDay[];
  spotName?: string;
  /** The city under the Explore camera, for the trial sheet's headline. */
  placeName?: string;
  /**
   * The open days' minimum tile width, so the run keeps their grain. The spot
   * page's strip scrolls and floors tiles at 54px; the Explore strip never
   * scrolls and lets them shrink (0).
   */
  tileMinWidth?: number;
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
      className="relative h-full flex gap-1.5"
      // Same grain as the open days: flex-1 a tile, 6px gaps.
      style={{
        flex: days.length,
        minWidth: `${days.length * tileMinWidth + (days.length - 1) * 6}px`,
      }}
    >
      {days.map((day) => (
        <div
          key={day.index}
          aria-hidden
          className="flex-1 min-w-0 h-full rounded border border-rc-rule bg-rc-panel flex flex-col items-center py-2 select-none"
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="rc-label text-[9px] leading-none">{day.dow}</div>
            <div className="font-rc-mono text-[10px] text-rc-ink-soft">{day.date}</div>
          </div>
        </div>
      ))}

      <div
        ref={panelRef}
        className="absolute top-[36px] bottom-1 left-0 w-full flex items-stretch justify-center px-1"
      >
        {/* Phone: headline over button, in the few tiles on screen. Desktop:
            the whole run fits, so the panel spans it with the two side by side. */}
        <div className="w-full max-w-[26rem] lg:max-w-none rounded border border-rc-rule bg-rc-brand-soft shadow-sm flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-6 px-2 lg:px-6 text-center">
          <div className="text-[12px] sm:text-[13px] lg:text-[17px] font-semibold leading-[14px] sm:leading-4 lg:leading-tight text-rc-ink">
            See all 14 days with ReelCaster Pro
          </div>
          <TrialModalButton
            from={from}
            spotName={spotName}
            placeName={placeName}
            className={`${btn.navPro} gap-2`}
            onPress={onPress}
            data-testid="fortnight-lock-cta"
          >
            <Crown aria-hidden className="w-4 h-4" fill="currentColor" />
            {label}
          </TrialModalButton>
        </div>
      </div>
    </div>
  );
}
