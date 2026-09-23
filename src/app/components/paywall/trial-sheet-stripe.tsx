'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MONTHLY_ON, TrialBuy, TrialCtaProvider, useTrialCta } from './trial-cta';
import BrandHeader from './brand-header';
import ChargeTerms from './charge-terms';
import PlanPicker from './plan-picker';
import { REMINDER_LEAD_DAYS, TRIAL_DAYS, dollars } from '@/lib/pricing';
import { PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';

/**
 * The rows, in Casey's words and order (reworked 2026-09-14). Not the plan
 * matrix rows: the matrix answers "what is the difference between two
 * columns", and these answer "what do I get", which is shorter and plainer.
 * Kept here rather than in plan-features because they belong to this sheet
 * (and ./plan-choice-modal, which draws the same list). The catch reports row
 * names the city the header stands in, and reads plain when there is none.
 * "And more..." closes the last row rather than standing as its own.
 *
 * The sheet itself stopped drawing these on 2026-09-22; see `sheetRows`. They
 * stay here for the plan step and the Pro upsell, which are read after the
 * decision rather than in front of it and have the room for six.
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
 * The sheet's own five rows, Casey's cut of the list above (2026-09-22): the
 * forecast row leads with the number of days, the alert and the private-spot
 * rows are written as what happens rather than what it is called, and the
 * smart-catch-logging row is gone — it is the one row that describes work the
 * reader does rather than something they get. Five rows and the timeline fit
 * the footer without scrolling on a 390x844 phone; six did not.
 */
function sheetRows(city: string | null): readonly string[] {
  return [
    city
      ? `All ${PRO_FORECAST_DAYS} days of the ${city} forecast`
      : `All ${PRO_FORECAST_DAYS} days of the forecast`,
    'A text when your spot turns hot',
    city ? `Daily ${city} catch reports` : 'Daily catch reports',
    'Private spots only you can see',
    'No ads, no locks',
  ];
}

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
export function OfferHeadline({ priceAmount }: { priceAmount: string }) {
  const s = useTrialCta();
  const monthly = s.plan === 'monthly';
  const paid = !monthly && !s.trialOn && !s.busy;
  const title = monthly
    ? `${dollars(s.monthlyCents)} a month`
    : paid
      ? `${priceAmount}/year`
      : `${TRIAL_DAYS} days free`;
  const eyebrow = paid ? 'ReelCaster Pro' : 'Try ReelCaster Pro';
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
 * The email field at the size Stripe Checkout draws its own: the button's
 * height and corner radius, 16px text so iOS does not zoom the page when the
 * field takes focus (see the global input floor).
 */
const INPUT = 'h-11 rounded-md px-3 text-[16px]';

/**
 * Stripe Checkout's pay button, in our blue, at the size the pinned footer
 * gives it: full width, 48px tall, 6px corners, 17px bold, a hairline shadow.
 * The reader taps this and lands on a page with the same button a moment
 * later.
 */
const BUTTON =
  'inline-flex h-12 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[17px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

/**
 * The phone trial sheet. One sheet for every phone reader since 2026-09-22.
 *
 * It began as arm b of `trial_sheet_stripe_v1` (2026-09-06), drawn the way
 * Stripe Checkout draws the page after it, and won that test on 2026-09-07:
 * 17 taps through in 60 exposures against 3 in 53. `sheet_timeline_v1`
 * (2026-09-22) then put it against a sheet redrawn around a trial timeline,
 * and Casey concluded it the same day by taking a piece of each: this sheet's
 * top, that sheet's body and footer, and neither one's blue Pro banner.
 *
 * TOP, from the Stripe-styled sheet:
 * - The grey drag handle and the dialog's own close, on the panel colour.
 * - Stripe's header (the round R mark and "ReelCaster", and the city the
 *   reader is standing in) at Stripe's sizes.
 * - Stripe's offer block, centred: "Try ReelCaster Pro" over "7 days free",
 *   or what the chosen card charges when it is not a free week.
 *
 * BODY AND FOOTER, from the timeline sheet:
 * - The two plan cards drawn as forecast day tiles (arm c of plan_picker_v3,
 *   concluded 2026-09-22), the chosen one filled brand blue with the Save
 *   badge as the gold tab the best day wears.
 * - Five rows rather than six (see `sheetRows`).
 * - A footer pinned to the bottom of the screen holding the three-step
 *   timeline (today, the reminder email, the first charge), the email field
 *   and the button. The button never scrolls away, and on a trial year the
 *   timeline is the disclosure: it names the charge date and the amount above
 *   the tap, with Terms and Privacy under it. Monthly, or a year with no
 *   trial, has no week to draw, so the one-line charge sentence takes its
 *   place (./charge-terms, which carries the same two links).
 *
 * The email field left on 2026-09-06 (Stripe asks for the address with the
 * card) and came back on 2026-09-07: without it, taps through to Stripe
 * doubled and the share that finished there fell from about 45% to about 10%,
 * so the sheet produced fewer trials per wall than before. Typing an address
 * is the small commitment that sorts a curious tap from a buyer, and it is
 * what lets the trial-eligibility pre-check run before Stripe offers a trial.
 *
 * One button: no wallet row above it and no "or pay by card" divider
 * (2026-09-06). Apple Pay is still offered on the page the button leads to.
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
  // The two cards, whenever the monthly price is for sale here. A wall that
  // hands in its own href sells nothing on this sheet, so there is nothing to
  // pick and the sheet draws the single button it always drew.
  const picker = MONTHLY_ON && !ctaHref;
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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-2">
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
            centred, as there. When it charges is in the footer's timeline. */}
        <OfferHeadline priceAmount={priceAmount} />

        {/* Yearly beside Monthly, under the title and over the rows, so the
            reader has chosen a card before they reach the button. Drawn as
            day tiles: see ./plan-picker. */}
        {/* The sheet's spare height is split evenly: as much white between the
            title and the cards as between the last row and the email field.
            The 20px basis stands in for the footer's own padding (pb-2 here,
            pt-3 there), which the lower gap already has. With no spare height
            both collapse to their minimum and the body scrolls as before. */}
        {picker && <div aria-hidden className="min-h-4 flex-1 basis-5" />}
        {picker && <PlanPicker look="tile" />}

        <p className="mt-5 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
          {PRO_ROWS_HEADING}
        </p>
        <ul className="mt-2 divide-y divide-rc-rule-soft">
          {sheetRows(city ?? null).map((row) => (
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
        {picker && <div aria-hidden className="flex-1 basis-0" />}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-rc-rule-soft bg-rc-panel px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(20,22,31,0.06)]">
        {ctaHref ? (
          <>
            <Link
              href={ctaHref}
              data-testid="pro-trial-cta"
              onClick={() => onCtaClick({ href: ctaHref, position: 'sheet' })}
              className={BUTTON}
            >
              {ctaLabel}
            </Link>
            <DialogDescription asChild>
              <ChargeTerms priceAmount={priceAmount} className="text-center" />
            </DialogDescription>
          </>
        ) : (
          <>
            {/* What happens and when, over the button rather than under it:
                the reader reads the charge date with the thumb already on the
                control that produces it. */}
            <Timeline priceAmount={priceAmount} />
            {/* No wallet row and no "or pay by card" divider above the
                button: one field and one button, the way Stripe's page
                opens. */}
            <TrialBuy
              signupLabel={ctaLabel}
              hideLabel
              placeholder="Enter your email"
              buttonClassName={BUTTON}
              inputClassName={INPUT}
            />
          </>
        )}
      </div>
    </TrialCtaProvider>
  );
}

/** "Sep 26", the way the charge date is written. */
function shortDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/**
 * Today, the reminder, the first charge. Only while the year is on a trial;
 * otherwise ./charge-terms' one-line sentence, since there is no week to draw.
 *
 * Terms and Privacy close it. The charge line carries that pair (2026-09-14,
 * the terms a renewing charge is made under belong in front of the reader,
 * not only on Stripe's page after the tap), and a timeline standing in its
 * place has to carry it too.
 */
function Timeline({ priceAmount }: { priceAmount: string }) {
  const s = useTrialCta();
  const trial = s.plan === 'annual' && (s.trialOn || s.busy);
  if (!trial) {
    return (
      <DialogDescription asChild>
        <ChargeTerms priceAmount={priceAmount} className="order-last text-center" />
      </DialogDescription>
    );
  }
  const steps = [
    { when: 'Today', what: 'Pro unlocked', detail: 'Full access, free' },
    {
      when: shortDate(s.trialDays - REMINDER_LEAD_DAYS),
      what: 'Reminder email',
      detail: 'Before any charge',
    },
    { when: s.chargeDate, what: 'Trial ends', detail: `${dollars(s.annualCents)} a year starts` },
  ];
  return (
    <>
      <DialogDescription asChild>
        <ol aria-label="How the trial works" className="mb-0.5 grid grid-cols-3 gap-x-1.5">
          {steps.map((step, i) => (
            <li key={step.what} className="flex min-w-0 flex-col gap-1">
              <span aria-hidden className="flex items-center gap-1.5">
                <span className={`size-[7px] shrink-0 rounded-full ${i === 0 ? 'bg-rc-brand' : 'bg-rc-rule'}`} />
                {i < steps.length - 1 && <span className="h-0.5 flex-1 bg-rc-rule-soft" />}
              </span>
              <span className="flex flex-col gap-px text-[12px] leading-[15px]">
                <strong className="font-extrabold text-rc-ink">{step.when}</strong>
                <span className="font-semibold text-rc-ink">{step.what}</span>
                <span className="text-rc-ink-soft">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </DialogDescription>
      {/* Grey and unruled, the way ./charge-terms sets the same pair: the fine
          print at the end of the fine print, on a screen whose one action is
          the button above it. */}
      <p className="order-last text-center text-[12px] leading-4 text-rc-ink-soft">
        <Link href="/terms" className="hover:text-rc-ink">
          Terms
        </Link>
        {' · '}
        <Link href="/privacy" className="hover:text-rc-ink">
          Privacy
        </Link>
      </p>
    </>
  );
}
