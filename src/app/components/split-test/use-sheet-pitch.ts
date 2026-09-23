'use client';

/**
 * sheet_pitch_v1: the one phone sheet against the desktop dialog's left
 * column, drawn for the phone (../paywall/trial-sheet-pitch).
 *
 * a  the sheet as it stands (control): Stripe's header and offer block, the
 *    day-tile plan cards, five rows, and a pinned footer holding the
 *    three-step timeline, the email field and the button.
 * b  the pitch sheet: the brand row with the city, the fortnight headline
 *    naming the spot, the Free/Pro line, three ticked rows each with a
 *    sentence under it, the plain cards, the vertical timeline, then the
 *    email field and the button.
 *
 * The question is whether an argument made in prose — a headline that names
 * the place, and a reason under every tick — sells the week better than the
 * list the sheet has always shown. It is the first time the two shapes of
 * this modal have been put against each other: the left column was written
 * for a reader with a plan matrix beside it, and this asks whether it holds
 * up as the whole screen.
 *
 * WHERE. The phone sheet only, surface `sheet_pitch`. A wall that hands in
 * its own href (the sheet sells nothing there) draws the control and counts
 * nothing. Exposure = either sheet rendered with an arm; cta_click = its buy
 * button pressed.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule.
 */

import { useEffect } from 'react';
import type { SplitArms } from '@/lib/split-tests';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const SHEET_PITCH_TEST = 'sheet_pitch_v1';
const SURFACE = 'sheet_pitch';

const seen = new Set<string>();

/** Whether this reader's phone sheet is the pitch sheet. */
export function sheetPitchOn(arms: SplitArms, active: boolean): boolean {
  return active && arms[SHEET_PITCH_TEST] === 'b';
}

/**
 * Counts the phone sheet for sheet_pitch_v1. Call it from whichever sheet is
 * drawn, inside the open dialog, so an exposure is a sheet on screen.
 *
 * @param active  The sheet sells here (no href handed in by the wall).
 */
export function useSheetPitch(active: boolean): {
  pitch: boolean;
  reportPress: () => void;
} {
  const arms = useSplitArms();
  const arm = active ? (arms[SHEET_PITCH_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${SHEET_PITCH_TEST}:${arm}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(SHEET_PITCH_TEST, arm, SURFACE);
  }, [arm]);

  return {
    pitch: arm === 'b',
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(SHEET_PITCH_TEST, arm, SURFACE);
    },
  };
}
