'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  TrialBuy,
  TrialCtaProvider,
  TrialExpress,
  useTrialCta,
} from './trial-cta';
import Testimonial from './testimonial';
import { TRIAL_DAYS } from '@/lib/pricing';
import { PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';

/**
 * The six rows, in Casey's words (2026-09-04). Not the plan matrix rows: the
 * matrix answers "what is the difference between two columns", and these
 * answer "what do I get", which is shorter and plainer. Kept here rather than
 * in plan-features because they belong to this arm and to nothing else.
 */
const PRO_ROWS: readonly string[] = [
  `Full ${PRO_FORECAST_DAYS} day fishing enriched forecast`,
  'No ads, no locks, see everything',
  'Your own private custom spots',
  "SMS and email alerts when it's hot",
  'Daily catch reports (where available)',
  'Smart catch logging',
];

/**
 * The registry key of the split this sheet is the treatment arm of.
 *
 * Arm `a` is ./trial-sheet, unchanged. Arm `b` is this file. The modal reads
 * the arm and picks; nothing else knows the test exists. Stop the test with
 * an UPDATE on `split_tests` and every phone gets arm `a` again.
 */
export const TRIAL_SHEET_TEST = 'trial_sheet_pro_v1';

/**
 * The phone trial sheet, arm b: the whole Pro tier on one screen, with a
 * customer saying so.
 *
 * The control (./trial-sheet) argues in three lines and a timeline. It reads
 * clean and it does not convert, and the guess this arm tests is that clean
 * is the problem: three rows undersell a tier with seven things in it, and a
 * timeline of what it costs is a screen spent on the objection rather than
 * on the offer. So this arm names the tier, lists every Pro-only row the plan
 * matrix has, each with a tick and nothing under it, and gives the space the
 * timeline had to a real customer's words instead.
 *
 * What it keeps from the control, deliberately:
 *
 * - The headline and the comparison line, so the two arms differ in the
 *   argument and not in what the reader is told they are looking at.
 * - The charge disclosure. A card-required trial that auto-charges has to say
 *   the date and the amount before the tap. The timeline was where the
 *   control said it; here it is one line over the button, read by the same
 *   hook, so the date is the date the button produces.
 * - The pinned controls, wallet first.
 *
 * The seven rows are `PLAN_FEATURES` up to `SHARED_ROW_START`, read rather
 * than copied so the sheet and the matrix cannot disagree about what Pro is.
 */
export default function TrialSheetPro({
  placeName,
  placeKind = 'spot',
  cityName,
  from,
  region,
  ctaHref,
  ctaLabel,
  priceAmount,
  onCtaClick,
  onActivate,
}: {
  placeName?: string;
  placeKind?: 'spot' | 'city';
  /** The city the headline names. Falls back to the place when it is one. */
  cityName?: string;
  from: string;
  region?: string;
  ctaHref?: string;
  ctaLabel: string;
  priceAmount: string;
  onCtaClick: (extra: Record<string, unknown>) => void;
  onActivate: (method: 'annual' | 'wallet' | 'signup') => void;
}) {
  // The headline names the city, not the spot: intel (reports, alerts,
  // forecasts) is gathered per city, so the city is the true subject even
  // when the reader opened this from a spot.
  const city = cityName ?? (placeKind === 'city' ? placeName : undefined) ?? placeName;

  return (
    <TrialCtaProvider
      from={from}
      region={region}
      theme="light"
      onActivate={onActivate}
    >
      <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-rc-rule" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <div className="flex items-center gap-2 pr-10">
          <span className="rounded bg-rc-brand px-1.5 py-0.5 font-rc-mono text-[10px] font-bold tracking-[0.14em] text-white uppercase">
            Pro
          </span>
          <p className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
            {TRIAL_DAYS}-day free trial
          </p>
        </div>

        <DialogTitle className="mt-2 pr-10 font-black tracking-[-0.02em] text-balance text-rc-ink text-[22px] leading-[28px]">
          Try a free week of Pro to unlock{' '}
          {city ? (
            <>
              <span className="text-rc-brand">{city}</span>{' '}
            </>
          ) : null}
          fishing intel
        </DialogTitle>

        {/* The terms, right under the headline: what today costs, what the
            charge day costs, and how to never reach it. The control keeps
            this in a timeline at the foot; here it is the second thing read.
            It is the sheet's accessible description for the same reason. */}
        <DialogDescription asChild>
          <ChargeTerms priceAmount={priceAmount} className="mt-2.5" />
        </DialogDescription>

        <p className="mt-4 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
          Everything in Pro
        </p>
        <ul className="mt-2 divide-y divide-rc-rule-soft">
          {PRO_ROWS.map((row) => (
            <li
              key={row}
              className="flex items-center justify-between gap-3 py-2"
            >
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

        <Testimonial className="mt-4 rounded-xl border border-rc-rule-soft bg-rc-surface p-4" />
      </div>

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
 * The terms in two lines, read from the same hook the buy button uses so the
 * date is the one the button produces.
 *
 * The price is shown to the cent ("$33.00") because a charge is a charge and
 * a whole-dollar figure next to "$0.00" reads as a different kind of number.
 * `dollars()` drops the cents on whole amounts for the pitch elsewhere.
 */
function ChargeTerms({
  priceAmount,
  className,
  ...rest
}: { priceAmount: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const { chargeDate, trialOn } = useTrialCta();
  const price = /\.\d{2}$/.test(priceAmount) ? priceAmount : `${priceAmount}.00`;
  const when = trialOn && chargeDate ? chargeDate : `Day ${TRIAL_DAYS}`;
  return (
    <div {...rest} className={`text-[13px] leading-[18px] ${className ?? ''}`}>
      <p className="font-semibold text-rc-ink">
        Today: $0.00 ({TRIAL_DAYS} Days Free)
        <span className="mx-1.5 text-rc-ink-mute" aria-hidden>
          •
        </span>
        {when}: {price}/yr
      </p>
      <p className="mt-0.5 text-rc-ink-mute">
        Cancel anytime before {when} to never be charged.
      </p>
    </div>
  );
}
