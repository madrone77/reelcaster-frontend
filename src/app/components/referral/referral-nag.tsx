'use client';

/**
 * The share-and-get-a-month ask, with an X that means no for good.
 *
 * Two shapes on two surfaces. `banner` is a full-width strip at the top of a
 * spot page. `line` is one sentence under the home city on the dashboard.
 * Both open the same modal and both remember a dismissal on the ACCOUNT (see
 * src/lib/referral-nag.ts), so the X is not "later", it is "stop asking",
 * and it holds on every browser the person signs in on.
 *
 * Renders nothing for a signed-out reader: the link needs an account, and a
 * nag that leads to a signup wall is a different ask. Renders nothing while
 * the account's row is still loading, so a dismissed nag never flashes.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { refreshSubscription, useSubscription } from '@/hooks/use-subscription';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { isReferralNagDismissed, type ReferralNagSurface } from '@/lib/referral-nag';
import ReferralModal from './referral-modal';

/**
 * Record the no on the account. The component hides the nag on its own state
 * first; this makes it stick. Failure is logged and swallowed: the nag is
 * gone for this page view either way, and it simply asks once more next time.
 */
async function saveDismissal(surface: ReferralNagSurface): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/referrals/dismiss', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ surface }),
    });
    if (!res.ok) throw new Error(String(res.status));
    // Every other consumer of the row learns about it too.
    refreshSubscription();
  } catch (err) {
    console.warn('[referral nag] dismiss did not save', err);
  }
}

const COPY: Record<ReferralNagSurface, string> = {
  spot: 'Share with a friend and get a free month of Pro',
  dashboard: 'Share ReelCaster with a friend and get a FREE month of Pro',
};

export default function ReferralNag({
  surface,
  shape = 'line',
  className = '',
}: {
  surface: ReferralNagSurface;
  shape?: 'banner' | 'line';
  className?: string;
}) {
  const { user } = useAuth();
  const { dismissedNags, loading } = useSubscription();
  // Hidden the moment the X is tapped, before the save round-trips.
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  if (!user || loading || hidden || isReferralNagDismissed(dismissedNags, surface)) {
    return null;
  }

  const dismiss = () => {
    setHidden(true);
    trackEvent('Referral Nag Dismissed', { surface });
    void saveDismissal(surface);
  };

  const openModal = () => {
    trackEvent('Referral Modal Opened', { surface });
    setOpen(true);
  };

  const modal = (
    <ReferralModal open={open} onOpenChange={setOpen} from={`${surface}-nag`} />
  );

  if (shape === 'banner') {
    return (
      <>
        <div
          className={`flex items-center gap-2 border-b border-rc-rule bg-rc-brand-soft ${className}`}
          data-testid="referral-nag-banner"
        >
          <button
            type="button"
            onClick={openModal}
            className="min-w-0 flex-1 truncate py-2.5 text-left text-[13px] font-semibold text-rc-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
          >
            {COPY[surface]} ›
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Don't show this again"
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rc-ink-mute hover:bg-rc-panel hover:text-rc-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <p
        className={`flex items-center gap-1 font-rc-mono text-[11px] text-rc-ink-mute ${className}`}
        data-testid="referral-nag-line"
      >
        <button
          type="button"
          onClick={openModal}
          className="min-w-0 truncate rounded text-left font-semibold text-rc-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
        >
          {COPY[surface]}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Don't show this again"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </p>
      {modal}
    </>
  );
}
