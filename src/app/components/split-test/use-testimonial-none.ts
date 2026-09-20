'use client';

/**
 * The quote in the paywall modals, or no quote at all.
 *
 * Arm a is today's single testimonial: the Pro label, five small gold stars,
 * the words, the name in mono. Bob's, or Nick's for a Washington reader. Arm
 * b renders nothing where the quote would be, so the sheet closes up and the
 * buy button sits that much nearer the price. Two tests on this surface have
 * already kept the single quote (testimonial_swipe_v1, testimonial_byline_v1);
 * this one asks whether the quote earns its place at all (Casey, 2026-09-20:
 * "current testimonial vs no testimonial at all").
 *
 * WHERE. Every modal that renders `<Testimonial>`: the phone trial sheet, the
 * plan choice sheet, the Pro upsell after first sign-in, and the desktop plan
 * matrix. One arm per visitor across all of them. Surface: `testimonial`.
 * The row under the chart on ad and landing pages is NOT in the test.
 *
 * No cta_click: the buy buttons belong to the sheets, not the quote. The
 * primary metric is paid conversion, which carries every arm the reader held.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule. Arm b counts an
 * exposure too, although it draws nothing: the exposure is the modal opening
 * with the arm in force, not the quote being seen. With no arm assigned
 * (draft or concluded) nothing is counted and every modal shows the quote.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmExposure } from './report';

export const TESTIMONIAL_NONE_TEST = 'testimonial_none_v1';
const SURFACE = 'testimonial';

const seen = new Set<string>();

/** True when this reader should see no testimonial in the paywall modals. */
export function useTestimonialHidden(): boolean {
  const arms = useSplitArms();
  const arm = arms[TESTIMONIAL_NONE_TEST] ?? null;

  useEffect(() => {
    if (!arm) return;
    const key = `${TESTIMONIAL_NONE_TEST}:${arm}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(TESTIMONIAL_NONE_TEST, arm, SURFACE);
  }, [arm]);

  return arm === 'b';
}
