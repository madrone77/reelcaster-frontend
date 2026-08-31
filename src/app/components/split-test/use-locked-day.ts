'use client';

/**
 * Which locked-day treatment this visitor gets, and the two counters that
 * decide whether it was worth doing.
 *
 * The question: a locked forecast day used to be an empty grey slot with a
 * padlock on it, which reads as "nothing here". Arm b puts the day behind
 * frosted glass instead — green where the score would be, blurred past
 * reading (see components/explore/locked-gauze.tsx). Does a day that looks
 * like it is hiding something get tapped more than a day that looks empty?
 *
 * CONTROL IS TODAY'S LOOK, and it is also what everybody gets while the
 * registry says draft, which is the state this ships in. `useSplitArms`
 * returns nothing until /api/split-tests answers, so a visitor in arm b sees
 * the padlock for one round trip and then the glass. That flicker is the cost
 * of leaving these pages cacheable, and it is the same trade `usePricing`
 * documents next door.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const LOCKED_DAY_TEST = 'locked_day_gauze_v1';

/** The arm that draws the gauze. Anything else, including no arm, is control. */
const GAUZE_ARM = 'b';

/**
 * One exposure per arm per surface per page load, not one per locked day.
 *
 * A signed-out visitor's fortnight is twelve padlocks, and a browse list is
 * twenty cards of them, so counting per cell would make "exposures" mean
 * "locked cells painted" and swamp the CTA rate by two orders of magnitude.
 * Both arms count by exactly the same rule, which is what the comparison
 * actually needs; the absolute number means "this surface showed a locked day
 * to this browser at least once since it loaded", and nothing more.
 *
 * Module scope rather than a ref, because the whole point is to dedupe ACROSS
 * component instances. It resets on a full load, so a returning tab counts
 * again — which is right: that is another sitting.
 */
const seen = new Set<string>();

export interface LockedDayTreatment {
  /** Draw the frosted-glass lock rather than the plain padlock. */
  gauze: boolean;
  /** Call when a locked day is tapped. No-op outside the test. */
  reportTap: () => void;
}

/**
 * @param surface Where the locked day is being drawn — `forecast_strip`,
 *                `pill_rail`, `spot_card`. Kept to the event route's shape
 *                (lower case, no spaces) so a new surface needs no deploy
 *                there.
 * @param hasLockedDay Whether this render actually contains a locked day. A
 *                surface with fourteen open days is not an exposure to
 *                anything, and counting it would dilute both arms with
 *                readers who never saw the treatment.
 */
export function useLockedDayTreatment(
  surface: string,
  hasLockedDay: boolean,
): LockedDayTreatment {
  const arms = useSplitArms();
  const variant = arms[LOCKED_DAY_TEST] ?? null;

  useEffect(() => {
    if (!variant || !hasLockedDay) return;
    const key = `${LOCKED_DAY_TEST}:${variant}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(LOCKED_DAY_TEST, variant, surface);
  }, [variant, hasLockedDay, surface]);

  return {
    gauze: variant === GAUZE_ARM,
    reportTap: () => {
      if (!variant) return;
      reportSplitArmCta(LOCKED_DAY_TEST, variant, surface);
    },
  };
}
