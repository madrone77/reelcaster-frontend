'use client';

/**
 * The plan picker on both shapes of the trial modal: Yearly beside Monthly.
 *
 * Two cards under the "7 days free" title, before the rows: Yearly,
 * preselected, with the free week and a Save badge; Monthly, billed today,
 * no trial. The badge is arithmetic off the two prices, never typed. Every
 * top-grossing paywall in the Sports, Navigation and Travel lists (Fishbrain,
 * Flighty, Gaia, onX, Golfshot, 2026-09-18) sets the year against a month
 * this way. See the two tests below for who gets them.
 *
 * WHERE. The phone sheet (src/app/components/paywall/trial-sheet-stripe,
 * surface `sheet_plan`) and the centred desktop dialog
 * (src/app/components/paywall/pro-trial-modal, surface `dialog_plan`), and
 * only when the monthly price is wired up (NEXT_PUBLIC_STRIPE_MONTHLY_ON,
 * STRIPE_MONTHLY_PRICE_ID). With either unset there is no Monthly to sell,
 * the surface draws the single annual button whatever the cookie says, and
 * nothing is counted. Exposure = the surface rendered with an arm; cta_click
 * = the buy button pressed, either card.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule. Stop a test with an
 * UPDATE on `split_tests`; with no arm the phone draws the cards and the
 * desktop dialog the single button.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

/**
 * Since 2026-09-21 the two shapes run their own tests, and never on one page.
 *
 * PHONE, plan_picker_v3: the cards against the cards drawn differently.
 * plan_picker_v1 (2026-09-19 18:00 to 2026-09-20 19:17 UTC) was a draw and v2
 * ran the same arms again from 19:32; Casey then retired the one-button
 * control on the phone and every phone reader gets the cards. v3 asks only
 * how to draw them: b the plain cards, c the same two cards drawn like a
 * forecast day tile, the chosen card filled brand blue with white text the
 * way the selected day is, and the Save badge as the gold tab the best day
 * carries. Half each. With no arm the phone draws the plain cards.
 *
 * DESKTOP, desktop_plan_picker_v1: v2's question asked again on the dialog
 * alone, because desktop had seen too few readers to answer it (about 20
 * views and no trials, 09-19 to 09-21). a the single annual button
 * (control), b the plain cards; the customer quote stays on both. Half each.
 * With no arm the dialog draws the single button, as it always had.
 */
export const PLAN_PICKER_TEST = 'plan_picker_v3';
export const DESKTOP_PLAN_PICKER_TEST = 'desktop_plan_picker_v1';

/** How the two cards are drawn. `tile` is arm c; see ../paywall/plan-picker. */
export type PlanPickerLook = 'card' | 'tile';

/** Where the picker is drawn, for the counters. */
export type PlanPickerSurface = 'sheet_plan' | 'dialog_plan';

const seen = new Set<string>();

export interface PlanPickerArm {
  /** Draw the two cards. */
  picker: boolean;
  /** Which way to draw them, when `picker` is true. */
  look: PlanPickerLook;
  /** Call when the buy button is pressed. No-op outside the test. */
  reportPress: () => void;
}

/**
 * @param active   The monthly card can be sold here. Nothing is counted while
 *                 false, and the picker is never drawn.
 * @param surface  Which shape is drawing it. One exposure per arm per surface
 *                 per page load; a page never mounts both shapes at once.
 */
export function usePlanPicker(
  active: boolean,
  surface: PlanPickerSurface = 'sheet_plan',
): PlanPickerArm {
  const arms = useSplitArms();
  const desktop = surface === 'dialog_plan';
  const test = desktop ? DESKTOP_PLAN_PICKER_TEST : PLAN_PICKER_TEST;
  const arm = active ? (arms[test] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${test}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(test, arm, surface);
  }, [test, arm, surface]);

  return {
    picker: desktop ? arm === 'b' : active,
    look: !desktop && arm === 'c' ? 'tile' : 'card',
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(test, arm, surface);
    },
  };
}
