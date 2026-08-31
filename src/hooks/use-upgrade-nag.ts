'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  markNagAsked,
  NAG_THRESHOLD,
  readNag,
  serverNag,
  subscribeNag,
} from '@/lib/upgrade-nag';

/**
 * Watches the engagement count and opens the proactive upgrade ask when it is
 * earned. The counting itself is `noteEngagement` in @/lib/upgrade-nag, called
 * straight from the click handlers; this is the half that decides when the
 * modal opens and hands the caller its open state.
 *
 * `enabled` is the whole audience rule and belongs to the caller, because only
 * the caller knows it. On /explore it is "not Pro, tier resolved, not the ad
 * frame". Resolved matters: `useSubscription` reports `isPaid: false` until it
 * answers, and a Pro member who gets nagged for the thing they already pay for
 * has been told the product does not know who they are.
 *
 * `suppressed` holds the ask back while another dialog owns the screen. Walls
 * that open <ProTrialModal> zero the count on the way up so they cannot be
 * stacked on, but the create-alert modal, the custom-spot dialog and the
 * mobile filter sheet are not walls and would otherwise be interrupted.
 * Suppression only defers: the count keeps its points and the ask fires on the
 * next click after the sheet closes.
 */
export function useUpgradeNag({
  enabled,
  suppressed = false,
}: {
  enabled: boolean;
  suppressed?: boolean;
}): { open: boolean; setOpen: (open: boolean) => void } {
  const nag = useSyncExternalStore(subscribeNag, readNag, serverNag);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || suppressed) return;
    if (nag.asked || nag.score < NAG_THRESHOLD) return;
    // Spend the visit's ask before opening, so a second subscriber (or a
    // re-render mid-animation) cannot open a second copy.
    markNagAsked();
    setOpen(true);
  }, [enabled, suppressed, nag]);

  return { open, setOpen };
}
