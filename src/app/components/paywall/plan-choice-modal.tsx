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
import { PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';
import { PLAN_LABELS } from '@/lib/plan-labels';
import type { NagFeatureId, PlanTierId } from '@/lib/plan-features';
import { TrialBuy, TrialCtaProvider } from './trial-cta';
import BrandHeader from './brand-header';
import ChargeTerms from './charge-terms';
import Testimonial from './testimonial';

/**
 * The second and last screen of arm b: the live trial sheet, with a way out
 * to a free account under it.
 *
 * WHAT IT IS. The join prompt before it says nothing about tiers on purpose —
 * a tapped star gets "Save this spot", "Join now", "Sign in". This is where
 * the offer is made, and it is not a lighter version of the offer: it is the
 * same screen the trial button on every other surface reaches, email field
 * and all, and its button opens Stripe directly. Casey's call (2026-09-08).
 * There is no third modal in this arm and no plan matrix: the reader goes
 * prompt, sheet, Stripe.
 *
 * IT IS ./trial-sheet-stripe's CONTENT, sharing its parts rather than
 * echoing them — <BrandHeader>, <TrialBuy>, <ChargeTerms>, <Testimonial>,
 * inside the same <TrialCtaProvider>. That sheet won `trial_sheet_stripe_v1`
 * and then won the email field back on 2026-09-07 (without it, taps to Stripe
 * doubled and completions per tap fell from about 45% to about 10%), so this
 * screen inherits both results rather than re-deciding them. What differs is
 * the order, below.
 *
 * THE ORDER. The button sits in the flow rather than in a pinned footer, and
 * the testimonial goes UNDER it instead of above. So the column reads: the
 * offer, what is in it, the email and the button, the proof, and then the way
 * to a free account. The sheet is taller to hold that — the reader who is
 * ready acts at the button and never sees the rest; the reader who hesitates
 * scrolls into exactly the two things that answer a hesitation.
 *
 * THE MEMBER BUTTON IS BARE. No heading over it, no sentence explaining what
 * a free account includes, no "not ready for Pro?". It had all three and they
 * came out (2026-09-08): every word of that was an argument for the cheaper
 * thing placed directly under the button for the dearer one. The button says
 * what it does, once, and anyone who wants it can read it.
 *
 * IT REPORTS UNDER THE WALL THAT RAISED IT — same `feature`, same `surface` —
 * so the chain from wall to checkout stays one story in the counter. `step:
 * plan_choice` marks this screen and `plan_choice_cta` the button taken. The
 * Stripe hop is marked `checkout_tap`, exactly as ./pro-trial-modal marks it,
 * because on this arm this IS the screen the card is reached from.
 */

/** What Pro adds. ./trial-sheet-stripe's rows, in Casey's order. */
const PRO_ROWS: readonly string[] = [
  'Daily catch reports',
  'Custom private spots',
  "Alerts when it's hot",
  `Full ${PRO_FORECAST_DAYS} day fishing forecast`,
  'Smart catch logging',
  'No ads, no locks, see everything',
];
const MORE_ROW = 'And more...';

/** Stripe Checkout's field and pay button, at ./trial-sheet-stripe's sizes. */
const STRIPE_INPUT = 'h-11 rounded-md px-3 text-[16px]';
const STRIPE_BUTTON =
  'inline-flex h-11 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[16px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';
/** Quieter by a whole step: no fill, no shadow, 15px rather than 16. */
const BUTTON_QUIET =
  'inline-flex h-10 w-full items-center justify-center rounded-md border border-rc-rule px-4 text-[15px] font-semibold text-rc-ink transition-colors hover:bg-rc-badge/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2';

export default function PlanChoiceModal({
  open,
  onOpenChange,
  feature,
  from,
  cityName,
  signupHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The wall that started this, unchanged from the prompt before it. */
  feature: NagFeatureId;
  from: string;
  /** The city the wall fired over, for the brand header to stand in. */
  cityName?: string;
  /** /signup carrying the reader back to where they were stopped. */
  signupHref: string;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();
  const phone = useIsPhone();
  const pricing = usePricing();

  const viewerTier: PlanTierId = isPaid ? 'pro' : user ? 'free' : 'anon';

  /** A reader who already has the account has nowhere to go but Pro. */
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

  /**
   * `checkout_tap` marks the hop to the card, and it is what Meta's
   * InitiateCheckout is fired off: the counter route answers a marked
   * cta_click with an event id, and lib/paywall-counter turns that id into
   * the tag (CHECKOUT_TAP_META_EVENT). On this arm the Pro button really is
   * that hop — there is no sheet after this one — so the mark belongs here.
   *
   * TWO THINGS ARE DELIBERATELY NOT MARKED. The Member link is a navigation,
   * not a purchase, and marking it would put an InitiateCheckout on a reader
   * who is not buying. And `method === 'signup'` is excluded even on the Pro
   * side, matching ./pro-trial-modal's own `trackCta`: <TrialBuy> reports
   * that method when it is selling an account rather than a subscription
   * (its `signupHref` branch), and a button that leads to /signup is not a
   * checkout however it was labelled on the way past. Nothing passes
   * `signupHref` here today, so this cannot fire yet — it is a guard on the
   * conversion the campaign bids on, in the one file that now produces it.
   */
  const takeCta = useCallback(
    (choice: 'member' | 'pro', method?: string) => {
      acted.current = true;
      trackEvent('Plan Choice Taken', { feature, from, viewerTier, choice, method });
      const isCheckoutTap = choice === 'pro' && method !== 'signup';
      reportPaywall('cta_click', {
        feature,
        surface: from,
        viewerTier,
        context: {
          step: 'plan_choice',
          plan_choice_cta: choice,
          ...(isCheckoutTap ? { checkout_tap: true } : {}),
        },
      });
    },
    [trackEvent, feature, from, viewerTier],
  );

  const body = (
    <TrialCtaProvider
      from={from}
      theme="light"
      onActivate={(method) => takeCta('pro', method)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <BrandHeader city={cityName} />

        {/* The offer, set the way Stripe Checkout sets it on the page this
            button leads to: what it is in grey, what it costs today in large
            type, centred, as there. */}
        <div className="mt-6 text-center">
          <p className="text-[19px] leading-6 font-medium text-rc-ink-soft">
            Try ReelCaster Pro
          </p>
          <DialogTitle className="mt-1 text-[36px] leading-[40px] font-bold tracking-[-0.02em] text-rc-ink">
            {TRIAL_DAYS} days free
          </DialogTitle>
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
          <li className="py-2">
            <span className="text-[15px] leading-5 font-medium text-rc-ink-soft">
              {MORE_ROW}
            </span>
          </li>
        </ul>

        {/* One field and one button, the way Stripe's page opens: no wallet
            row and no "or pay by card" divider. Apple Pay is still offered on
            the page this leads to for anyone whose device has it. */}
        <div className="mt-5">
          <TrialBuy
            signupLabel={`Start ${TRIAL_DAYS}-day free trial`}
            hideLabel
            testId="plan-choice-pro-cta"
            buttonClassName={STRIPE_BUTTON}
            inputClassName={STRIPE_INPUT}
          />
          {/* The first charge, under the button the way Stripe's page puts the
              terms under Start trial: the reader sees the date and the amount
              with the thumb already on the button that produces them. */}
          <DialogDescription asChild>
            <ChargeTerms priceAmount={pricing.amount} className="mt-3 text-center" />
          </DialogDescription>
        </div>

        {/* Under the button, not over it: the reader who is ready has already
            acted, and the one who hesitates scrolls straight into the proof. */}
        <Testimonial className="mt-5 rounded-xl border border-rc-rule-soft bg-rc-surface p-4" />

        {/* Bare. No heading, no explanation, no "not ready for Pro?" — every
            word of that was an argument for the cheaper thing sitting under
            the button for the dearer one. */}
        {!hasAccount && (
          <Link
            href={signupHref}
            onClick={() => takeCta('member')}
            data-testid="plan-choice-member-cta"
            className={`${BUTTON_QUIET} mt-4`}
          >
            Join as a {PLAN_LABELS.free}
          </Link>
        )}
      </div>
    </TrialCtaProvider>
  );

  if (phone) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          variant="sheet"
          data-testid="plan-choice-modal"
          data-shape="sheet"
          data-feature={feature}
          // Fixed and tall, the way ./pro-trial-modal sizes its sheet: the
          // column is longer than it was now that the testimonial sits below
          // the button, and a sheet that grew to its content would open as a
          // tray hanging part-way down the screen.
          className="bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 [&>[data-slot=dialog-close]]:z-20 h-[94dvh] max-h-[94dvh]"
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
        className="bg-rc-panel border-rc-rule text-rc-ink flex max-h-[90vh] flex-col gap-0 p-0 pt-5 sm:max-w-[440px]"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
