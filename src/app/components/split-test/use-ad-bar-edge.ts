'use client';

/**
 * Which edge of the screen the ad frame's bar sits on: top (today) or bottom.
 *
 * The bar went to the bottom on 2026-09-02 ("where a thumb is") and back to
 * the top on 2026-09-04. The day in between was the best the frame has had:
 * 39 paywall views turned into 5 trials and a purchase, against 2 the next
 * day and none the day after. The Vancouver campaign launching that morning
 * explains the traffic and not the rate, so the edge is the thing to test
 * rather than argue about.
 *
 * Arm a is the top edge, unchanged. Arm b is the bottom edge, the 2026-09-02
 * shape: the bar pinned under the thumb, the map and the document shortened
 * by its height, `data-ad-bar` published so everything else pinned to the
 * bottom of a phone clears it (see globals.css).
 *
 * Both ad surfaces read this: the framed Explore map and the framed spot
 * page. A visitor holds one arm across both, because the cookie is per
 * visitor and not per page, so someone who goes map → spot sees the bar on
 * the same edge throughout.
 *
 * Stop the test with an UPDATE on `split_tests`; with no arm the bar is at
 * the top and nothing is counted.
 */

import { useEffect } from 'react';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const AD_BAR_EDGE_TEST = 'ad_bar_edge_v1';

export type AdBarEdge = 'top' | 'bottom';

/**
 * One exposure per arm per surface per page load, like the locked-day
 * counters: "this surface showed the bar to this browser at least once since
 * it loaded". Module scope so it dedupes across re-mounts of the same shell.
 */
const seen = new Set<string>();

export interface AdBarEdgeTreatment {
  /** Where the bar goes. `top` outside the test, whatever the cookie says. */
  edge: AdBarEdge;
  /** The arm on the cookie, for anything that wants to stamp it. */
  arm: string | null;
  /** Call when the bar's Start free trial button is pressed. No-op outside the test. */
  reportCta: () => void;
}

/**
 * @param surface Where the bar is being worn: `explore_map` or `spot_page`.
 *                Kept to the event route's shape (lower case, no spaces).
 * @param active  Whether this render is actually the ad frame. Off the frame
 *                there is no bar to place and nothing is counted.
 */
export function useAdBarEdge(surface: string, active: boolean): AdBarEdgeTreatment {
  const arms = useSplitArms();
  const arm = active ? (arms[AD_BAR_EDGE_TEST] ?? null) : null;
  const edge: AdBarEdge = arm === 'b' ? 'bottom' : 'top';

  useEffect(() => {
    if (!arm) return;
    const key = `${AD_BAR_EDGE_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(AD_BAR_EDGE_TEST, arm, surface);
  }, [arm, surface]);

  return {
    edge,
    arm,
    reportCta: () => {
      if (!arm) return;
      reportSplitArmCta(AD_BAR_EDGE_TEST, arm, surface);
    },
  };
}
