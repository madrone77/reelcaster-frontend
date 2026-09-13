'use client';

/**
 * The words on the top bar's signed-out trial button.
 *
 * Arm a is control: "Start free trial", exactly as today. Arm b reads "Try Pro
 * free". Nothing else changes on either arm: same button, same width, same
 * trial modal behind it. The question is only whether naming the plan gets
 * more presses than naming the trial.
 *
 * WHERE. Every page that mounts ExploreTopBar signed out, which is Explore and
 * the spot page above all, in both the product bar and the ad frame's bar. One
 * label per visitor across all of them: a reader who saw "Try Pro free" on the
 * map and "Start free trial" on the spot they opened would be in neither arm.
 * The two bars report as separate surfaces (`topbar`, `ad_topbar`) so paid and
 * organic rates are never pooled by accident.
 *
 * FLICKER. The arm arrives with /api/split-tests, so arm b paints the control
 * label for one round trip and then swaps. Same trade use-pricing.ts makes for
 * the price, for the same reason: these pages stay cacheable. The exposure is
 * counted only once the arm is known, so the control label that arm b flashed
 * is never counted as an exposure to arm a.
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and every bar reads "Start free trial".
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const TRIAL_CTA_LABEL_TEST = 'trial_cta_label_v1';

export const TRIAL_CTA_LABELS = {
  a: 'Start free trial',
  b: 'Try Pro free',
} as const;

/** Module scope, so it dedupes across every bar instance on the page. */
const seen = new Set<string>();

export interface TrialCtaLabel {
  label: string;
  /** Call when the button is pressed. No-op outside the test. */
  reportPress: () => void;
}

/**
 * @param surface `topbar` or `ad_topbar`. Lower case, no spaces, the event
 *                route's shape.
 */
export function useTrialCtaLabel(surface: string): TrialCtaLabel {
  const arms = useSplitArms();
  const arm = arms[TRIAL_CTA_LABEL_TEST] ?? null;

  useEffect(() => {
    if (!arm) return;
    const key = `${TRIAL_CTA_LABEL_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(TRIAL_CTA_LABEL_TEST, arm, surface);
  }, [arm, surface]);

  return {
    label: arm === 'b' ? TRIAL_CTA_LABELS.b : TRIAL_CTA_LABELS.a,
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(TRIAL_CTA_LABEL_TEST, arm, surface);
    },
  };
}
