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
 * Choose a plan: the step between the join prompt and the trial sheet.
 *
 * WHY IT EXISTS. The join prompt that raises it says nothing about tiers on
 * purpose — a tapped star gets "Save this spot", "Join now", "Sign in", and
 * not a word about what anything costs. That leaves one question unanswered,
 * and this is where it is answered, once, on a screen built for it: Member or
 * Pro. Casey's call (2026-09-08).
 *
 * IT IS THE TRIAL SHEET'S DESIGN SYSTEM, deliberately and in detail: the same
 * Stripe-style brand header, the same ticked rows over `divide-rc-rule-soft`,
 * the same 44px button with the 6px radius, the same sheet on a phone and
 * centred dialog above it. These are consecutive screens of one flow — this
 * one leads directly into ./trial-sheet-stripe when Pro is chosen — and the
 * hand-off has to read as the next page rather than a different site. That is
 * the same argument the trial sheet makes about Stripe Checkout, one step
 * earlier in the same chain.
 *
 * THE TWO COLUMNS ARE MEMBER AND PRO, not "Free" and Pro, and the difference
 * matters: "Free" is what ../../../lib/plan-labels calls the state a reader is
 * already in — browsing, no account. Offering it back to them as a choice
 * would be offering them what they have. Member is the account, it is free,
 * and the price line says so in the plainest word available.
 *
 * IT SELLS NEITHER HARDER THAN THE OTHER by shape. Pro carries the price and
 * the trial and sits second, where the eye lands last on a phone; Member is a
 * real column with real rows rather than a link under a button. A reader who
 * came from a Pro-only wall will find Pro is the one that answers it, and the
 * rows say which is which without a cross anywhere on the screen — this is a
 * choice, not a comparison, and ProTrialModal's matrix is still one tap away
 * behind the Pro button.
 *
 * IT REPORTS UNDER THE WALL THAT RAISED IT — same `feature`, same `surface` —
 * so the whole chain from wall to trial stays one story in the counter. Its
 * own step is marked by `plan_choice` in the context, and the button taken by
 * `plan_choice_cta`.
 */

/** What a Member gets. Live today, all of it, and none of it behind a card. */
const MEMBER_ROWS: readonly string[] = [
  "Today's bite score at every spot",
  `${FREE_FORECAST_DAYS} days of forecast`,
  'Depth, structure and hourly tides',
  'Regulations before you go',
  'Smart catch logging',
];

/** What Pro adds. The trial sheet's own rows, in Casey's order. */
const PRO_ROWS: readonly string[] = [
  'Daily catch reports',
  'Custom private spots',
  "Alerts when it's hot",
  `Full ${PRO_FORECAST_DAYS} day fishing forecast`,
  'No ads, no locks, see everything',
];

const BUTTON_BASE =
  'inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-[16px] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2';
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-rc-brand text-white hover:bg-rc-brand-hover`;
const BUTTON_QUIET = `${BUTTON_BASE} border border-rc-rule bg-white text-rc-ink hover:bg-rc-badge/10`;

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
   * A reader who already has the account cannot join one. The Member column
   * stays on screen — it is what they have, and seeing it is how the Pro
   * column means anything — but its button says so and does nothing.
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
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <BrandHeader />

        <div className="mt-6 text-center">
          <DialogTitle className="text-[26px] leading-[30px] font-bold tracking-[-0.02em] text-rc-ink">
            Choose your plan
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-[14px] leading-5 text-rc-ink-soft">
            Both open the map. One opens all of it.
          </DialogDescription>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <PlanCard
            name={PLAN_LABELS.free}
            price="Free"
            priceNote="No card, ever"
            rows={MEMBER_ROWS}
            testId="plan-choice-member"
          >
            {hasAccount ? (
              <span
                className={`${BUTTON_QUIET} cursor-default opacity-60`}
                aria-disabled
              >
                Your plan
              </span>
            ) : (
              <Link
                href={signupHref}
                onClick={() => takeCta('member')}
                data-testid="plan-choice-member-cta"
                className={BUTTON_QUIET}
              >
                Join as a {PLAN_LABELS.free}
              </Link>
            )}
          </PlanCard>

          <PlanCard
            name={PLAN_LABELS.pro}
            price={`${TRIAL_DAYS} days free`}
            priceNote={`Then ${pricing.amount} a year. Cancel anytime.`}
            rows={PRO_ROWS}
            highlight
            testId="plan-choice-pro"
          >
            <button
              type="button"
              onClick={choosePro}
              data-testid="plan-choice-pro-cta"
              className={BUTTON_PRIMARY}
            >
              Start {TRIAL_DAYS}-day free trial
            </button>
          </PlanCard>
        </div>

        {/* Everything on the Member list is on the Pro list too. Said once,
            plainly, rather than drawn as fourteen rows of ticks and crosses:
            that table is the modal after this one, for a reader who wants it. */}
        <p className="mt-4 text-center text-[13px] leading-5 text-rc-ink-mute">
          Pro includes everything in {PLAN_LABELS.free}.
        </p>
      </div>
    </>
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
        className="bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 pt-5 sm:max-w-[720px]"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}

/**
 * One plan.
 *
 * Both cards sit on the sheet's own white. Member started on `bg-rc-surface`,
 * the grey the trial sheet tints its testimonial box with, and beside a
 * blue-bordered Pro card that grey read as disabled — a live choice greyed
 * out is a choice most readers will not make, and the whole point of this
 * screen is that both are real. `highlight` is now the only difference in
 * weight: a brand-coloured hairline and a wash of the brand tint, enough to
 * say which one we would pick without putting the other one out of play.
 */
function PlanCard({
  name,
  price,
  priceNote,
  rows,
  highlight,
  testId,
  children,
}: {
  name: string;
  price: string;
  priceNote: string;
  rows: readonly string[];
  highlight?: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={`flex flex-col rounded-xl border p-4 ${
        highlight
          ? 'border-rc-brand bg-rc-brand-soft/20'
          : 'border-rc-rule bg-rc-panel'
      }`}
    >
      <p className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
        {name}
      </p>
      <p className="mt-1 text-[24px] leading-7 font-bold tracking-[-0.02em] text-rc-ink">
        {price}
      </p>
      <p className="mt-0.5 text-[13px] leading-[18px] text-rc-ink-soft">
        {priceNote}
      </p>

      <ul className="mt-3 flex-1 space-y-1.5">
        {rows.map((row) => (
          <li key={row} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft"
            >
              <Check className="size-3 text-rc-brand" strokeWidth={3} />
            </span>
            <span className="text-[14px] leading-5 font-medium text-rc-ink">
              {row}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4">{children}</div>
    </div>
  );
}
