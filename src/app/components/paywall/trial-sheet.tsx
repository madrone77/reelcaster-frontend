'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { DialogTitle } from '@/components/ui/dialog';
import {
  TrialBuy,
  TrialCtaProvider,
  TrialExpress,
  useTrialCta,
} from './trial-cta';
import { sheetFeatures, type PlanTierId } from '@/lib/plan-features';
import { PLAN_LABELS } from '@/lib/plan-labels';
import { REMINDER_LEAD_DAYS, TRIAL_DAYS } from '@/lib/pricing';
import {
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from '@/lib/forecast-horizon';

/**
 * The phone shape of the trial offer: a bottom sheet, wallet first.
 *
 * Same modal, same triggers, same analytics as the centred dialog in
 * `pro-trial-modal` — this is a different arrangement of the same offer for a
 * screen you hold in one hand, not a second paywall. `ProTrialModal` picks
 * between the two and owns everything either of them reports.
 *
 * Three deliberate departures from the desktop dialog:
 *
 * **No plan matrix.** Fourteen rows is a comparison, and a comparison wants a
 * page. What a phone has room to answer is "what happens if I tap this", so
 * the argument here is three lines of what paying adds and a timeline of what
 * it costs and when. `/plans` is still one tap away and still carries the
 * table.
 *
 * **The wallet is back, and it leads.** #467 took Apple Pay off the centred
 * dialog because the wallet row, its divider and the email form stacked into
 * three asks above the table. That objection does not survive the table
 * coming out: with the checkout pinned to the bottom edge there is one block
 * of controls, at the bottom of the screen, where a thumb already is.
 * `TrialExpress` renders nothing when no wallet exists, and its own divider
 * goes with it, so a device without Apple Pay sees a single card button.
 *
 * **The charge date is a row, not a footnote.** A card-required trial that
 * auto-charges has to say the date and the amount before the tap. It is in
 * `TrialTerms` under the button as well, because that is the disclosure that
 * rides with the control; the timeline is the same fact where a reader will
 * actually meet it.
 */

/** The day the reminder email goes out. Both numbers come from the sender. */
const REMINDER_DAY = TRIAL_DAYS - REMINDER_LEAD_DAYS;

/** What the reader has today, in the two numbers the headline argues about. */
function viewerPlan(tier: PlanTierId) {
  return tier === 'anon'
    ? { label: PLAN_LABELS.anon, days: ANON_FORECAST_DAYS }
    : { label: PLAN_LABELS.free, days: FREE_FORECAST_DAYS };
}

export default function TrialSheet({
  viewerTier,
  spotName,
  spotRegion,
  from,
  region,
  ctaHref,
  ctaLabel,
  priceAmount,
  onCtaClick,
  onActivate,
}: {
  viewerTier: PlanTierId;
  spotName?: string;
  /** City or province under the headline, when the surface knows it. */
  spotRegion?: string;
  from: string;
  region?: string;
  /** Set when the surface sends the reader somewhere instead of selling here. */
  ctaHref?: string;
  ctaLabel: string;
  /** Formatted price for this reader, already currency-resolved. */
  priceAmount: string;
  onCtaClick: (extra: Record<string, unknown>) => void;
  onActivate: (method: 'annual' | 'wallet' | 'signup') => void;
}) {
  const plan = viewerPlan(viewerTier);
  const features = sheetFeatures(plan.days, plan.label);

  return (
    <TrialCtaProvider
      from={from}
      region={region}
      theme="light"
      onActivate={onActivate}
    >
      {/* Grab handle. Decorative: the sheet closes by the X, the scrim or
          Escape, all three of which the dialog primitive already owns. */}
      <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-rc-rule" />
      </div>

      {/* Everything above the controls scrolls; the controls do not. On the
          shortest phones that is the difference between the buy button being
          on screen and being a scroll away. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <p className="pr-10 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
          {TRIAL_DAYS}-day free trial
        </p>

        {/* The spot is the subject, and it is set in brand blue because it is
            the one word on the sheet the reader chose. A surface with no spot
            in hand (the viewport strip on /explore, a marketing page) drops
            the phrase rather than inventing a subject. */}
        <DialogTitle className="mt-2 pr-10 text-[22px] leading-[28px] font-black tracking-[-0.02em] text-balance text-rc-ink">
          See the next {PRO_FORECAST_DAYS} days
          {spotName ? (
            <>
              {' at '}
              <span className="text-rc-brand">{spotName}</span>
            </>
          ) : null}
        </DialogTitle>

        <p className="mt-1.5 text-sm leading-5 text-rc-ink-soft">
          {spotRegion ? `${spotRegion} · ` : ''}
          {plan.label} shows {plan.days} days. Pro shows {PRO_FORECAST_DAYS}.
        </p>

        <ul className="mt-4 space-y-2.5">
          {features.map((f) => (
            <li key={f.id} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft"
              >
                <Check className="size-3 text-rc-brand" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] leading-5 font-semibold text-rc-ink">
                  {f.title}
                </span>
                <span className="block text-[13px] leading-[18px] text-rc-ink-mute">
                  {f.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <Timeline priceAmount={priceAmount} />
      </div>

      {/* The controls, pinned to the bottom edge. Wallet first: the buyer who
          has one never types anything. */}
      <div className="shrink-0 border-t border-rc-rule-soft px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {ctaHref ? (
          <Link
            href={ctaHref}
            data-testid="pro-trial-cta"
            onClick={() => onCtaClick({ href: ctaHref, position: 'sheet' })}
            className="block rounded-lg bg-rc-brand px-4 py-3 text-center text-[15px] font-bold text-white transition-colors hover:bg-rc-brand-hover"
          >
            {ctaLabel}
          </Link>
        ) : (
          <>
            <TrialExpress region={region} className="mb-3" />
            <TrialBuy signupLabel={ctaLabel} hideLabel />
          </>
        )}

      </div>
    </TrialCtaProvider>
  );
}

/**
 * What happens, and when, on three rows.
 *
 * The reason this earns its space on a phone: the objection to a card-required
 * trial is never the price, it is not knowing when the price arrives. A reader
 * who can see the reminder lands before the charge does not have to trust us
 * about it.
 */
function Timeline({ priceAmount }: { priceAmount: string }) {
  // Inside the provider, so this is the same resolution the buy button uses.
  const { chargeDate, trialOn } = useTrialCta();
  const rows = [
    {
      key: 'today',
      when: 'Today',
      amount: '$0.00',
      note: `Pro unlocks now. Nothing is charged for ${TRIAL_DAYS} days.`,
      tone: 'now' as const,
    },
    {
      key: 'reminder',
      when: `Day ${REMINDER_DAY}`,
      amount: 'Email reminder',
      note: '',
      tone: 'pending' as const,
    },
    {
      key: 'charge',
      when: `Day ${TRIAL_DAYS}`,
      amount: `${priceAmount}/yr`,
      // The disclosure that used to sit under the button, in the row that was
      // already making its point. "Day 7" is a countdown, not a date, and the
      // date is the half a reader needs to put it in a calendar.
      note: trialOn && chargeDate
        ? `Charged ${chargeDate}. Cancel any time before then and you pay nothing.`
        : 'Cancel any time before this and you pay nothing.',
      tone: 'charge' as const,
    },
  ];

  return (
    <div className="mt-4 rounded-xl border border-rc-rule-soft bg-rc-surface p-4">
      <ol className="relative">
        <span
          aria-hidden
          className="absolute top-2 bottom-3 left-[7px] w-px bg-rc-rule"
        />
        {rows.map((row, i) => (
          <li
            key={row.key}
            className={`relative flex gap-3 pl-6 ${i === 0 ? '' : 'pt-3.5'}`}
          >
            <span
              aria-hidden
              className={`absolute left-0 size-[15px] rounded-full border-2 ${
                i === 0 ? 'top-[2px]' : 'top-[16px]'
              } ${
                row.tone === 'now'
                  ? 'border-rc-brand bg-rc-brand'
                  : row.tone === 'charge'
                    ? 'border-rc-ink bg-rc-panel'
                    : 'border-rc-rule bg-rc-panel'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
                  {row.when}
                </span>
                <span
                  className={`text-sm leading-5 font-semibold ${
                    row.tone === 'now' ? 'text-rc-good-ink' : 'text-rc-ink'
                  }`}
                >
                  {row.amount}
                </span>
              </div>
              {row.note && (
                <p className="mt-0.5 text-xs leading-4 text-rc-ink-mute">
                  {row.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
