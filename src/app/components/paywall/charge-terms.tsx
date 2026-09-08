'use client';

import { useTrialCta } from './trial-cta';
import { TRIAL_DAYS } from '@/lib/pricing';

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
 */
export default function ChargeTerms({
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
