'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MONTHLY_ON, TrialBuy, TrialCtaProvider, useTrialCta } from './trial-cta';
import Testimonial from './testimonial';
import BrandHeader from './brand-header';
import ChargeTerms from './charge-terms';
import PlanPicker from './plan-picker';
import { TRIAL_DAYS, dollars } from '@/lib/pricing';
import { PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';
import { usePlanPicker } from '@/app/components/split-test/use-plan-picker';

/**
 * The rows, in Casey's words and order (reworked 2026-09-14). Not the plan
 * matrix rows: the matrix answers "what is the difference between two
 * columns", and these answer "what do I get", which is shorter and plainer.
 * Kept here rather than in plan-features because they belong to this sheet
 * (and ./plan-choice-modal, which draws the same list). The catch reports row
 * names the city the header stands in, and reads plain when there is none.
 * "And more..." closes the last row rather than standing as its own.
 */
export function proRows(city?: string): readonly string[] {
  return [
    `See full ${PRO_FORECAST_DAYS} day fishing forecast`,
    'Custom private spots',
    "SMS alerts when it's hot",
    city ? `Daily ${city} catch reports` : 'Daily catch reports',
    'Smart catch logging',
    'No ads, no locks, and more...',
  ];
}
export const PRO_ROWS_HEADING = 'What you get with Pro';

/**
 * "Try ReelCaster Pro / 7 days free", or the paid offer when this buyer has no
 * trial: an address checkout just refused a trial for, or a signed-in account
 * that has had one. Reads the same state as the button, so a headline in 36px
 * type can no longer promise a free week above a button that says "Get Pro ·
 * $33/year". Reads the plan off the provider too, so the title follows the
 * picker: with Monthly chosen it says what that card charges ("$6.00 a
 * month"), the annual card's sentence being the free week. Must render inside
 * a TrialCtaProvider; shared with ./plan-choice-modal, which sets the same
 * offer block.
 */
export function OfferHeadline({
  priceAmount,
  compact = false,
}: {
  priceAmount: string;
  /** Plan cards drawn under this: they already say "7 days free" and "$6 a
   *  month", so the 36px title steps aside (kept for screen readers) and the
   *  sheet fits a phone without scrolling. */
  compact?: boolean;
}) {
  const s = useTrialCta();
  const monthly = s.plan === 'monthly';
  const paid = !monthly && !s.trialOn && !s.busy;
  const title = monthly
    ? `${dollars(s.monthlyCents)} a month`
    : paid
      ? `${priceAmount}/year`
      : `${TRIAL_DAYS} days free`;
  const eyebrow = paid ? 'ReelCaster Pro' : 'Try ReelCaster Pro';
  if (compact) {
    return (
      <div className="mt-4 text-center">
        <p className="text-[19px] leading-6 font-semibold text-rc-ink">{eyebrow}</p>
        <DialogTitle className="sr-only">{title}</DialogTitle>
      </div>
    );
  }
  return (
    <div className="mt-6 text-center">
      <p className="text-[19px] leading-6 font-medium text-rc-ink-soft">
        {eyebrow}
      </p>
      <DialogTitle className="mt-1 text-[36px] leading-[40px] font-bold tracking-[-0.02em] text-rc-ink">
        {title}
      </DialogTitle>
    </div>
  );
}

/**
 * Stripe Checkout's pay button, in our blue: full width, 44px tall, 6px
 * corners, 16px semibold, a hairline shadow. The reader taps this and lands on
 * a page with the same button a moment later.
 */
/**
 * The email field at the size Stripe Checkout draws its own: the button's
 * height and corner radius, 16px text so iOS does not zoom the page when the
 * field takes focus (see the global input floor).
 */
const STRIPE_INPUT = 'h-11 rounded-md px-3 text-[16px]';

const STRIPE_BUTTON =
  'inline-flex h-11 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[16px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

/**
 * The phone trial sheet, drawn the way Stripe Checkout draws the page after
 * it. It began as arm b of `trial_sheet_stripe_v1` (2026-09-06) against the
 * sheet that won trial_sheet_pro_v1 (a PRO badge, a headline naming the
 * city, the terms in two lines, six ticked rows, a testimonial, an email
 * field and the buy button), and won it on 2026-09-07: 17 taps through in 60
 * exposures against 3 in 53. It is now the only phone sheet. It keeps the
 * rows and the testimonial and changes everything around them to match the
 * screen the button leads to:
 *
 * - Stripe's header (the round R mark and "ReelCaster") at Stripe's sizes.
 * - Stripe's offer block, centred: "Try ReelCaster Pro" over "7 days free".
 * - Stripe's button shape, in our blue, with the first charge stated under
 *   it rather than over the headline. One button: no wallet row above it and
 *   no "or pay by card" divider (2026-09-06).
 * - An email field over the button, at Stripe's field height and radius. It
 *   left on 2026-09-06 (Stripe asks for the address with the card) and came
 *   back on 2026-09-07: without it, taps through to Stripe doubled and the
 *   share that finished there fell from about 45% to about 10%, so the sheet
 *   produced fewer trials per wall than before. Typing an address is the
 *   small commitment that sorts a curious tap from a buyer, and it is what
 *   lets the trial-eligibility pre-check run before Stripe offers a trial.
 * - The rows in Casey's order, with "And more..." closing the list.
 * - A sheet that fills the screen to just under the header (the modal sets
 *   the height when this arm renders).
 *
 * The guess, which held: a sheet that reads as the first page of checkout,
 * rather than a tray with a form in it, gets more taps through to Stripe, and
 * a screen fewer between the tap and the card gets more of those to a trial.
 */
export default function TrialSheetStripe({
  placeName,
  placeKind,
  cityName,
  headline,
  from,
  region,
  ctaHref,
  ctaLabel,
  priceAmount,
  onCtaClick,
  onActivate,
}: {
  /** Where the reader opened this from. The headline does not name it (it is
      set the way Stripe's page sets the offer), but the brand header does:
      these three are how it knows which city to stand in. */
  placeName?: string;
  placeKind?: 'spot' | 'city';
  cityName?: string;
  /** One line naming what the wall unlocks, over the offer. Only the
   *  locked-pin walls pass it; every other sheet reads as before. */
  headline?: string;
  from: string;
  region?: string;
  ctaHref?: string;
  ctaLabel: string;
  priceAmount: string;
  onCtaClick: (extra: Record<string, unknown>) => void;
  onActivate: (method: 'annual' | 'monthly' | 'wallet' | 'signup') => void;
}) {
  const city = cityName ?? (placeKind === 'city' ? placeName : undefined);
  // The two-card picker, when this reader is in that arm and the monthly
  // price is for sale. A wall that hands in its own href sells nothing here,
  // so the picker has nothing to pick and the arm is not counted.
  const { picker, look, reportPress } = usePlanPicker(MONTHLY_ON && !ctaHref);
  return (
    <TrialCtaProvider
      from={from}
      region={region}
      theme="light"
      onActivate={(method) => {
        reportPress();
        onActivate(method);
      }}
    >
      <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-rc-rule" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {/* An explicit city wins; otherwise the place is a city only when the
            caller did not name a spot. Same resolution the feature list makes
            in ./pro-trial-modal, so the two never disagree on one screen. */}
        <BrandHeader city={city} />

        {headline && (
          <p className="mt-5 text-center text-[22px] leading-7 font-bold tracking-[-0.02em] text-rc-ink text-balance">
            {headline}
          </p>
        )}

        {/* The offer, set the way Stripe Checkout sets it on the page after
            this one: what it is in grey, what it costs today in large type,
            centred, as there. The first charge is stated under the button. */}
        <OfferHeadline priceAmount={priceAmount} compact={picker} />

        {/* Arms b and c of plan_picker_v3: Yearly beside Monthly, under the title
            and over the rows, so the reader has chosen a card before they
            reach the button. See ./plan-picker. */}
        {picker && <PlanPicker look={look} className="mt-4" />}

        <p className="mt-5 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
          {PRO_ROWS_HEADING}
        </p>
        <ul className="mt-2 divide-y divide-rc-rule-soft">
          {proRows(city).map((row) => (
            <li
              key={row}
              className="flex items-center justify-between gap-3 py-1.5"
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

        <Testimonial className="mt-3" />
      </div>

      <div className="shrink-0 border-t border-rc-rule-soft px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {ctaHref ? (
          <Link
            href={ctaHref}
            data-testid="pro-trial-cta"
            onClick={() => onCtaClick({ href: ctaHref, position: 'sheet' })}
            className={STRIPE_BUTTON}
          >
            {ctaLabel}
          </Link>
        ) : (
          // No wallet row and no "or pay by card" divider above the button:
          // one field and one button, the way Stripe's page opens. Apple Pay
          // is still offered on that page for anyone whose device has it.
          <TrialBuy
            signupLabel={ctaLabel}
            hideLabel
            buttonClassName={STRIPE_BUTTON}
            inputClassName={STRIPE_INPUT}
          />
        )}
        {/* The first charge, under the button the way Stripe's page puts the
            terms under Start trial: the reader sees the date and the amount
            with the thumb already on the button that produces them. */}
        <DialogDescription asChild>
          <ChargeTerms priceAmount={priceAmount} className="mt-3 text-center" />
        </DialogDescription>
      </div>
    </TrialCtaProvider>
  );
}
