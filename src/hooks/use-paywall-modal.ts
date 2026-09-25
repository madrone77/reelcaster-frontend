'use client';

import { useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useLazyComponent } from '@/hooks/use-lazy-component';
import {
  loadTrialModal,
  preloadTrialModal,
  warmOnIdle,
  type TrialModalProps,
} from '@/lib/paywall-preload';

/**
 * The Pro trial modal, fetched while the reader is still looking at the page
 * and handed back the moment they ask for it.
 *
 * For any surface that can raise a paywall. Two jobs in one hook because they
 * are two halves of one decision — what to load, and when:
 *
 *   - on an idle frame after this surface mounts, the chunk is warmed, so the
 *     tap has nothing to download (see @/lib/paywall-preload);
 *   - the component comes back through `useLazyComponent` rather than
 *     `next/dynamic`, so the first render does not suspend and pay React's
 *     fallback throttle (see @/hooks/use-lazy-component).
 *
 * Together those took a locked-day tap on /explore from 2213ms to under
 * 100ms on the same throttled phone.
 *
 * NULL UNTIL IT IS LOADED, which is what `dynamic()` rendered in that window
 * too. Callers guard on it and render nothing, exactly as before.
 *
 * NOT WARMED FOR A MEMBER. A Pro account is never sold a trial, so warming
 * one is bytes spent on a reader who cannot use them. The gate is on the WARM
 * only: `active` still loads it for anyone, because the modal has a
 * "Manage subscription" shape and a surface that opens it must always get it.
 *
 * @param active  Whether the modal is wanted now — the caller's own `open`,
 *                usually latched through `useMountedOnce` so closing it does
 *                not throw the module away.
 */
export function useTrialModal(active = false): TrialModalProps | null {
  const { isPaid } = useSubscription();

  useEffect(() => {
    if (active || isPaid) return;
    return warmOnIdle(preloadTrialModal);
  }, [active, isPaid]);

  return useLazyComponent(loadTrialModal, active);
}

/**
 * Warm the wall's code without rendering it, for a surface that knows a wall
 * is reachable long before the component that holds one exists.
 *
 * /explore is the case this is for: <ExploreWall> is rendered by the spot
 * cards, the locked-day tiles and the star, none of which exist until the
 * spots have loaded — measured at ~2.9s, by which time a reader can already
 * be reaching for the map. The shell mounts at hydration and can ask for the
 * chunk then.
 */
export function useWarmPaywall(): void {
  const { isPaid } = useSubscription();

  useEffect(() => {
    if (isPaid) return;
    return warmOnIdle(preloadTrialModal);
  }, [isPaid]);
}
