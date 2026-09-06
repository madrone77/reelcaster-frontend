'use client';

/**
 * Give a month, get a month, as a modal.
 *
 * A centred dialog on desktop and a bottom sheet on a phone, the same split
 * the trial modal makes and for the same reason: a sheet is where a text to
 * a fishing buddy starts on a phone, and a centred box is where it starts at
 * a desk. `useIsPhone` answers on the first client render, so the shape this
 * mounts in is the shape it keeps.
 *
 * Share opens the phone's share sheet where there is one; Copy is the
 * desktop path and the fallback. The link is minted on first open, so a
 * reader who never opens this costs no request.
 */

import { useCallback, useState } from 'react';
import { Check, Copy, Gift, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsPhone } from '@/hooks/use-is-phone';
import { useReferralSummary } from '@/hooks/use-referral-summary';
import { useSubscription } from '@/hooks/use-subscription';
import { trackEvent } from '@/lib/analytics';
import { referralShareText } from '@/lib/referrals';

export default function ReferralModal({
  open,
  onOpenChange,
  from,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which nag opened it, for the event. */
  from: string;
}) {
  const phone = useIsPhone();
  const { summary, failed } = useReferralSummary(open);
  const { isPaid, stripeCustomerId } = useSubscription();
  const [copied, setCopied] = useState(false);

  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // No await before navigator.share: it needs the tap's own activation.
  const share = () => {
    if (!summary) return;
    trackEvent('Referral Link Shared', { friends: summary.friends, from });
    navigator
      .share({ title: 'A month of ReelCaster Pro', text: referralShareText(summary.url) })
      .then(() => onOpenChange(false))
      // A dismissed share sheet rejects. That is a change of mind, not an error.
      .catch(() => {});
  };

  const copy = useCallback(async () => {
    if (!summary) return;
    trackEvent('Referral Link Copied', { friends: summary.friends, from });
    try {
      await navigator.clipboard.writeText(summary.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. The link is on screen; long press still works.
    }
  }, [summary, from]);

  const yours = isPaid && stripeCustomerId ? 'a month off your next year' : 'a free month of Pro';
  const days = summary?.days ?? 30;

  const body = (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft">
          <Gift className="h-5 w-5 text-rc-brand" />
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-[17px] font-semibold text-rc-ink">
            Give a month, get a month
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-relaxed text-rc-ink-soft">
            A friend who joins through your link gets {days} days of Pro, no card.
            You get {yours}. Every friend is another month, up to a full year.
          </DialogDescription>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-rc-surface p-3">
        <p className="truncate font-rc-mono text-[13px] text-rc-ink">
          {failed
            ? 'Your link is not available right now.'
            : summary
              ? summary.url.replace(/^https?:\/\//, '')
              : 'Getting your link…'}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {canShare && (
          <button
            type="button"
            onClick={share}
            disabled={!summary}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share with a friend
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          disabled={!summary}
          className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-semibold transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand ${
            canShare
              ? 'border border-rc-line-strong text-rc-ink hover:bg-rc-surface'
              : 'bg-rc-brand text-white hover:bg-rc-brand-hover'
          }`}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy your link'}
        </button>
      </div>

      {summary && summary.friends > 0 && (
        <p className="mt-3 text-[12px] text-rc-ink-mute">
          {summary.friends} {summary.friends === 1 ? 'friend has' : 'friends have'} joined
          through your link. {summary.monthsThisYear} of {summary.cap} months earned this year.
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant={phone ? 'sheet' : 'center'}
        data-testid="referral-modal"
        data-shape={phone ? 'sheet' : 'dialog'}
        className={`bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 ${phone ? '' : 'sm:max-w-md'}`}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
