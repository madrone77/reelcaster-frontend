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
 * The rows, in Casey's words and order (2026-09-06). Not the plan matrix
 * rows: the matrix answers "what is the difference between two columns", and
 * these answer "what do I get", which is shorter and plainer. Kept here
 * rather than in plan-features because they belong to this sheet and to
 * nothing else. The last row is "And more...", drawn without a tick.
 */
const PRO_ROWS: readonly string[] = [
  'Daily catch reports',
  'Custom private spots',
  "Alerts when it's hot",
  `Full ${PRO_FORECAST_DAYS} day fishing forecast`,
  'Smart catch logging',
  'No ads, no locks, see everything',
];
const MORE_ROW = 'And more...';

/**
 * Stripe Checkout's pay button, in our blue: full width, 44px tall, 6px
 * corners, 16px semibold, a hairline shadow. The reader taps this and lands on
 * a page with the same button a moment later.
 */
const STRIPE_BUTTON =
  'inline-flex h-11 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[16px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

/**
 * The phone trial sheet drawn the way Stripe Checkout draws the page after
 * it: arm b of `trial_sheet_stripe_v1` (2026-09-06).
 *
 * The control (./trial-sheet-pro) is the sheet that won trial_sheet_pro_v1:
 * a PRO badge, a headline naming the city, the terms in two lines, six ticked
 * rows, a testimonial, an email field and the buy button. This one keeps the
 * rows and the testimonial and changes everything around them to match the
 * screen the button leads to:
 *
 * - Stripe's header (the round R mark and "ReelCaster") at Stripe's sizes.
 * - Stripe's offer block, centred: "Try ReelCaster Pro" over "7 days free".
 * - Stripe's button shape, in our blue, with the first charge stated under
 *   it rather than over the headline.
 * - No email field. Stripe asks for the address with the card, so the buyer
 *   types it once; see `collectEmail` on TrialBuy for what that costs.
 * - The rows in Casey's order, with "And more..." closing the list.
 * - A sheet that fills the screen to just under the header (the modal sets
 *   the height when this arm renders).
 *
 * The guess: a sheet that reads as the first page of checkout, rather than a
 * tray with a form in it, gets more taps through to Stripe, and a screen
 * fewer between the tap and the card gets more of those to a trial.
 */
export const TRIAL_SHEET_TEST = 'trial_sheet_stripe_v1';

export default function TrialSheetStripe({
  from,
  region,
  ctaHref,
  ctaLabel,
  priceAmount,
  onCtaClick,
  onActivate,
}: {
  /** Where the reader opened this from. The headline no longer names it
      (it is set the way Stripe's page sets the offer), but the modal still
      passes it and a later copy pass may want it back. */
  placeName?: string;
  placeKind?: 'spot' | 'city';
  cityName?: string;
  from: string;
  region?: string;
  ctaHref?: string;
  ctaLabel: string;
  priceAmount: string;
  onCtaClick: (extra: Record<string, unknown>) => void;
  onActivate: (method: 'annual' | 'wallet' | 'signup') => void;
}) {
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
        <BrandHeader />

        {/* The offer, set the way Stripe Checkout sets it on the page after
            this one: what it is in grey, what it costs today in large type,
            centred, as there. The first charge is stated under the button. */}
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
          <li className="py-2">
            <span className="text-[15px] leading-5 font-medium text-rc-ink-soft">
              {MORE_ROW}
            </span>
          </li>
        </ul>

        <Testimonial className="mt-4 rounded-xl border border-rc-rule-soft bg-rc-surface p-4" />
      </div>

      <div className="shrink-0 border-t border-rc-rule-soft px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          <>
            <TrialExpress region={region} className="mb-3" />
            <TrialBuy
              signupLabel={ctaLabel}
              hideLabel
              collectEmail={false}
              buttonClassName={STRIPE_BUTTON}
            />
          </>
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

/**
 * The brand row at the top of the sheet: the round R mark and the word
 * ReelCaster, drawn at the size Stripe Checkout's mobile header draws them
 * (a 28px circle, 16px medium text, 8px apart). The reader taps Start trial
 * here and lands on that page a moment later, so the sheet wears the same
 * header and the checkout reads as the next screen of the same thing rather
 * than a different site.
 *
 * No back arrow. Stripe's arrow returns to us; on the sheet the way back is
 * the X and the swipe, and a second control for the same thing at the same
 * size as the brand would only pull the eye off it.
 *
 * The mark is the app icon's R on a circle instead of a rounded square,
 * because a circle is the shape Stripe cuts our uploaded icon to.
 */
function BrandHeader() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rc-brand"
      >
        <svg viewBox="0 0 512 512" className="size-7" fill="#fff">
          <path
            fillRule="evenodd"
            d="M121 106h180q45 0 65.357 20.357t20.357 65.357v38.572q0 35.571-11.786 55.285-11.786 19.715-37.5 26.143L391 406h-83.571l-49.286-90h-60v90H121ZM309.571 191.714q0-25.714-25.714-25.714h-85.714v90h85.714q25.714 0 25.714-25.714Z"
          />
        </svg>
      </span>
      <span className="text-[16px] leading-none font-medium text-rc-ink">
        ReelCaster
      </span>
    </div>
  );
}

/**
 * The first-charge line in Stripe's words ("Then CA$33.00 per year starting
 * September 13"), read from the same hook the buy button uses so the date is
 * the one the button produces. A card-required trial that auto-charges has to
 * say the date and the amount before the tap, and this is where the sheet
 * says it. It is the sheet's accessible description for the same reason.
 *
 * The price is shown to the cent ("$33.00") because a charge is a charge and
 * a whole-dollar figure next to "free" reads as a different kind of number.
 */
function ChargeTerms({
  priceAmount,
  className,
  ...rest
}: { priceAmount: string; className?: string } & React.HTMLAttributes<HTMLParagraphElement>) {
  const { chargeDate, trialOn } = useTrialCta();
  const price = /\.\d{2}$/.test(priceAmount) ? priceAmount : `${priceAmount}.00`;
  const when = trialOn && chargeDate ? chargeDate : `day ${TRIAL_DAYS}`;
  return (
    <p {...rest} className={`text-[13px] leading-[18px] text-rc-ink-soft ${className ?? ''}`}>
      Then <span className="font-semibold text-rc-ink">{price}</span> per year
      starting {when}
    </p>
  );
}
