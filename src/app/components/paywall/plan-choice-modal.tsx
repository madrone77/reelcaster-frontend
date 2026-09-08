'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useAnalytics } from '@/hooks/use-analytics';
import { useIsPhone } from '@/hooks/use-is-phone';
import { reportPaywall } from '@/lib/paywall-counter';
import { usePricing } from '@/app/components/split-test/use-pricing';
import { TRIAL_DAYS } from '@/lib/pricing';
import { FREE_FORECAST_DAYS, PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';
import { PLAN_LABELS } from '@/lib/plan-labels';
import type { NagFeatureId, PlanTierId } from '@/lib/plan-features';
import BrandHeader from './brand-header';

/**
 * The step between the join prompt and the trial sheet: Pro, offered
 * properly, with the Member account available underneath it.
 *
 * WHY IT EXISTS. The join prompt that raises it says nothing about tiers on
 * purpose — a tapped star gets "Save this spot", "Join now", "Sign in", and
 * not a word about what anything costs. That leaves one question unanswered,
 * and this is where it is answered.
 *
 * PRO IS THE PITCH. Casey's call (2026-09-08): Pro on top, Member an option
 * and not a top choice. So this is not a two-column chooser — it was, for
 * about an hour, and two equal cards side by side make the free one win by
 * default on price alone. The screen is the Pro offer, drawn the way the
 * trial sheet draws it, with the Member account as a quiet line under a rule
 * at the bottom. Member is genuinely reachable, in one tap, named and priced
 * honestly. It is simply not what the screen is arguing for.
 *
 * The demotion is done with weight, not with obstruction: no crosses against
 * the Member line, no confirm-shaming on the way to it, no "no thanks, I
 * don't want to catch fish". It gets a heading, a true sentence about what it
 * includes and a full-width button of its own — just a quiet one, below the
 * fold of the argument rather than beside it.
 *
 * IT IS THE TRIAL SHEET'S DESIGN SYSTEM, deliberately and in detail: the same
 * Stripe-style brand header, the same centred offer block ("Try ReelCaster
 * Pro" over the days), the same ticked rows, the same 44px button with the
 * 6px radius, the same sheet on a phone and centred dialog above it. This
 * screen leads directly into ./trial-sheet-stripe, so the hand-off has to
 * read as the next page rather than a different site — the same argument the
 * trial sheet makes about Stripe Checkout, one step earlier in the chain.
 *
 * WHAT IT IS NOT is the fourteen-row plan matrix. That is still in
 * ./pro-trial-modal, one tap further on, for a reader who wants the full
 * comparison. Six rows and a price is what this step needs.
 *
 * IT REPORTS UNDER THE WALL THAT RAISED IT — same `feature`, same `surface` —
 * so the whole chain from wall to trial stays one story in the counter. Its
 * own step is marked by `plan_choice` in the context, and the button taken by
 * `plan_choice_cta`.
 */

/** What Pro adds. The trial sheet's own rows, in Casey's order. */
const PRO_ROWS: readonly string[] = [
  'Daily catch reports',
  'Custom private spots',
  "Alerts when it's hot",
  `Full ${PRO_FORECAST_DAYS} day fishing forecast`,
  'Smart catch logging',
  'No ads, no locks, see everything',
];

/**
 * Stripe Checkout's pay button in our blue, the shape ./trial-sheet-stripe
 * uses: the reader taps this and lands on a page with the same button.
 */
const BUTTON_BASE =
  'inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2';
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-rc-brand text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-rc-brand-hover`;
/** Quieter by a whole step: no fill, no shadow, 15px rather than 16. */
const BUTTON_QUIET =
  'inline-flex h-10 w-full items-center justify-center rounded-md border border-rc-rule px-4 text-[15px] font-semibold text-rc-ink transition-colors hover:bg-rc-badge/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2';

export default function PlanChoiceModal({
  open,
  onOpenChange,
  feature,
  from,
  signupHref,
  onChoosePro,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The wall that started this, unchanged from the prompt before it. */
  feature: NagFeatureId;
  from: string;
  /** /signup carrying the reader back to where they were stopped. */
  signupHref: string;
  /** Opens the trial sheet. The parent does the swap. */
  onChoosePro: () => void;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();
  const phone = useIsPhone();
  const pricing = usePricing();

  const viewerTier: PlanTierId = isPaid ? 'pro' : user ? 'free' : 'anon';

  /**
   * A reader who already has the account cannot join one, so the Member line
   * says what they are rather than offering it. It stays on screen: dropping
   * it would leave a Pro pitch with no stated alternative, which is a harder
   * sell than one that names the thing you already have.
   */
  const hasAccount = Boolean(user);

  const openedAt = useRef<number | null>(null);
  const acted = useRef(false);

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    acted.current = false;
    trackEvent('Plan Choice Shown', { feature, from, viewerTier });
    reportPaywall('impression', {
      feature,
      surface: from,
      viewerTier,
      context: { step: 'plan_choice' },
    });
  }, [open, feature, from, viewerTier, trackEvent]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !acted.current) {
        reportPaywall('dismiss', {
          feature,
          surface: from,
          viewerTier,
          context: { step: 'plan_choice' },
          dwellMs: openedAt.current ? Date.now() - openedAt.current : undefined,
        });
      }
      onOpenChange(next);
    },
    [feature, from, viewerTier, onOpenChange],
  );

  const takeCta = useCallback(
    (choice: 'member' | 'pro') => {
      acted.current = true;
      trackEvent('Plan Choice Taken', { feature, from, viewerTier, choice });
      reportPaywall('cta_click', {
        feature,
        surface: from,
        viewerTier,
        // Never `checkout_tap: true`. There is no card on this screen; the tap
        // that counts as the hop to Stripe is the one on the sheet after it.
        context: { step: 'plan_choice', plan_choice_cta: choice },
      });
    },
    [trackEvent, feature, from, viewerTier],
  );

  const choosePro = useCallback(() => {
    takeCta('pro');
    onChoosePro();
  }, [takeCta, onChoosePro]);

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <BrandHeader />

      {/* The offer, set the way the trial sheet sets it and the way Stripe
          Checkout sets it on the page two steps from here: what it is in
          grey, what it costs today in large type, centred. */}
      <div className="mt-6 text-center">
        <p className="text-[19px] leading-6 font-medium text-rc-ink-soft">
          Try ReelCaster Pro
        </p>
        <DialogTitle className="mt-1 text-[36px] leading-[40px] font-bold tracking-[-0.02em] text-rc-ink">
          {TRIAL_DAYS} days free
        </DialogTitle>
        <DialogDescription className="mt-2 text-[14px] leading-5 text-rc-ink-soft">
          Then {pricing.amount} a year. Cancel anytime before the trial ends
          and you pay nothing.
        </DialogDescription>
      </div>

      <p className="mt-6 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
        Everything in Pro
      </p>
      <ul className="mt-2 divide-y divide-rc-rule-soft">
        {PRO_ROWS.map((row) => (
          <li key={row} className="flex items-center justify-between gap-3 py-2">
            <span className="text-[15px] leading-5 font-medium text-rc-ink">
              {row}
            </span>
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft"
            >
              <Check className="size-3 text-rc-brand" strokeWidth={3} />
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={choosePro}
        data-testid="plan-choice-pro-cta"
        className={`${BUTTON_PRIMARY} mt-5`}
      >
        Start {TRIAL_DAYS}-day free trial
      </button>

      {/* ── The other way in ─────────────────────────────────────────────
          Under a rule, at a smaller size, after the argument rather than
          beside it. Still one tap, still named and priced honestly, still
          without a single word discouraging it. Just not the pitch. */}
      <div className="mt-5 border-t border-rc-rule-soft pt-4">
        {hasAccount ? (
          <p
            className="text-center text-[13px] leading-5 text-rc-ink-mute"
            data-testid="plan-choice-member-current"
          >
            You are on the {PLAN_LABELS.free} plan. It stays free.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-5 text-rc-ink-soft">
              Not ready for Pro? A {PLAN_LABELS.free} account is free and needs
              no card: today&rsquo;s score at every spot, {FREE_FORECAST_DAYS}{' '}
              days of forecast, depth and hourly tides.
            </p>
            <Link
              href={signupHref}
              onClick={() => takeCta('member')}
              data-testid="plan-choice-member-cta"
              className={`${BUTTON_QUIET} mt-3`}
            >
              Join as a {PLAN_LABELS.free} instead
            </Link>
          </>
        )}
      </div>
    </div>
  );

  if (phone) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          variant="sheet"
          data-testid="plan-choice-modal"
          data-shape="sheet"
          data-feature={feature}
          className="bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 [&>[data-slot=dialog-close]]:z-20 max-h-[94dvh]"
        >
          <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-rc-rule" />
          </div>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="plan-choice-modal"
        data-shape="dialog"
        data-feature={feature}
        className="bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 pt-5 sm:max-w-[440px]"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
