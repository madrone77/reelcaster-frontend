'use client';

/**
 * The paywall modals' testimonial cards: today's shape, or the review-widget
 * shape the row under the chart already wears.
 *
 * Arm a is today: five small gold stars, the quote, the name in mono at the
 * foot. Arm b leads with the angler, a circle of initials beside the name
 * and the place under it, then Trustpilot-style green tiles with the score,
 * then the quote. The question is whether a card that reads as a review
 * rather than a pull quote moves more readers to start a trial.
 *
 * WHERE. Every modal that renders `<Testimonial>`: the phone trial sheet, the
 * plan choice sheet, the Pro upsell after first sign-in, and the desktop plan
 * matrix. One arm per visitor across all of them. Surface: `testimonial`.
 * The row under the chart on ad and landing pages is NOT in the test; it
 * shows arm b's shape to everyone.
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

export const TESTIMONIAL_BYLINE_TEST = 'testimonial_byline_v1';
const SURFACE = 'testimonial';

const seen = new Set<string>();

/** True when this reader should see the byline-and-tiles cards. */
export function useTestimonialByline(): boolean {
  const arms = useSplitArms();
  const arm = arms[TESTIMONIAL_BYLINE_TEST] ?? null;

  useEffect(() => {
    if (!arm) return;
    const key = `${TESTIMONIAL_BYLINE_TEST}:${arm}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(TESTIMONIAL_BYLINE_TEST, arm, SURFACE);
  }, [arm]);

  return arm === 'b';
}
