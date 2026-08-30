/**
 * The getting-started email. The first thing we ever say to a new account.
 *
 * There was nothing here before. A trial started, the account silently became
 * Pro, and the next word from us was the day-4 charge notice: a date and an
 * amount, to somebody who had never been told what the product does. That
 * notice already knows the problem, which is why it opens by counting saved
 * spots and alerts, and it can only nag about a setup nobody explained.
 *
 * So this does the explaining, on day zero, and the day-4 note goes back to
 * being about billing.
 *
 * It is the short version of /welcome and reads its step list from the same
 * module, so the two cannot walk a new member through different products in a
 * different order. The email carries one line per step; the page carries the
 * argument. Every "how it works" link is an anchor into it.
 *
 * Two variants. A trial gets the Pro steps and the charge date it is owed; a
 * free signup gets the steps a free account can actually take and no billing
 * talk at all. Splitting them into separate files would give the shared two
 * thirds two places to drift.
 *
 * Copy rules: no dashes, plain words, short sentences. See the house style in
 * the angler prompt.
 */

import { siteUrl } from '@/lib/site';
import { STEPS, type WelcomeStep } from '@/app/welcome/content';
import { TRIAL_DAYS } from '@/lib/pricing';
import { BRAND, INK, INK_MUTE, INK_SOFT, RULE, attrUrl, button, formatDate, shell } from './shell';

export type WelcomeVariant = 'trial' | 'free';

export interface WelcomeEmailParams {
  variant: WelcomeVariant;
  /** ISO date the trial converts. Trial variant only. */
  trialEndsAt?: string | null;
  /** What the card will actually be charged, e.g. "$33". Trial variant only. */
  amountLabel?: string | null;
}

/**
 * The steps this reader can act on.
 *
 * A free account is shown the four it can do, not five with one crossed out. A
 * getting-started email is not the place to sell: the reader has had the
 * account for about four minutes. The trial offer sits once at the bottom,
 * after the help, and /welcome carries the Pro step for anyone who reads on.
 */
function stepsFor(variant: WelcomeVariant): WelcomeStep[] {
  return variant === 'trial' ? STEPS : STEPS.filter((s) => s.tier !== 'pro');
}

/** Anchor into the long version of one step. */
function learnUrl(step: WelcomeStep): string {
  return siteUrl(`/welcome#${step.id}`);
}

/** One numbered row. Numbers rather than bullets: this is an order to work in. */
function stepHtml(step: WelcomeStep, index: number): string {
  return `<tr><td style="padding:0 0 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="34" valign="top" style="padding-top:2px;">
        <div style="width:26px;height:26px;border-radius:13px;background:#EEF2FF;color:${BRAND};font-size:13px;font-weight:700;line-height:26px;text-align:center;">${index + 1}</div>
      </td>
      <td valign="top">
        <p style="margin:0 0 4px;font-size:15px;line-height:22px;font-weight:600;color:${INK};">${step.title}</p>
        <p style="margin:0 0 6px;font-size:14px;line-height:22px;color:${INK_SOFT};">${step.short}</p>
        <p style="margin:0;font-size:14px;line-height:22px;">
          <a href="${attrUrl(siteUrl(step.href))}" style="color:${BRAND};font-weight:600;text-decoration:none;">${step.hrefLabel}</a>
          <span style="color:${INK_MUTE};"> &nbsp;&middot;&nbsp; </span>
          <a href="${attrUrl(learnUrl(step))}" style="color:${INK_MUTE};text-decoration:underline;">How it works</a>
        </p>
      </td>
    </tr></table>
  </td></tr>`;
}

/**
 * The trial's terms, stated plainly and early.
 *
 * Not the legally required notice. That is the day-4 email, which restates the
 * date and the amount on its own. This is here because a card-required trial
 * whose terms are only mentioned once, four days in, feels like something that
 * was hoped to be missed.
 *
 * The amount is whatever the caller read off the subscription, not a list
 * price. A price test can put a buyer on a different arm, and the number shown
 * has to be the number charged.
 *
 * Degrades rather than guesses: no date or no amount and the block is dropped,
 * because a welcome email that invents a charge date is worse than one that
 * does not mention it. The compliance notice does not depend on this.
 */
function trialTermsHtml(trialEndsAt?: string | null, amountLabel?: string | null): string {
  if (!trialEndsAt || !amountLabel) return '';
  const date = formatDate(trialEndsAt);
  return `<tr><td style="padding:4px 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid ${RULE};border-radius:8px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:13px;line-height:20px;font-weight:600;color:${INK};">Your trial, in one line</p>
        <p style="margin:0;font-size:13px;line-height:20px;color:${INK_SOFT};">
          Pro is on for ${TRIAL_DAYS} days. On <strong>${date}</strong> the card on file is charged
          <strong>${amountLabel} for the year</strong> unless you cancel first, and we will email you
          three days before that happens. Cancelling keeps the account, your spots and your catch log.
          <a href="${siteUrl('/profile')}" style="color:${BRAND};">Manage it here</a>.
        </p>
      </td></tr>
    </table>
  </td></tr>`;
}

