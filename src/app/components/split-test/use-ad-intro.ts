'use client';

/**
 * Whether a cold ad visitor gets a few words of orientation on landing.
 *
 * Meta traffic under `?ad=day2` arrives on the live Explore map from an ad
 * with nothing in between: no landing page, no headline, no sentence that
 * says what the dots are. The first thing the visit does is either a tap on
 * a dot or a tap on Back. This test asks whether three lines of context on
 * arrival change what happens next.
 *
 * It is NOT an offer. There is no trial button, no Pro, no price. The
 * paywall flow (the two free spot opens, then the trial modal) is untouched
 * on both arms and this never restarts it. See ./ad-intro-card.
 *
 * Arm a is control: nothing shows, as today. Arm b shows the card once per
 * tab. Both arms count an exposure on the framed Explore, because the read
 * is downstream: walls seen and trials started per exposure, on the split
 * tests page. The `cta_click` counter is the card's "Got it" button, which
 * makes the click rate "read it and acknowledged it" rather than "tapped
 * past it".
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm nothing shows
 * and nothing is counted.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const AD_INTRO_TEST = 'ad_intro_v1';

/** Where the card is worn. One surface: the framed Explore map. */
const SURFACE = 'explore_map';

/**
 * One exposure per arm per page load, like the ad-bar edge counters. Module
 * scope so it dedupes across re-mounts of the same shell.
 */
const seen = new Set<string>();

export interface AdIntroTreatment {
  /** True on arm b: the card should show. False outside the test. */
  show: boolean;
  /** The arm on the cookie, for anything that wants to stamp it. */
  arm: string | null;
  /** Call when the card's button is pressed. No-op outside the test. */
  reportCta: () => void;
}

/**
 * @param active Whether this render is the ad frame on the wall that runs
 *               the test. Off it there is nothing to show and nothing counted.
 */
export function useAdIntro(active: boolean): AdIntroTreatment {
  const arms = useSplitArms();
  const arm = active ? (arms[AD_INTRO_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${AD_INTRO_TEST}:${arm}:${SURFACE}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(AD_INTRO_TEST, arm, SURFACE);
  }, [arm]);

  return {
    show: arm === 'b',
    arm,
    reportCta: () => {
      if (!arm) return;
      reportSplitArmCta(AD_INTRO_TEST, arm, SURFACE);
    },
  };
}
