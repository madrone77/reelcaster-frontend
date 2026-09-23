/**
 * "You're almost done signing up for ReelCaster": the one note to somebody who
 * started a signed-out checkout and left before paying.
 *
 * They have no account, so this is the only email they will ever get from us
 * unless they come back. It says what happened (checkout did not finish, so
 * nothing was set up), what finishing gets them, and gives one button back in.
 *
 * The trial line is decided at send time by the same guard the checkout uses,
 * so the email never promises a free week the resume link would not give. It
 * states no price: the split test can put two amounts in front of two readers,
 * and Stripe's page shows the right one.
 *
 * The footer carries the unsubscribe link and the mailing address. Anti-spam
 * law (CASL in Canada, CAN-SPAM in the US) wants both on a message like this,
 * even one sent once to somebody who asked to buy.
 */

import { siteUrl } from '@/lib/site';
import { LEGAL_CONTACT } from '@/lib/legal-contact';
import { TRIAL_DAYS } from '@/lib/pricing';
import { BRAND, INK, INK_MUTE, INK_SOFT, button, formatDate, shell } from './shell';

export function checkoutReminderUrls(token: string): {
  resume: string;
  freeAccount: string;
  unsubscribe: string;
} {
  const t = encodeURIComponent(token);
  return {
    resume: siteUrl(`/api/stripe/checkout/resume?t=${t}`),
    freeAccount: siteUrl(`/api/stripe/checkout/free-account?t=${t}`),
    unsubscribe: siteUrl(`/api/stripe/checkout/reminder-unsubscribe?t=${t}`),
  };
}

function reminderFooter(unsubscribe: string): string {
  return `You are getting this one email because you started checkout on
    <a href="${siteUrl('/')}" style="color:${BRAND};">reelcaster.com</a> with this address.
    We will not send another. <a href="${unsubscribe}" style="color:${BRAND};">Unsubscribe</a>.<br>
    <span style="font-size:9px;line-height:14px;color:#CBD5E1;">ReelCaster &middot; ${LEGAL_CONTACT.EMAIL_FOOTER_ADDRESS}, Victoria, BC, Canada</span>`;
}

export function checkoutReminderEmail(params: {
  token: string;
  /** When they started the checkout they left. */
  startedAt: string;
  trialEligible: boolean;
}): { subject: string; html: string } {
  const urls = checkoutReminderUrls(params.token);
  const started = formatDate(params.startedAt);

  const offer = params.trialEligible
    ? `Finish now and your ${TRIAL_DAYS}-day free trial of Pro starts today. Nothing is charged
        for ${TRIAL_DAYS} days, and if you cancel before then you pay nothing.`
    : `Finish now and Pro is on as soon as checkout completes.`;

  const footer = reminderFooter(urls.unsubscribe);

  return {
    subject: "You're almost done signing up for ReelCaster",
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">You're almost done</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          You started signing up for ReelCaster Pro on ${started}, but checkout did not finish,
          so your account has not been set up yet.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          Pro is the 14-day forecast, private spots, and alerts for the water you fish. ${offer}
        </p>
        <p style="margin:0 0 20px;">${button(urls.resume, 'Finish signing up')}</p>
        <p style="margin:0;font-size:14px;line-height:22px;color:${INK_MUTE};">
          Card did not go through, or something else got in the way? Reply to this email and a person will read it.
        </p>
      </td></tr>`,
      {
        preheader: 'Your ReelCaster account is one step from done.',
        footerHtml: footer,
      },
    ),
  };
}

/**
 * Arm b of abandon_email_v1: the same moment, but they leave with an account.
 *
 * The button is a sign-in link that makes a free account (no card) the first
 * time it is opened; the account is never created before then, so a mistyped
 * or made-up address never becomes one. Pro checkout is the second link, with
 * the same trial line as arm a.
 */
export function freeAccountReminderEmail(params: {
  token: string;
  startedAt: string;
  trialEligible: boolean;
}): { subject: string; html: string } {
  const urls = checkoutReminderUrls(params.token);
  const started = formatDate(params.startedAt);

  const proLine = params.trialEligible
    ? `Want the full forecast after all? <a href="${urls.resume}" style="color:${BRAND};font-weight:600;">Start your ${TRIAL_DAYS}-day free Pro trial</a>. Nothing is charged for ${TRIAL_DAYS} days.`
    : `Want the full forecast after all? <a href="${urls.resume}" style="color:${BRAND};font-weight:600;">Finish signing up for Pro</a>.`;

  return {
    subject: 'Your free ReelCaster account is ready',
    html: shell(
      `<tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">Your free account is ready</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          You started signing up for ReelCaster Pro on ${started} but didn't finish.
          No problem. We set you up with a free account instead, no credit card, so you can still try ReelCaster.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          Free gets you today's bite score for every spot, the regulations, a week ahead, and a catch log.
        </p>
        <p style="margin:0 0 20px;">${button(urls.freeAccount, 'Open my free account')}</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:${INK_SOFT};">${proLine}</p>
        <p style="margin:0;font-size:14px;line-height:22px;color:${INK_MUTE};">
          Card did not go through, or something else got in the way? Reply to this email and a person will read it.
        </p>
      </td></tr>`,
      {
        preheader: 'No card needed. One tap and you are signed in.',
        footerHtml: reminderFooter(urls.unsubscribe),
      },
    ),
  };
}
