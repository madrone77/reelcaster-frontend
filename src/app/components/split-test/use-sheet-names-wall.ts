'use client';

/**
 * sheet_names_wall_v1: does the sheet sell better when it names what the
 * reader tapped?
 *
 * a  the sheet as it stands (control): brand row, "Try ReelCaster Pro /
 *    7 days free", cards, rows, timeline, email, button.
 * b  the same sheet with one line over the offer naming the thing the reader
 *    reached for: "See Friday, Sep 25 in Seattle", "Score your own spots in
 *    Seattle". Drawn in the headline slot the locked-pin walls already use.
 *
 * Why (loop 2, 2026-09-24): a sheet opened by tapping a LOCKED thing gets a
 * Start tap 7% of the time (iOS 6.6, Android 7.4, about half of all sheets),
 * against 24-29% when the reader asked by tapping Try Pro free. The locked
 * day tile's sheet never mentions the day.
 *
 * WHERE. The phone sheet only, surface `sheet_wall`, and only for a wall that
 * names what was tapped (`tapped` on ProTrialModal) and sets no headline of
 * its own. Every other sheet draws as today and counts nothing.
 * Exposure = an eligible sheet open with an arm; cta_click = its Start tap.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const SHEET_NAMES_WALL_TEST = 'sheet_names_wall_v1';
const SURFACE = 'sheet_wall';

const seen = new Set<string>();

/**
 * @param active  An eligible sheet is open: phone shape, sells here (no href),
 *                the wall named what was tapped and set no headline itself.
 */
export function useSheetNamesWall(active: boolean): {
  named: boolean;
  reportPress: () => void;
} {
  const arms = useSplitArms();
  const arm = active ? (arms[SHEET_NAMES_WALL_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${SHEET_NAMES_WALL_TEST}:${arm}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(SHEET_NAMES_WALL_TEST, arm, SURFACE);
  }, [arm]);

  return {
    named: arm === 'b',
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(SHEET_NAMES_WALL_TEST, arm, SURFACE);
    },
  };
}
