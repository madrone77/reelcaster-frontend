'use client';

/**
 * The plan picker on the phone trial sheet: one annual button, or two cards.
 *
 * Arm a is control: the sheet as it stood after trial_sheet_stripe_v1, one
 * price with nothing beside it and the "7 days free" title over it. Arm b
 * draws two cards under the title before the rows: Yearly, preselected, with
 * the free week and a "Save 35%" badge; Monthly, billed today, no trial. The
 * badge is arithmetic off the two prices, never typed. Every top-grossing
 * paywall in the Sports, Navigation and Travel lists (Fishbrain, Flighty,
 * Gaia, onX, Golfshot, 2026-09-18) sets the year against a month this way;
 * the guess is that the annual price reads as a saving beside a monthly one
 * and as a cost on its own.
 *
 * WHERE. Both shapes of the trial modal: the phone sheet
 * (src/app/components/paywall/trial-sheet-stripe, surface `sheet_plan`) and
 * the centred desktop dialog (src/app/components/paywall/pro-trial-modal,
 * surface `dialog_plan`), and only when the monthly price is wired up
 * (NEXT_PUBLIC_STRIPE_MONTHLY_ON, STRIPE_MONTHLY_PRICE_ID). With either unset
 * the surface draws arm a whatever the cookie says, and nothing is counted.
 * Exposure = the surface rendered with an arm; cta_click = the buy button
 * pressed, either card. The desktop shape shipped a day after the sheet
 * (2026-09-19): until then a desktop reader in arm b was assigned, drew the
 * single annual button, and counted nothing.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule. Stop the test with an
 * UPDATE on `split_tests`; with no arm assigned every reader gets arm a.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

/**
 * The third run, three arms. plan_picker_v1 (2026-09-19 18:00 to 2026-09-20
 * 19:17 UTC) was a draw and v2 ran the same arms again from 19:32 until v3
 * replaced it. v3 keeps both of v2's arms and adds c: the same two cards drawn
 * like a forecast day tile, the chosen card filled brand blue with white text
 * the way the selected day is, and the Save badge as the gold tab the best
 * day carries. Same surfaces; a third each.
 */
export const PLAN_PICKER_TEST = 'plan_picker_v3';

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
  const arm = active ? (arms[PLAN_PICKER_TEST] ?? null) : null;

  useEffect(() => {
    if (!arm) return;
    const key = `${PLAN_PICKER_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(PLAN_PICKER_TEST, arm, surface);
  }, [arm, surface]);

  return {
    picker: arm === 'b' || arm === 'c',
    look: arm === 'c' ? 'tile' : 'card',
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(PLAN_PICKER_TEST, arm, surface);
    },
  };
}
