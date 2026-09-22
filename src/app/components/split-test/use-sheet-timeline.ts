'use client';

/**
 * sheet_timeline_v1: the phone trial sheet as it is, against the sheet
 * redrawn around a trial timeline (./../paywall/trial-sheet-timeline).
 *
 * a  the live sheet (control): Stripe's header and offer block, the plan
 *    cards, the rows, the button with the charge line under it.
 * b  a blue Pro banner, a headline naming the place, the cards and the rows
 *    scrolling under a pinned footer that holds a three-step timeline
 *    (today, the reminder email, the first charge), the email field and the
 *    button. Casey's design, 2026-09-22.
 *
 * WHERE. The phone sheet only, surface `sheet_timeline`. A wall that hands in
 * its own href (the sheet sells nothing there) draws the control and counts
 * nothing. Exposure = either sheet rendered with an arm; cta_click = its buy
 * button pressed.
 *
 * ALONGSIDE plan_picker_v3. Arm b draws the plain cards and never calls
 * usePlanPicker, so a reader in b adds nothing to v3's counters; v3 reads on
 * arm a's readers alone. With no arm the phone draws the control.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule.
 */

import { useEffect } from 'react';
import type { SplitArms } from '@/lib/split-tests';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const SHEET_TIMELINE_TEST = 'sheet_timeline_v1';
const SURFACE = 'sheet_timeline';

const seen = new Set<string>();

/** Whether this reader's phone sheet is the timeline sheet. */
export function sheetTimelineOn(arms: SplitArms, active: boolean): boolean {
  return active && arms[SHEET_TIMELINE_TEST] === 'b';
}

/**
 * Counts the phone sheet for sheet_timeline_v1. Call it from whichever sheet
 * is drawn, inside the open dialog, so an exposure is a sheet on screen.
 *
 * @param active  The sheet sells here (no href handed in by the wall).
 */
export function useSheetTimeline(active: boolean): {
  timeline: boolean;
  reportPress: () => void;
} {
  const arms = useSplitArms();
  const arm = active ? (arms[SHEET_TIMELINE_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${SHEET_TIMELINE_TEST}:${arm}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(SHEET_TIMELINE_TEST, arm, SURFACE);
  }, [arm]);

  return {
    timeline: arm === 'b',
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(SHEET_TIMELINE_TEST, arm, SURFACE);
    },
  };
}
