'use client';

/**
 * The two counters on a locked forecast day: who saw one, and who tapped it.
 *
 * There was a treatment here once. Arm b put the locked day behind frosted
 * glass, green where the score would be, blurred past reading. It was pulled
 * because the green was always the GOOD green on every locked day, whatever
 * the day was actually worth: the client is never sent the score, so the tile
 * could only ever invent one, and it invented a good one every time. A tile
 * that promises a good day it cannot know is a promise the next screen breaks,
 * and tap rate is the one number that would have called that a win.
 *
 * What is left is measurement with nothing to measure between: every visitor
 * gets the padlock on sunk grey. The counters stay because "do people tap a
 * locked day at all" is still worth knowing, and because the honest version of
 * this test (a real good/fair/poor band per locked day, sent from the server
 * instead of nulled) would want the same two events.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const LOCKED_DAY_TEST = 'locked_day_gauze_v1';

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
    reportTap: () => {
      if (!variant) return;
      reportSplitArmCta(LOCKED_DAY_TEST, variant, surface);
    },
  };
}
