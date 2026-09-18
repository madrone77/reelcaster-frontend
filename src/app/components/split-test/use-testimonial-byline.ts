'use client';

/**
 * One quote, or the row of three review cards, in the paywall modals.
 *
 * Arm a is the single quote as it stood after testimonial_swipe_v1: the Pro
 * label, five small gold stars, the words, the name in mono. Bob's, or
 * Nick's for a Washington reader. Arm b is three cards in a sideways row,
 * each opening with the angler (a circle of initials beside the name, the
 * place under it), Trustpilot-style green tiles with the score, then the
 * words. Casey chose to test the whole change on one arm rather than stack
 * two tests (2026-09-18): "we are testing too much too quick".
 *
 * WHERE. Every modal that renders `<Testimonial>`: the phone trial sheet, the
 * plan choice sheet, the Pro upsell after first sign-in, and the desktop plan
 * matrix. One arm per visitor across all of them. Surface: `testimonial`.
 * The row under the chart on ad and landing pages is NOT in the test; it
 * shows arm b's card shape to everyone.
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

/** True when this reader should see the row of three review cards. */
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
