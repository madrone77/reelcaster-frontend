'use client';

/**
 * Whether the phone trial sheet asks for an email before Stripe.
 *
 * Arm a is control: the sheet exactly as today, email field over the button.
 * Arm b is the same sheet with the field gone, so the button goes straight to
 * Stripe and Stripe's own form takes the address with the card. Nothing else
 * differs: same header, same offer, same rows, same testimonial, same button.
 *
 * WHY AGAIN. `trial_sheet_stripe_v1` (2026-09-06) took the field out as part
 * of a whole new sheet, and the field came back a day later because Stripe
 * completions per tap fell from about 45% to about 10%. But that read was one
 * afternoon, and within the same window the sessions that DID carry an email
 * finished 0 of 6, so the period may have done it rather than the field. This
 * test changes the field and nothing else.
 *
 * JUDGED ON trials started per exposure and trial-to-paid, then Stripe
 * completions per checkout. Never on presses: arm b wins presses by
 * construction (28% vs 5.5% last time), because a tap with no typing is not
 * a decision to buy.
 *
 * WHAT COUNTS. Exposure = the sheet's buy button rendered to a signed-out
 * reader, auth settled, on the pay-first path. That is the only reader the
 * two arms differ for: a signed-in reader never sees a field, and a sheet
 * with a link instead of the buy form has no field on either arm. Press = the
 * buy button pressed (arm a: the form submitted, so the browser has already
 * required an address).
 *
 * KNOWN COSTS OF ARM B, accepted: the trial-eligibility pre-check and the
 * existing-account check both need the address, so a repeat trialer or an
 * existing account is caught only by the webhook's guards after Stripe; the
 * "almost done" email cannot reach a reader who left Stripe before typing an
 * address there; and Meta advanced matching gets no email from the sheet.
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and the sheet keeps its field.
 */

import { useCallback, useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const TRIAL_SHEET_EMAIL_TEST = 'trial_sheet_no_email_v2';

/** The phone sheet is the only surface in the test. */
const SURFACE = 'sheet';

/** Module scope, so it dedupes across every open of the sheet on the page. */
const seen = new Set<string>();

export interface TrialSheetEmail {
  /** False on arm b: no field, the button opens Stripe directly. */
  collectEmail: boolean;
  /** Call when the buy button is pressed. No-op outside the test. */
  reportPress: () => void;
}

/**
 * @param eligible Signed out, auth settled, pay-first checkout on, and the
 *                 buy form (not a link) under the sheet. Anything else is not
 *                 an exposure to either arm, and keeps the field.
 */
export function useTrialSheetEmail(eligible: boolean): TrialSheetEmail {
  const arms = useSplitArms();
  const arm = arms[TRIAL_SHEET_EMAIL_TEST] ?? null;

  useEffect(() => {
    if (!arm || !eligible) return;
    const key = `${TRIAL_SHEET_EMAIL_TEST}:${arm}:${SURFACE}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(TRIAL_SHEET_EMAIL_TEST, arm, SURFACE);
  }, [arm, eligible]);

  const reportPress = useCallback(() => {
    if (!arm || !eligible) return;
    reportSplitArmCta(TRIAL_SHEET_EMAIL_TEST, arm, SURFACE);
  }, [arm, eligible]);

  return { collectEmail: !(eligible && arm === 'b'), reportPress };
}
