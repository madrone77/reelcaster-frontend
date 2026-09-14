'use client';

/**
 * How a signed-out visitor meets the locked tail of a 14-day strip: the spot
 * page's, and the docked one under the Explore map on desktop.
 *
 * Arm a is control: every locked day is its own grey padlock tile, and tapping
 * one opens the Pro sheet. Arm b draws the locked days as blank white tiles in
 * the same shape as the open days before them (weekday and date, nothing
 * where the score goes) with ONE panel over the run: "See all 14 days with
 * ReelCaster Pro" and the same trial button the bar carries. See
 * LockedFortnightOverlay.
 *
 * WHO. Signed-out visitors only, on the spot page, the ad frame of the spot
 * page, the spot sheet on Explore, Explore's desktop strip, and Explore's
 * phone date pill, the last two with and without the ad frame. A signed-in
 * free account keeps its padlocks on both arms. Each surface reports
 * separately (`spot_strip`, `ad_spot_strip`, `sheet_spot_strip`,
 * `explore_strip`, `ad_explore_strip`, `explore_pill`, `ad_explore_pill`) so
 * paid and organic are never pooled by accident. The pill's arm b is its own
 * layout (PillLockedRun): the 64px pill has no room for the strip's panel.
 *
 * WHAT COUNTS. Exposure = the strip rendered with a locked day to a signed-out
 * visitor whose arm is known. cta_click = arm a tapping a padlock tile, arm b
 * pressing the panel's button. The button is bigger than a tile, so arm b is
 * expected to win on presses by construction. That is not the read: the
 * test is judged on trials started and trial-to-paid per exposure, which
 * `marketing_conversions.split_tests` carries from the cookie.
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and every visitor gets the padlocks.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const FORTNIGHT_LOCK_TEST = 'fortnight_lock_overlay_v1';

export type FortnightLockSurface =
  | 'spot_strip'
  | 'ad_spot_strip'
  | 'sheet_spot_strip'
  | 'explore_strip'
  | 'ad_explore_strip'
  | 'explore_pill'
  | 'ad_explore_pill';

/** Module scope, so it dedupes across remounts within one page load. */
const seen = new Set<string>();

export interface FortnightLock {
  /** Draw the blank tiles and the panel instead of padlocks. */
  overlay: boolean;
  /** Call when a locked tile (arm a) or the panel button (arm b) is pressed. */
  reportPress: () => void;
}

/**
 * @param eligible Signed out, tier settled, and at least one locked day in the
 *                 strip. Anything else is not an exposure to either arm, and
 *                 draws the padlocks.
 */
export function useFortnightLock(
  surface: FortnightLockSurface,
  eligible: boolean,
): FortnightLock {
  const arms = useSplitArms();
  const arm = arms[FORTNIGHT_LOCK_TEST] ?? null;

  useEffect(() => {
    if (!arm || !eligible) return;
    const key = `${FORTNIGHT_LOCK_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(FORTNIGHT_LOCK_TEST, arm, surface);
  }, [arm, eligible, surface]);

  return {
    overlay: eligible && arm === 'b',
    reportPress: () => {
      if (!arm || !eligible) return;
      reportSplitArmCta(FORTNIGHT_LOCK_TEST, arm, surface);
    },
  };
}
