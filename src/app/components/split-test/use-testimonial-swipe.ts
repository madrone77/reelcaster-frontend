'use client';

/**
 * One quote or a swipe through both, in the paywall modals.
 *
 * Arm a is today: one quote, Bob's with his five stars, or Nick's (no stars)
 * for a Washington reader. Arm b is a swipe row of both quotes, the reader's
 * own region's first, with no stars on either. The question is whether a
 * second real angler, and a local one, moves more readers to start a trial.
 *
 * WHERE. Every modal that renders `<Testimonial>`: the phone trial sheet, the
 * plan choice sheet, the Pro upsell after first sign-in, and the desktop plan
 * matrix. One arm per visitor across all of them. Surface: `testimonial`.
 *
 * No cta_click: the buy buttons belong to the sheets, not the quote. The
 * primary metric is paid conversion, which carries every arm the reader held.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule. With no arm assigned
 * (draft or concluded) nothing is counted and every modal renders arm a.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmExposure } from './report';

export const TESTIMONIAL_SWIPE_TEST = 'testimonial_swipe_v1';
const SURFACE = 'testimonial';

const seen = new Set<string>();

/** True when this reader should see the swipe row. */
export function useTestimonialSwipe(): boolean {
  const arms = useSplitArms();
  const arm = arms[TESTIMONIAL_SWIPE_TEST] ?? null;

  useEffect(() => {
    if (!arm) return;
    const key = `${TESTIMONIAL_SWIPE_TEST}:${arm}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(TESTIMONIAL_SWIPE_TEST, arm, SURFACE);
  }, [arm]);

  return arm === 'b';
}