/**
 * Where to get unstuck.
 *
 * "Reply to this email" is first and is a real promise: every send sets
 * replyTo to the support inbox, because the From is noreply@ and an invitation
 * to reply that bounces is worse than no invitation. See src/lib/welcome-email.ts.
 *
 * The Port is named only to a trial reader. It is Pro-gated, and a help link
 * that asks a free member for money is not help.
 */
function helpHtml(variant: WelcomeVariant): string {
  const library =
    variant === 'trial'
      ? `The long version of all of it is on your
         <a href="${attrUrl(siteUrl('/welcome'))}" style="color:${BRAND};">welcome page</a>,
         and while you are on Pro you also have
         <a href="${siteUrl('/support')}" style="color:${BRAND};">The Port</a>: the full guide
         library and a support queue that answers within one business day.`
      : `The long version of all of it is on your
         <a href="${attrUrl(siteUrl('/welcome'))}" style="color:${BRAND};">welcome page</a>, and the
         <a href="${siteUrl('/faq')}" style="color:${BRAND};">FAQ</a> covers the questions we get most.`;

  return `<tr><td style="padding:4px 0 0;border-top:1px solid ${RULE};">
    <p style="margin:18px 0 10px;font-size:15px;line-height:23px;font-weight:600;color:${INK};">If you get stuck, ask us</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:22px;color:${INK_SOFT};">
      Reply to this email and a person reads it. Not a form, not a bot. We are a small team in
      Victoria, BC, so if something is confusing or plain broken, telling us is genuinely useful.
    </p>
    <p style="margin:0;font-size:14px;line-height:22px;color:${INK_SOFT};">${library}</p>
  </td></tr>`;
}

/** The soft trial offer, free variant only, deliberately last and small. */
function upgradeHtml(): string {
  return `<tr><td style="padding:20px 0 0;">
    <p style="margin:0;font-size:13px;line-height:20px;color:${INK_MUTE};">
      When you want the second week of forecast, unlimited saved spots, your own pins and up to ten
      alerts, Pro runs a ${TRIAL_DAYS}-day free trial.
      <a href="${siteUrl('/plans')}" style="color:${BRAND};">See what it adds</a>.
    </p>
  </td></tr>`;
}

/**
 * Subject and HTML for the getting-started email.
 *
 * Pure. Renders without a database or a network, so the copy can be read in a
 * test or a script without mailing a customer to check it.
 */
export function welcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  html: string;
} {
  const isTrial = params.variant === 'trial';
  const steps = stepsFor(params.variant);

  const subject = isTrial
    ? 'Welcome to ReelCaster Pro. Here is where to start.'
    : 'Welcome to ReelCaster. Here is where to start.';

  const heading = isTrial
    ? `Pro is on for the next ${TRIAL_DAYS} days`
    : 'Your account is open';

  // The one paragraph that says what the product IS. Everything else assumes
  // the reader already knows, and on day zero they do not.
  const overview = isTrial
    ? `ReelCaster scores fishing conditions hour by hour, 0 to 100, for the species you are after.
       It reads the tide and the current, the pressure trend, the season, the wind and the light,
       then tells you which hours on which day are worth the fuel. Pro shows you the full two weeks
       of it, on any spot we cover and on any pin you drop yourself.`
    : `ReelCaster scores fishing conditions hour by hour, 0 to 100, for the species you are after.
       It reads the tide and the current, the pressure trend, the season, the wind and the light,
       then tells you which hours on which day are worth the fuel. Your account plans a week ahead
       on every spot we cover.`;

  const preheader = `${steps.length} things worth doing now, and where to ask if you get stuck.`;

  // A free account has no subscription to manage, and pointing one at a cancel
  // page reads as a charge they did not notice. See ./shell.
  const footerHtml = isTrial
    ? undefined
    : `ReelCaster &middot; You are on the free plan. Nothing to cancel, and no card on file.
       <a href="${siteUrl('/profile')}" style="color:${BRAND};">Your account</a>.`;

  const body = [
    `<tr><td style="padding:0 0 8px;">
      <h1 style="margin:0 0 14px;font-size:22px;line-height:30px;color:${INK};">${heading}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:${INK_SOFT};">${overview}</p>
      <p style="margin:0 0 22px;">${button(siteUrl('/welcome'), 'Start here')}</p>
    </td></tr>`,
    isTrial ? trialTermsHtml(params.trialEndsAt, params.amountLabel) : '',
    `<tr><td style="padding:0 0 16px;">
      <p style="margin:0;font-size:15px;line-height:23px;font-weight:600;color:${INK};">What to do now</p>
      <p style="margin:4px 0 0;font-size:14px;line-height:22px;color:${INK_MUTE};">
        Ten minutes of setup, and the app knows which water is yours.
      </p>
    </td></tr>`,
    ...steps.map(stepHtml),
    helpHtml(params.variant),
    isTrial ? '' : upgradeHtml(),
  ].join('\n');

  return { subject, html: shell(body, { preheader, footerHtml }) };
}
