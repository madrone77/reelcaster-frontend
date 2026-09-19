'use client';

/**
 * Locked spots on the ad-framed Explore map: `explore_locked_spots_v1`.
 *
 * Arm a is control: every pin shows today's score, as the map does now. Arm b
 * locks a stable half of the pins (see explore/lib/spot-locks.ts); a tap on a
 * lock opens the Pro wall. The question is whether visibly withheld scores
 * earn more trials from paid traffic than a fully open map.
 *
 * WHERE. The ad-framed /explore (`?ad=`) and the city ad page's chart of every
 * mark, for a viewer with no account.
 * The public /explore and every signed-in viewer never enter the test, so
 * only traffic we paid for is ever assigned. Casey's ask (2026-09-19): "ship
 * as a split test only on traffic from meta and google".
 *
 * COUNTS. Exposure = the framed map rendered with an arm. cta_click = a lock
 * pressed (arm b only, by construction; the control has nothing to press, so
 * the rate that matters is trials per exposure on the Split tests page, not
 * CTR).
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and every pin shows its score.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';
import { LOCKED_SPOTS_TEST } from '@/app/explore/lib/spot-locks';

/** Which framed map: Explore itself, or the city ad page's chart. */
export type LockedSpotsSurface = 'explore_map' | 'city_map';

/** Module scope, so a remount of the shell does not count a second exposure. */
const seen = new Set<string>();

export interface LockedSpotsSplit {
  /** Arm b: lock the pins. */
  locksOn: boolean;
  /** Call when a lock is pressed. No-op outside the test. */
  reportLockPress: () => void;
}

/**
 * @param surface   Which map, or null when the test does not apply here:
 *                  outside the ad frame, or a signed-in viewer. Nothing is
 *                  counted, and nothing locks, while null.
 */
export function useLockedSpotsSplit(surface: LockedSpotsSurface | null): LockedSpotsSplit {
  const arms = useSplitArms();
  const arm = surface ? (arms[LOCKED_SPOTS_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm || !surface) return;
    const key = `${LOCKED_SPOTS_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(LOCKED_SPOTS_TEST, arm, surface);
  }, [arm, surface]);

  return {
    locksOn: arm === 'b',
    reportLockPress: () => {
      if (!arm || !surface) return;
      reportSplitArmCta(LOCKED_SPOTS_TEST, arm, surface);
    },
  };
}
