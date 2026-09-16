'use client';

/**
 * The locked Recent reports card on the spot page.
 *
 * Arm a is control: today's lavender "Upgrade to Pro for the full report" row
 * under the cut-off headline. Arm b draws the shape of the Pro report (species
 * rows, bars, a "what worked" block) as grey placeholders, with the offer on a
 * card over the top and a solid button. The placeholders are drawn from
 * nothing: the report itself never reaches a free reader, on either arm, so
 * there is nothing to read behind them.
 *
 * WHERE. The spot page and the phone spot sheet, which share
 * SpotDetailShell, whenever a spot has a written report and the server has
 * said the reader may not have it. Not on the ad frame: there the one offer is
 * the form further down and the card stays neutral on both arms, so the test
 * never runs there and nothing is counted. Surface `spot_reports`.
 *
 * FLICKER. The arm arrives with /api/split-tests. The lock itself waits on a
 * report request, which is slower, so in practice arm b's card is the first
 * lock a reader sees. Exposure counts only once the arm is known and the lock
 * is on screen.
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and every reader gets today's card.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const LOCKED_REPORT_PREVIEW_TEST = 'locked_report_preview_v1';
const SURFACE = 'spot_reports';

/** Module scope, so it dedupes across every card instance on the page. */
const seen = new Set<string>();

export interface LockedReportPreview {
  /** Draw arm b's placeholder card. */
  preview: boolean;
  /** Call when the card is pressed. No-op outside the test. */
  reportPress: () => void;
}

/**
 * @param active  The lock is on screen and the test applies here (not the
 *                ad frame). Nothing is counted while false.
 */
export function useLockedReportPreview(active: boolean): LockedReportPreview {
  const arms = useSplitArms();
  const arm = active ? (arms[LOCKED_REPORT_PREVIEW_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${LOCKED_REPORT_PREVIEW_TEST}:${arm}:${SURFACE}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(LOCKED_REPORT_PREVIEW_TEST, arm, SURFACE);
  }, [arm]);

  return {
    preview: arm === 'b',
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(LOCKED_REPORT_PREVIEW_TEST, arm, SURFACE);
    },
  };
}
