'use client';

/**
 * The second button in the ad hero: "Explore the map" beside "Try Pro free".
 *
 * Arm a is control: both buttons. Arm b drops the map button, so the hero's
 * one ask is the trial. The question is whether the map link is a way out
 * that costs trial presses, or a softer step that earns them later.
 *
 * WHERE. The ad hero (AdHero in [spot]/ad-intro.tsx) when it renders inside
 * an ad frame at the `today` wall: the spot ad page (surface `spot_ad_hero`)
 * and the city ad page (`city_ad_hero`). Not the public pages' SEO hero,
 * which mounts the same component with no frame to stay inside and is not
 * what an ad click lands on. Casey's ask (2026-09-18): "take 'explore the
 * map' off in a split test for ad=today".
 *
 * COUNTS. Exposure = the hero rendered with an arm. cta_click = the trial
 * button pressed. Map presses are not a CTA here: arm b has no map button,
 * so counting them would only ever score the control.
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and every reader gets both buttons.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const AD_HERO_MAP_TEST = 'ad_hero_map_button_v1';

export type AdHeroMapSurface = 'spot_ad_hero' | 'city_ad_hero';

/** Module scope, so it dedupes across every hero instance on the page. */
const seen = new Set<string>();

export interface AdHeroMapSplit {
  /** Arm b: render the trial button alone. */
  hideMap: boolean;
  /** Call when the trial button is pressed. No-op outside the test. */
  reportTrialPress: () => void;
}

/**
 * @param surface  Which ad hero this is, or null when the test does not apply
 *                 (no frame, or a wall other than `today`). Nothing is counted
 *                 while null.
 */
export function useAdHeroMapSplit(surface: AdHeroMapSurface | null): AdHeroMapSplit {
  const arms = useSplitArms();
  const arm = surface ? (arms[AD_HERO_MAP_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm || !surface) return;
    const key = `${AD_HERO_MAP_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(AD_HERO_MAP_TEST, arm, surface);
  }, [arm, surface]);

  return {
    hideMap: arm === 'b',
    reportTrialPress: () => {
      if (!arm || !surface) return;
      reportSplitArmCta(AD_HERO_MAP_TEST, arm, surface);
    },
  };
}
