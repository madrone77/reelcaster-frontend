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

import { siteUrl } from '@/lib/site';
import { BRAND, INK, INK_MUTE, INK_SOFT, button, formatDate, shell } from './shell';

/**
 * What the account has actually set up, so the day-4 note can say something
 * true instead of a generic nudge. Both counts come from the database at send
 * time; see src/lib/trial-reminder.ts.
 */
export interface TrialSetupState {
  savedSpots: number;
  activeAlerts: number;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * The soft-touch half of the day-4 email.
 *
 * A trial that ends with nobody having saved a spot did not fail at the price,
 * it failed at the setup, and a billing notice on its own does not fix that.
 * So the email opens by saying where the account actually got to and points at
 * the one thing left undone. The primary button changes with it: someone who
 * has nothing saved should not be sent to a subscription screen.
 */
function checkIn(setup: TrialSetupState): {
  html: string;
  ctaHref: string;
  ctaLabel: string;
} {
  const { savedSpots: spots, activeAlerts: alerts } = setup;

  if (spots === 0) {
    return {
      html: `You have not saved a spot yet, so Pro has not had much to work with.
        Star the water you actually fish and everything else keys off it: the
        14-day forecast, the alerts, the catch log.`,
      ctaHref: siteUrl('/explore'),
      ctaLabel: 'Find your spots',
    };
  }

  if (alerts === 0) {
    return {
      html: `You have ${spots} ${plural(spots, 'spot', 'spots')} saved. No alerts yet
        though, and that is the part that works while you are not looking. Pick a
        spot, set the score you would get out of bed for, and we message you when
        the week turns.`,
      ctaHref: siteUrl('/notifications'),
      ctaLabel: 'Set up an alert',
    };
  }

  return {
    html: `${spots} ${plural(spots, 'spot', 'spots')} saved and ${alerts}
      ${plural(alerts, 'alert', 'alerts')} running. That is the setup doing its
      job, so you should be hearing from us when your water turns on.`,
    ctaHref: siteUrl('/dashboard'),
    ctaLabel: 'Open your dashboard',
  };
}

/**
 * Sent 3 days before the trial converts. Must state the date and the amount.
 *
 * `setup` is optional so a caller that could not read the counts still sends a
 * valid notice rather than none. Missing the check-in is a worse email; missing
 * the email is a compliance problem.
 */
export function trialEndingEmail(params: {
  trialEndsAt: string;
  amountLabel: string; // e.g. "$33"
  setup?: TrialSetupState;
}): { subject: string; html: string } {
  const date = formatDate(params.trialEndsAt);
  const check = params.setup ? checkIn(params.setup) : null;

  const primaryHref = check ? check.ctaHref : siteUrl('/profile');
  const primaryLabel = check ? check.ctaLabel : 'Manage subscription';

  return {
    subject: `Your ReelCaster Pro trial ends ${date}`,
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">Three days left on your trial</h1>
        ${
          check
            ? `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">${check.html}</p>`
            : ''
        }
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          On ${date} we will charge the card on file <strong>${params.amountLabel} for one year</strong> of ReelCaster Pro,
          and your 14-day forecasts, private spots, and alerts keep running.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          If Pro is not for you, cancel before then and you will not be charged. Your account stays:
          you keep your spots, your catch log, and your 7-day forecast for free.${
            check
              ? ` <a href="${siteUrl('/profile')}" style="color:${BRAND};">Manage your subscription</a>.`
              : ''
          }
        </p>
        <p style="margin:0 0 20px;">${button(primaryHref, primaryLabel)}</p>
        <p style="margin:0;font-size:14px;line-height:22px;color:${INK_MUTE};">
          Stuck on something, or not sure how to set an alert up? Reply to this email and a person will read it.
        </p>
      </td></tr>`,
      { preheader: `We will charge ${params.amountLabel} on ${date} unless you cancel.` },
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
        <p style="margin:0 0 8px;">${button(siteUrl('/settings/account'), 'Update payment method')}</p>
      </td></tr>`,
      { preheader: `Pro stays on until ${date}. Update your card to keep it.` },
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
        <p style="margin:0 0 8px;">${button(siteUrl('/plans'), 'See Pro pricing')}</p>
      </td></tr>`,
      { preheader: 'No charge was made.' },
    ),
  };
}

/**
 * Sent when an admin approves a comped year (the /first invite link).
 *
 * It closes a loop the customer can't see: they signed up through an offer,
 * got a free account, and have been waiting on a human. Everything here that
 * sounds like reassurance is load-bearing — no card was taken, so "nothing to
 * cancel" is a fact they'd otherwise have to ask about, and the end date is
 * the one thing they can't find anywhere in the app.
 */
export function compGrantedEmail(params: {
  expiresAt: string;
  /** Omitted when the grant isn't a whole year, e.g. a 30-day comp. */
  yearLong?: boolean;
}): { subject: string; html: string } {
  const date = formatDate(params.expiresAt);
  const span = params.yearLong ? 'A full year of' : '';
  return {
    subject: 'Your free ReelCaster Pro is live',
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">Pro is switched on</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          ${span} ReelCaster Pro is now on your account: 14-day forecasts, your own private
          spots, and alerts when conditions line up. Nothing else to do. Sign in and it's there.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          It runs until <strong>${date}</strong>. We never took a card, so there's nothing to
          cancel and nothing will be charged. On that date the account goes back to free and
          keeps your spots and your catch log.
        </p>
        <p style="margin:0 0 8px;">${button(siteUrl('/explore'), 'Open the map')}</p>
      </td></tr>`,
      { preheader: `Pro is on your account until ${date}. No card, nothing to cancel.` },
    ),
  };
}

/**
 * Sent when a purchase can't sign the buyer in from the success page: the
 * email already had an account, or the one-time handoff was already used.
 *
 * Completing a checkout is not proof of owning an inbox, so this link is the
 * only way into an account that existed before the purchase.
 */
export function checkoutSignInEmail(actionLink: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: 'Your ReelCaster Pro is ready. Sign in.',
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">You're on Pro</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          Your payment went through and Pro is on this email address. Use the button below to
          sign in, no password needed.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:${INK_MUTE};">
          The link works once and expires shortly, so open it on the device you want to fish from.
        </p>
        <p style="margin:0 0 8px;">${button(actionLink, 'Sign in to ReelCaster')}</p>
      </td></tr>`,
      { preheader: 'Your Pro subscription is active. Sign in to start using it.' },
    ),
    text: `You're on Pro. Sign in here (the link works once and expires shortly): ${actionLink}`,
  };
}
