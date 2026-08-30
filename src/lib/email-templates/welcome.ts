/**
 * The getting-started email. The first thing we ever say to a new account.
 *
 * There was nothing here before. A trial started, the account silently became
 * Pro, and the next word from us was the day-4 billing notice: a charge date,
 * to somebody who had never been told what the product does. That is the wrong
 * order. The day-4 note already knows it, which is why it opens by counting
 * saved spots and alerts, and it can only nag about a setup nobody explained.
 *
 * So this email does the explaining, on day zero, and the day-4 note goes back
 * to being about billing.
 *
 * Two variants, one template. A trial gets the Pro feature set and the charge
 * date it is owed; a free signup gets the free feature set and no billing talk
 * at all. Splitting them into separate files would give the shared two thirds
 * two places to drift.
 *
 * ONE IMPORTANT ASYMMETRY: The Port (/support) is Pro-gated. Deep links into
 * its guides are the whole point of the trial email and would be a paywall in
 * the free one, so the free variant links the public /faq instead. Sending
 * somebody a link to help and having it ask for money is worse than sending a
 * thinner link.
 *
 * Copy rules: no dashes, plain words, short sentences. See the house style in
 * the angler prompt.
 */

import { siteUrl } from '@/lib/site';
import { portUrl } from '@/lib/port-links';
import { WELCOME_GUIDE_IDS } from '@/app/support/content';
import { TRIAL_DAYS } from '@/lib/pricing';
import { BRAND, INK, INK_MUTE, INK_SOFT, RULE, attrUrl, button, formatDate, shell } from './shell';

export type WelcomeVariant = 'trial' | 'free';

export interface WelcomeEmailParams {
  variant: WelcomeVariant;
  /** ISO date the trial converts. Trial variant only. */
  trialEndsAt?: string | null;
  /** What the card will be charged, e.g. "$33". Trial variant only. */
  amountLabel?: string | null;
}

/**
 * One thing to go and do, with somewhere to read more about it.
 *
 * `learnHref` is separate from `doHref` because they answer different moods.
 * Somebody who knows what a home spot is wants the map; somebody who does not
 * wants four paragraphs first, and making them guess which link is which is
 * how a getting-started email becomes a wall of blue text.
 */
interface Step {
  title: string;
  detail: string;
  doHref: string;
  doLabel: string;
  learnHref: string;
}

/**
 * What a trial member should do first, in the order that compounds.
 *
 * Home spot before saved spots before alerts is not arbitrary. The home spot
 * is what the dashboard and Explore both key off, so it is the single setting
 * that changes the most screens for the least effort. Alerts come after saved
 * spots because an alert without a spot to hang on is a form, not a feature.
 * Catch logging is last: it is the one that pays off over a season rather than
 * on the first trip, and putting it first would ask for work before the
 * product has given anything back.
 */
function proSteps(): Step[] {
  return [
    {
      title: 'Set your home spot',
      detail:
        'Open the water you fish most and tap the house icon in the title row. Your dashboard then leads with it, and Explore opens there instead of guessing from your connection.',
      doHref: siteUrl('/explore'),
      doLabel: 'Find your water',
      learnHref: portUrl('guides', WELCOME_GUIDE_IDS.yourSpots),
    },
    {
      title: 'Save every spot you fish',
      detail:
        'The star beside the house saves a spot to your own list, so the morning check is one screen instead of a hunt around the map. Pro saves as many as you like.',
      doHref: siteUrl('/favorites'),
      doLabel: 'Your saved spots',
      learnHref: portUrl('guides', WELCOME_GUIDE_IDS.yourSpots),
    },
    {
      title: 'Drop a pin where we have no spot',
      detail:
        'Hit Create custom spot, tap the map where you actually fish, and pick the species you want scored. It is yours and private by default, and it gets the same full model run as a published spot.',
      doHref: siteUrl('/explore'),
      doLabel: 'Open the map',
      learnHref: portUrl('guides', WELCOME_GUIDE_IDS.yourSpots),
    },
    {
      title: 'Set an alert and stop checking',
      detail:
        'Pick a spot, pick the score you would get out of bed for, and we watch it for you. Start high, around 78, or you will stop reading them. Pro runs up to ten, by text or email.',
      doHref: siteUrl('/alerts'),
      doLabel: 'Set an alert',
      learnHref: portUrl('guides', WELCOME_GUIDE_IDS.alerts),
    },
    {
      title: 'Log a catch from the photo',
      detail:
        'Drop the original photo and we read the time and place out of it, suggest the species, match the spot and save what the conditions were doing right then. That history is what makes next season sharper.',
      doHref: siteUrl('/log-catch'),
      doLabel: 'Log a catch',
      learnHref: portUrl('guides', WELCOME_GUIDE_IDS.logCatch),
    },
  ];
}

