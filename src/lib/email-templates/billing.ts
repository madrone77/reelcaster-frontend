/**
 * Billing lifecycle emails: trial ending, payment failed, duplicate-card
 * refusal.
 *
 * The trial-ending one isn't optional garnish — a card-required trial that
 * auto-charges needs clear advance notice of the date and the amount under
 * both Canadian consumer-protection rules and the US FTC's negative-option
 * rule. Stripe fires customer.subscription.trial_will_end three days out,
 * which is what sends this.
 */

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const BRAND = '#1E40E0';
const INK = '#0F172A';
const INK_SOFT = '#334155';
const INK_MUTE = '#64748B';
const RULE = '#E2E8F0';

function shell(bodyHtml: string, preheader: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F8FAFC;font-family:${SANS};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid ${RULE};border-radius:12px;padding:32px;">
        ${bodyHtml}
        <tr><td style="padding-top:28px;border-top:1px solid ${RULE};color:${INK_MUTE};font-size:12px;line-height:18px;">
          ReelCaster · Manage or cancel your subscription anytime from
          <a href="https://www.reelcaster.com/profile" style="color:${BRAND};">your account</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">${label}</a>`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Sent 3 days before the trial converts. Must state date and amount. */
export function trialEndingEmail(params: {
  trialEndsAt: string;
  amountLabel: string; // e.g. "$33"
}): { subject: string; html: string } {
  const date = formatDate(params.trialEndsAt);
  return {
    subject: `Your ReelCaster Pro trial ends ${date}`,
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">Your trial ends ${date}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          On ${date} we'll charge the card on file <strong>${params.amountLabel} for one year</strong> of ReelCaster Pro,
          and your 14-day forecasts, private spots, and alerts keep running.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          If Pro isn't for you, cancel before then and you won't be charged. Your account stays:
          you keep your spots, your catch log, and your 7-day forecast for free.
        </p>
        <p style="margin:0 0 8px;">${button('https://www.reelcaster.com/profile', 'Manage subscription')}</p>
      </td></tr>`,
      `We'll charge ${params.amountLabel} on ${date} unless you cancel.`,
    ),
  };
}

/** Sent when a payment fails and the 7-day grace window opens. */
export function paymentFailedEmail(params: {
  graceUntil: string;
  amountLabel: string;
}): { subject: string; html: string } {
  const date = formatDate(params.graceUntil);
  return {
    subject: 'We couldn’t process your ReelCaster payment',
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">Your payment didn't go through</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          We tried to charge ${params.amountLabel} for ReelCaster Pro and the card was declined.
          Nothing has changed yet. <strong>Your Pro features stay on until ${date}</strong> while you sort it out.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          Update your card and we'll retry automatically.
        </p>
        <p style="margin:0 0 8px;">${button('https://www.reelcaster.com/profile', 'Update payment method')}</p>
      </td></tr>`,
      `Pro stays on until ${date}. Update your card to keep it.`,
    ),
  };
}

/** Sent when the card fingerprint shows this card already had a free trial. */
export function trialUnavailableEmail(params: {
  amountLabel: string;
}): { subject: string; html: string } {
  return {
    subject: 'About your ReelCaster trial',
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">We couldn't start that trial</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          The card you used has already been through a free trial of ReelCaster Pro, so we've cancelled
          this one and <strong>you have not been charged</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          You're welcome to subscribe at ${params.amountLabel} a year whenever you like, and if you think
          this is a mistake (a shared card will do it), just reply to this email and we'll sort it out.
        </p>
        <p style="margin:0 0 8px;">${button('https://www.reelcaster.com/plans', 'See Pro pricing')}</p>
      </td></tr>`,
      'No charge was made.',
    ),
  };
}
