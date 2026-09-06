/**
 * The "your month landed" note to a referrer.
 *
 * One email, two payouts. An account nobody pays for got 30 more days of
 * comped Pro and is told the new end date. A paying account got one twelfth
 * of its year as a credit on the next renewal, and is told the amount and
 * that it comes off automatically. Both say the same thing about the link:
 * keep sending it.
 *
 * Copy rules: no dashes, plain words, short sentences.
 */

import { INK, INK_SOFT, button, formatDate, shell } from './shell';

export type ReferralPayout =
  | { kind: 'comp_extension'; proUntil: string }
  | { kind: 'stripe_credit'; amountLabel: string }
  | { kind: 'capped' };

export function referralCreditEmail(params: {
  payout: ReferralPayout;
  referralUrl: string;
}): { subject: string; html: string } {
  const { payout, referralUrl } = params;

  let lead: string;
  let preheader: string;
  if (payout.kind === 'comp_extension') {
    const date = formatDate(payout.proUntil);
    lead = `Your Pro now runs until <strong>${date}</strong>. Nothing to do, no card, nothing to cancel.`;
    preheader = `Your Pro now runs until ${date}.`;
  } else if (payout.kind === 'stripe_credit') {
    lead = `We put <strong>${payout.amountLabel}</strong> on your account, a month off your next year. It comes off the renewal on its own.`;
    preheader = `${payout.amountLabel} off your next year.`;
  } else {
    lead = `You have already earned a full year this year, so this one is a thank you rather than a month. The counter resets as the year rolls on.`;
    preheader = 'A friend joined through your link.';
  }

  return {
    subject: 'A friend joined. Your month is in.',
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">Your friend is on the water</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          Someone made a ReelCaster account through your link. They got a month of Pro, and so did you.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          ${lead}
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          The link keeps working. Every friend who joins is another month, up to a full year.
        </p>
        <p style="margin:0 0 8px;">${button(referralUrl, 'Copy your link')}</p>
      </td></tr>`,
      { preheader },
    ),
  };
}
