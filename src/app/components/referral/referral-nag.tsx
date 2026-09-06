'use client';

/**
 * The share-and-get-a-month ask, with an X that means no for good.
 *
 * Two shapes on two surfaces. `banner` is a full-width strip at the top of a
 * spot page. `line` is one sentence under the home city on the dashboard.
 * Both open the same modal and both remember a dismissal per browser (see
 * src/lib/referral-nag.ts), so the X is not "later", it is "stop asking".
 *
 * Renders nothing for a signed-out reader: the link needs an account, and a
 * nag that leads to a signup wall is a different ask.
 *
 * The dismissal is read in an effect, not during render, so the server and
 * the first client paint agree; the nag appears a frame after hydration on
 * the browsers that have not said no.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { trackEvent } from '@/lib/analytics';
import {
  dismissReferralNag,
  isReferralNagDismissed,
  type ReferralNagSurface,
} from '@/lib/referral-nag';
import ReferralModal from './referral-modal';

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
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setVisible(!isReferralNagDismissed(surface));
  }, [surface]);

  if (!user || !visible) return null;

  const dismiss = () => {
    dismissReferralNag(surface);
    setVisible(false);
    trackEvent('Referral Nag Dismissed', { surface });
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
