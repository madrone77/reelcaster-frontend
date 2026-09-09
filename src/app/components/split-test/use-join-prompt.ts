'use client';

/**
 * Whether a wall on /explore opens the full Pro modal or two sentences and a
 * free account.
 *
 * Arm a is control: <ProTrialModal>, exactly as today — headline, fourteen-row
 * plan matrix, card form — on every wall the map can raise. Arm b opens
 * <JoinPromptModal> instead: what you reached for, what an account does about
 * it, Join now / Sign in, and one quiet line to the trial.
 *
 * WHAT THE TEST IS ACTUALLY ASKING. The big modal answers a tapped star with
 * a checkout, which is the right answer to "start free trial" and a large
 * answer to anything else. The theory is that the ask is too big too early on
 * the surface that sees the most bought traffic in the product, and that
 * asking for the account first converts more of them into anything at all.
 * The risk is the obvious one: an arm that stops asking for the card may
 * simply start fewer trials, and that is precisely what the read has to show.
 *
 * HOW TO READ IT. Both arms count an exposure the first time a wall opens on
 * the surface, and both count `cta_click` when the reader takes a button, so
 * the split page's own rate is "wall seen, wall answered". The number that
 * decides it is downstream and not here: trials started and free accounts
 * created per exposure, on the campaign results page. Arm b is meant to move
 * signups up without moving trials down.
 *
 * ONE EXPOSURE PER ARM PER PAGE LOAD, the house rule for these counters —
 * not one per wall. A single sitting on the map can hit the star, a locked day
 * and the reports card, and counting each would make "exposures" mean "walls
 * painted" and swamp the rate. Both arms count by the same rule, which is what
 * the comparison needs.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm assigned nothing
 * is counted and every wall is the full modal, which is today's behaviour.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmExposure } from './report';

export const JOIN_PROMPT_TEST = 'explore_join_prompt_v1';

/** One surface: the walls raised by the Explore map. */
const SURFACE = 'explore_wall';

/** Module scope, so it dedupes across every wall on the page. */
const seen = new Set<string>();

export interface JoinPromptTreatment {
  /** True on arm b: walls open the small modal. False outside the test. */
  compact: boolean;
  /** The arm on the cookie, for anything that wants to stamp it. */
  arm: string | null;
}

/**
 * @param active Whether a wall is actually open. An exposure is a wall shown,
 *               not a map loaded: counting every visit would put the whole of
 *               /explore in the denominator of a test only the walled see.
 */
export function useJoinPrompt(active: boolean): JoinPromptTreatment {
  const arms = useSplitArms();
  const arm = arms[JOIN_PROMPT_TEST] ?? null;

  useEffect(() => {
    if (!arm || !active) return;
    const key = `${JOIN_PROMPT_TEST}:${arm}:${SURFACE}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(JOIN_PROMPT_TEST, arm, SURFACE);
  }, [arm, active]);

  return { compact: arm === 'b', arm };
}
