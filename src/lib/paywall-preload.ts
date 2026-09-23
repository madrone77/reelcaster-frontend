'use client';

/**
 * The wall's code, fetched before the tap instead of on it.
 *
 * WHAT THIS FIXES. Every paywall in the app is a code-split chunk loaded by
 * the click that opens it, deliberately: the plan matrix, the pricing tables
 * and the Stripe client have no business on a map's first paint. The cost of
 * that is paid at the worst possible moment. Measured on a local production
 * build, iPhone viewport, 6x CPU and a 1.6 Mbps link, tapping a locked day on
 * /explore a third of a second after landing:
 *
 *     chunk requested   +12ms after the tap
 *     chunk arrived     1560-2320ms later          (9 kB, gzipped)
 *     sheet on screen   2213ms after the tap       (median of three)
 *
 * Nine kilobytes took two seconds because of WHEN they were asked for, not
 * how big they are: the request goes out while the map's own tiles, its data
 * and the ad script still own the connection, and it waits behind all of
 * them. The same tap on a page left idle for twelve seconds drew the sheet in
 * 615ms — the code is not slow, the queue is.
 *
 * So the fetch moves off the tap. `preloadTrialModal()` runs on the first
 * idle frame after a wall-bearing surface mounts, which puts the chunk in the
 * module cache long before a thumb reaches it; the tap then has nothing left
 * to fetch and the sheet is a render, not a download.
 *
 * WHY IDLE AND NOT `load` + settle. `schedulePostSettleLoad` in
 * ./analytics-loader waits for the document, then two and a half seconds,
 * then idle, because analytics SDKs are 312 kB that nobody is waiting for.
 * The opposite is true here. This is 24 kB, and it is the one thing on the
 * page a reader may be about to wait for; the surfaces that raise walls are
 * the surfaces the product sells on. Early and small beats late and polite.
 *
 * IDEMPOTENT AND SAFE TO CALL ANYWHERE. The module cache is the latch, so
 * every wall on a page can ask for this and only the first asks the network.
 * It never throws: a chunk that fails to preload is re-imported by the click
 * the way it always was, and a failure here must not reach a reader who was
 * only looking at a map.
 *
 * These loaders are also what ../hooks/use-paywall-modal renders through, so
 * the warm and the render are the same module request either way.
 */

import type { ComponentType } from 'react';

export type TrialModalProps = ComponentType<
  React.ComponentProps<typeof import('@/app/components/paywall/pro-trial-modal').default>
>;
export type PlanChoiceModalProps = ComponentType<
  React.ComponentProps<typeof import('@/app/components/paywall/plan-choice-modal').default>
>;

/**
 * Module-level constants, not inline arrows: `useLazyComponent` takes these
 * as an effect dependency, and a fresh function each render would re-run it
 * forever.
 */
export const loadTrialModal = () => import('@/app/components/paywall/pro-trial-modal');
export const loadPlanChoiceModal = () => import('@/app/components/paywall/plan-choice-modal');

/** Set before the import resolves, so concurrent callers never double-fetch. */
let trialModalWarm = false;
let planChoiceWarm = false;

/**
 * The Pro trial modal — the sheet on a phone, the centred dialog elsewhere —
 * plus the one image its banner draws. That mark is 4 kB and it used to start
 * downloading only once the sheet was already on screen, so it landed after
 * the thing it is the header of (measured at +330-400ms, post-tap).
 */
export function preloadTrialModal(): void {
  if (trialModalWarm || typeof window === 'undefined') return;
  trialModalWarm = true;
  void loadTrialModal().catch(() => {
    // Let the open try again; it has its own error path.
    trialModalWarm = false;
  });
  new Image().src = '/reelcaster-mark-pro.svg';
}

/** Arm b's second screen on /explore (see ../app/explore/components/explore-wall). */
export function preloadPlanChoice(): void {
  if (planChoiceWarm || typeof window === 'undefined') return;
  planChoiceWarm = true;
  void loadPlanChoiceModal().catch(() => {
    planChoiceWarm = false;
  });
}

/**
 * Upper bound on waiting for an idle frame, and in practice the thing that
 * fires: /explore's main thread does not go idle while the map is loading.
 *
 * Short on purpose, and it costs the page nothing to be. A React effect
 * cannot run before hydration, and on /explore hydration lands around 1.8s
 * against an LCP of 1.5s — so the earliest this warm can possibly fire is
 * already past the paint it could have delayed. Measured with a 1200ms
 * deadline the chunk went out at 3.0s, which is late enough for a fast reader
 * to beat it to the tap. There is no paint left to protect by waiting.
 */
const IDLE_TIMEOUT_MS = 200;

/** Run `warm` on the first idle frame, or at the deadline, whichever is first. */
export function warmOnIdle(warm: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const ric = window.requestIdleCallback;
  if (typeof ric === 'function') {
    const id = ric(warm, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback?.(id);
  }
  // Safari below 17 has no rIC. A timeout is the whole fallback: this is a
  // prefetch, and the worst a badly timed one does is what today already does.
  const id = window.setTimeout(warm, 500);
  return () => window.clearTimeout(id);
}