/**
 * The same list for a free account, cut to what a free account can actually do.
 *
 * Custom spots are gone rather than listed and marked Pro. A getting-started
 * email is not the place to sell; the reader has had the account for about
 * four minutes. The trial offer sits once at the bottom, after the help.
 *
 * Every "learn more" here points at the public FAQ, because The Port is a Pro
 * benefit and a help link that hits a paywall is not help.
 */
function freeSteps(): Step[] {
  return [
    {
      title: 'Set your home spot',
      detail:
        'Open the water you fish most and tap the house icon in the title row. Your dashboard then leads with it, and Explore opens there instead of guessing from your connection.',
      doHref: siteUrl('/explore'),
      doLabel: 'Find your water',
      learnHref: siteUrl('/faq'),
    },
    {
      title: 'Save the spot you fish most',
      detail:
        'The star beside the house saves a spot to your own list. A free account keeps one saved spot, so make it the one you actually launch at.',
      doHref: siteUrl('/favorites'),
      doLabel: 'Your saved spot',
      learnHref: siteUrl('/faq'),
    },
    {
      title: 'Set your alert',
      detail:
        'Pick that spot, pick the score you would get out of bed for, and we watch the week for you and email you when it crosses. Start high, around 78, or you will stop reading them.',
      doHref: siteUrl('/alerts'),
      doLabel: 'Set an alert',
      learnHref: siteUrl('/faq'),
    },
    {
      title: 'Log a catch from the photo',
      detail:
        'Drop the original photo and we read the time and place out of it, suggest the species, match the spot and save what the conditions were doing right then. Free accounts log as much as they like.',
      doHref: siteUrl('/log-catch'),
      doLabel: 'Log a catch',
      learnHref: siteUrl('/faq'),
    },
  ];
}

/** One numbered row. Numbers rather than bullets: this is an order to work in. */
function stepHtml(step: Step, index: number): string {
  return `<tr><td style="padding:0 0 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="34" valign="top" style="padding-top:2px;">
        <div style="width:26px;height:26px;border-radius:13px;background:#EEF2FF;color:${BRAND};font-size:13px;font-weight:700;line-height:26px;text-align:center;">${index + 1}</div>
      </td>
      <td valign="top">
        <p style="margin:0 0 4px;font-size:15px;line-height:22px;font-weight:600;color:${INK};">${step.title}</p>
        <p style="margin:0 0 6px;font-size:14px;line-height:22px;color:${INK_SOFT};">${step.detail}</p>
        <p style="margin:0;font-size:14px;line-height:22px;">
          <a href="${attrUrl(step.doHref)}" style="color:${BRAND};font-weight:600;text-decoration:none;">${step.doLabel}</a>
          <span style="color:${INK_MUTE};"> &nbsp;&middot;&nbsp; </span>
          <a href="${attrUrl(step.learnHref)}" style="color:${INK_MUTE};text-decoration:underline;">How it works</a>
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
 */
function helpHtml(variant: WelcomeVariant): string {
  const library =
    variant === 'trial'
      ? `Everything above is written up properly in <a href="${attrUrl(
          portUrl('guides'),
        )}" style="color:${BRAND};">The Port</a>, along with straight answers to the
         questions we actually get. It is yours while you are on Pro.`
      : `The <a href="${siteUrl('/faq')}" style="color:${BRAND};">FAQ</a> covers the
         common questions, and Pro members get the full guide library in The Port.`;

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
  const steps = isTrial ? proSteps() : freeSteps();

  const subject = isTrial
    ? 'Welcome to ReelCaster Pro. Here is where to start.'
    : 'Welcome to ReelCaster. Here is where to start.';

  const heading = isTrial
    ? `Pro is on for the next ${TRIAL_DAYS} days`
    : 'Your account is open';

  // The one paragraph that says what the product IS. Everything else on this
  // page assumes the reader already knows, and on day zero they do not.
  const overview = isTrial
    ? `ReelCaster scores fishing conditions hour by hour, 0 to 100, for the species you are after.
       It reads the tide and the current, the pressure trend, the season, the wind and the light,
       then tells you which hours on which day are worth the fuel. Pro shows you the full two weeks
       of it, on any spot we cover and on any pin you drop yourself.`
    : `ReelCaster scores fishing conditions hour by hour, 0 to 100, for the species you are after.
       It reads the tide and the current, the pressure trend, the season, the wind and the light,
       then tells you which hours on which day are worth the fuel. Your account plans a week ahead
       on every spot we cover.`;

  const preheader = isTrial
    ? `Five things worth doing while Pro is switched on, and where to ask if you get stuck.`
    : `Four things worth doing now, and where to ask if you get stuck.`;

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
      <p style="margin:0 0 22px;">${button(siteUrl('/explore'), 'Open the map')}</p>
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
