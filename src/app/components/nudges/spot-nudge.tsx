'use client';

/**
 * The one ask at the top of a spot page, picked from three.
 *
 * Share with a friend, log a catch here, or rate ReelCaster. One per page
 * view, drawn at random from the ones this account is still eligible for
 * (see src/lib/nudges.ts), so each gets a fair share of views and the
 * Analytics → Nudges page can compare their rates.
 *
 * Every step is logged twice: to Mixpanel, and to `nudge_events` for the
 * bluecaster admin. The share nudge also keeps writing the referral tap log,
 * which the Referrals report reads.
 *
 * Renders nothing for a signed-out reader, and nothing until both the
 * account's row and the eligibility read have settled, so a retired nudge
 * never flashes.
 */

import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { refreshSubscription, useSubscription } from '@/hooks/use-subscription';
import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEventName } from '@/types/analytics';
import { logReferralShare } from '@/lib/referral-share-log';
import {
  FEEDBACK_NOTE_MAX,
  NUDGE_DISMISS_KEY,
  eligibleNudges,
  type Nudge,
  type NudgeEventKind,
} from '@/lib/nudges';
import {
  fetchNudgeEligibility,
  forgetNudgeEligibility,
  logNudge,
  saveFeedbackNote,
  saveFeedbackRating,
  saveNudgeDismissal,
} from '@/lib/nudge-log';
import ReferralModal from '@/app/components/referral/referral-modal';

const SURFACE = 'spot' as const;

const MP_EVENT: Record<NudgeEventKind, AnalyticsEventName> = {
  shown: 'Nudge Shown',
  open: 'Nudge Tapped',
  dismiss: 'Nudge Dismissed',
  rate: 'Nudge Rated',
  done: 'Nudge Completed',
};

export default function SpotNudge({
  spotSlug,
  onLogCatch,
  className = '',
}: {
  spotSlug: string;
  /**
   * Open the page's Log catch dialog. `onSaved` is to be called when a catch
   * from that dialog is saved, which completes the nudge.
   */
  onLogCatch: (onSaved: () => void) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const { dismissedNags, loading } = useSubscription();
  const userId = user?.id ?? null;

  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [hidden, setHidden] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Feedback: the stars, then the box, then thanks.
  const [rating, setRating] = useState(0);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [thanked, setThanked] = useState(false);

  // Picked once per page view: the first time both reads settle. Later
  // changes to dismissed_nags (a rating retiring the feedback nudge) must not
  // swap the banner out from under the reader.
  const picked = useRef(false);
  useEffect(() => {
    if (!userId || loading || picked.current) return;
    let cancelled = false;
    fetchNudgeEligibility(userId).then((eligibility) => {
      if (cancelled || picked.current || !eligibility) return;
      picked.current = true;
      const pool = eligibleNudges(dismissedNags, eligibility);
      if (!pool.length) return;
      const choice = pool[Math.floor(Math.random() * pool.length)];
      setNudge(choice);
      trackEvent(MP_EVENT.shown, { nudge: choice, surface: SURFACE, spot: spotSlug });
      logNudge(choice, 'shown', SURFACE, { spotSlug });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loading, dismissedNags, spotSlug]);

  if (!userId || !nudge || hidden) return null;

  const log = (kind: NudgeEventKind, extra: Record<string, unknown> = {}) => {
    trackEvent(MP_EVENT[kind], { nudge, surface: SURFACE, spot: spotSlug, ...extra });
    logNudge(nudge, kind, SURFACE, { spotSlug, ...extra });
  };

  const dismiss = () => {
    setHidden(true);
    log('dismiss');
    if (nudge === 'share') {
      trackEvent('Referral Nag Dismissed', { surface: SURFACE });
      logReferralShare('dismiss', SURFACE);
    }
    void saveNudgeDismissal(NUDGE_DISMISS_KEY[nudge]).then(refreshSubscription);
  };

  const open = () => {
    log('open');
    if (nudge === 'share') {
      trackEvent('Referral Modal Opened', { surface: SURFACE });
      logReferralShare('open', SURFACE);
      setShareOpen(true);
    } else if (nudge === 'catch') {
      onLogCatch(() => {
        log('done');
        forgetNudgeEligibility();
        // A first catch retires this nudge for good: the eligibility read
        // says so from the next page on, and this banner goes now.
        void saveNudgeDismissal(NUDGE_DISMISS_KEY.catch).then(refreshSubscription);
        setHidden(true);
      });
    }
  };

  const rate = (stars: number) => {
    const first = rating === 0;
    setRating(stars);
    if (!first) return; // a changed mind travels with the note
    log('rate', { rating: stars });
    void saveFeedbackRating(stars, SURFACE, spotSlug).then(setFeedbackId);
  };

  const submit = async () => {
    if (!feedbackId || sending) return;
    setSending(true);
    const ok = await saveFeedbackNote(feedbackId, rating, note);
    setSending(false);
    if (!ok) return;
    log('done', { rating, has_note: note.trim().length > 0 });
    setThanked(true);
  };

  const closeButton = (
    <button
      type="button"
      onClick={thanked ? () => setHidden(true) : dismiss}
      aria-label={thanked ? 'Close' : "Don't show this again"}
      className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rc-ink-mute hover:bg-rc-panel hover:text-rc-ink"
    >
      <X className="h-4 w-4" />
    </button>
  );

  const shell = 'border-b border-rc-rule bg-rc-brand-soft';
  const linkClass =
    'min-w-0 flex-1 py-2.5 text-left text-[13px] font-semibold text-rc-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand';

  if (nudge === 'feedback') {
    return (
      <div className={`${shell} ${className}`} data-testid="nudge-feedback">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 py-2.5 text-[13px] font-semibold text-rc-brand">
            {thanked ? 'Thanks. We read every one.' : 'How would you rate ReelCaster?'}
          </p>
          {!thanked && (
            <div role="radiogroup" aria-label="Rating" className="flex shrink-0 items-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => rate(n)}
                  className="flex h-9 w-8 items-center justify-center rounded text-rc-brand focus-visible:outline-2 focus-visible:outline-rc-brand"
                >
                  <Star
                    className="h-5 w-5"
                    fill={n <= rating ? 'currentColor' : 'none'}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          )}
          {closeButton}
        </div>
        {rating > 0 && !thanked && (
          <form
            className="pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="nudge-feedback-note" className="block text-[12px] text-rc-ink-soft">
              {rating >= 4 ? 'What do you like most?' : 'What would make it better?'}
            </label>
            {/* text-base: anything under 16px zooms the page on iOS focus. */}
            <textarea
              id="nudge-feedback-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={FEEDBACK_NOTE_MAX}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-rc-line-strong bg-rc-panel p-2 text-base text-rc-ink sm:text-[14px]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!feedbackId || sending}
                className="rounded-md bg-rc-brand px-4 py-2 text-[14px] font-semibold text-white hover:bg-rc-brand-hover disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${shell} ${className}`} data-testid={`nudge-${nudge}`}>
        {nudge === 'share' ? (
          <button type="button" onClick={open} className={`${linkClass} truncate`}>
            Share with a friend and get a free month of Pro ›
          </button>
        ) : (
          <button type="button" onClick={open} className={linkClass}>
            Have a fishing pic on your phone at this spot?{' '}
            <span className="font-normal">Log it and start building your catch log ›</span>
          </button>
        )}
        {closeButton}
      </div>
      {nudge === 'share' && (
        <ReferralModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          from="spot-nag"
          surface={SURFACE}
          onShared={() => log('done')}
        />
      )}
    </>
  );
}
