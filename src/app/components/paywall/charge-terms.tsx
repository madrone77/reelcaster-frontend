'use client';

import Link from 'next/link';
import { useTrialCta } from './trial-cta';
import { TRIAL_DAYS, dollars } from '@/lib/pricing';

/**
 * The first-charge line in Stripe's words ("Then CA$33.00 per year starting
 * September 13"), read from the same hook the buy button uses so the date is
 * the one the button produces. A card-required trial that auto-charges has to
 * say the date and the amount before the tap, and this is where a sheet says
 * it.
 *
 * The price is shown to the cent ("$33.00") because a charge is a charge and
 * a whole-dollar figure next to "free" reads as a different kind of number.
 *
 * Lifted out of ./trial-sheet-stripe when the plan step needed the same line
 * under the same button: both screens put a card-required trial in front of a
 * reader, and the sentence that discloses it must not be able to drift
 * between them.
 *
 * Terms and Privacy close the same line (2026-09-14): the sheets had no link
 * to either, and the terms a renewing charge is made under belong in front of
 * the reader before the tap, not only on Stripe's page after it. They sit in
 * one unbreakable run, so a narrow phone wraps them together rather than
 * splitting the pair.
 *
 * One line for both plans (2026-09-18): the monthly sentence ("$6.00 per
 * month, charged today, until you cancel · Terms · Privacy") ran two lines on
 * a phone where the yearly one ran one, so switching plans grew the sheet by
 * a line and the button jumped under the thumb. The monthly line now has the
 * yearly line's shape and length ("$6.00 per month starting today"), the
 * yearly line loses its leading "Then" (the card and the title above it
 * already say the week is free), and the paragraph is held to a single line
 * so the two plans can never differ in height. On a 320px phone the line
 * shrinks a step rather than wrapping.
 */
// Grey and unruled: the pair is the fine print at the end of a fine-print
// line, and a blue underlined pair there read as the two things to tap on a
// screen whose one action is the button above them. They inherit the
// paragraph's ink and darken on hover instead.
const LINK = 'hover:text-rc-ink';

export default function ChargeTerms({
  priceAmount,
  className,
  ...rest
}: { priceAmount: string; className?: string } & React.HTMLAttributes<HTMLParagraphElement>) {
  const { chargeDate, trialOn, busy, plan, monthlyCents } = useTrialCta();
  // Monthly is charged today at the monthly amount, and the caller's
  // `priceAmount` is the annual figure; the hook's is the one to print.
  const shown = plan === 'monthly' ? dollars(monthlyCents) : priceAmount;
  const price = /\.\d{2}$/.test(shown) ? shown : `${shown}.00`;
  // No trial for this annual buyer (a signed-in account that has had one, or
  // a typed address checkout just refused a trial for): the charge is today,
  // and a line promising "day 7" under that button would be the one false
  // sentence on the screen. While a signed-in read is still loading, the
  // trial wording holds, as the button's own label does.
  const annualToday = plan === 'annual' && !trialOn && !busy;
  const when = trialOn && chargeDate ? chargeDate : `day ${TRIAL_DAYS}`;
  return (
    <p
      {...rest}
      className={`whitespace-nowrap text-[13px] leading-[18px] text-rc-ink-soft max-[359px]:text-[12px] ${className ?? ''}`}
    >
      {plan === 'monthly' ? (
        <>{price} per month starting today</>
      ) : annualToday ? (
        <>{price} per year starting today</>
      ) : (
        <>
          {price} per year starting {when}
        </>
      )}{' '}
      <span className="whitespace-nowrap">
        {'· '}
        {/* prefetch={false}: these two Links enter the viewport the instant the
          sheet opens, and Next answers that by fetching both route payloads —
          44 kB of RSC plus their page chunks — in the same breath the sheet is
          trying to paint in. Measured arriving 590-830ms after the tap, on the
          connection the sheet itself was queued on. Small print nobody taps
          does not get to compete with the thing they did tap. */}
        <Link href="/terms" prefetch={false} className={LINK}>
          Terms
        </Link>
        {' · '}
        <Link href="/privacy" prefetch={false} className={LINK}>
          Privacy
        </Link>
      </span>
    </p>
  );
}
