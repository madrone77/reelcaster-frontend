/**
 * Score Alert Messages
 *
 * One message per angler per day, covering every alert of theirs that has
 * something to say. It used to be one message per alert per beat, which is why
 * a Pro user with eight alerts on six nearby spots got mail on eighteen days
 * out of eighteen: eight alerts describing one weather system, each one
 * individually well behaved.
 *
 * Two beats survive:
 *
 *   heads_up    days out, said early enough to book the day off, and openly
 *               caveated because the forecast can still move
 *   confirm     the day is here or imminent and it held
 *
 * There used to be a third, `stand_down`, for a flagged day that fell apart. It
 * was written but never wired to anything, so the heads-up's closing promise
 * ("we will confirm the morning before") was kept only when the news was good.
 * The promise is gone rather than half-kept: nothing here now commits us to a
 * follow-up we do not send.
 *
 * Every line carries how far out the day is. That is what makes the early ones
 * trustworthy instead of annoying: an angler who knows a number is six days out
 * reads it as a plan, not a promise.
 */

import type { AlertBeat } from '@/lib/custom-alert-engine';

/** One line of the digest: a fishing day at a spot. */
export interface ScoreAlertItem {
  beat: AlertBeat;
  spotName: string;
  spotSlug: string | null;
  speciesName: string | null;
  /** False when we scored the spot's best species instead of the one chosen. */
  speciesMatched: boolean;
  /** The fishing day, YYYY-MM-DD. */
  targetDate: string;
  /** 0 = today. */
  leadDays: number;
  score: number;
}

export interface ScoreAlertDigestParams {
  /** Everything the angler is owed today. Drives the email. */
  items: ScoreAlertItem[];
  /**
   * The subset whose own alert asked for SMS. Drives the text, which is why it
   * is separate: the email covers every alert, the text covers only the ones
   * that asked to be texted. Defaults to `items`.
   */
  smsItems?: ScoreAlertItem[];
  /** Whether an email is also going out, which changes where the text points. */
  alsoEmailing: boolean;
  appBase: string;
  manageAlertsUrl: string;
}

export interface ScoreAlertMessage {
  subject: string;
  html: string;
  /** Plain-text body for SMS, kept inside one segment. */
  sms: string;
}

const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BRAND = '#1E40E0';
const BRAND_SOFT = '#E8EDFF';
const INK = '#0F172A';
const INK_MUTE = '#64748B';
const RULE = '#E2E8F0';
const BAND = '#F1F5F9';

function tierFor(score: number) {
  if (score >= 75) return { label: 'Good', num: '#16A34A', bg: '#DCFCE7', ink: '#166534' };
  if (score >= 55) return { label: 'Fair', num: '#D97706', bg: '#FEF3C7', ink: '#92400E' };
  return { label: 'Poor', num: '#DC2626', bg: '#FEE2E2', ink: '#991B1B' };
}

/**
 * "Sat Aug 22" from "2026-08-22".
 *
 * Formatted in UTC deliberately. The date string is already the spot's local
 * calendar day, so re-interpreting it in the server's zone is how a Saturday
 * alert ends up saying Friday.
 */
function formatDay(targetDate: string): string {
  const d = new Date(`${targetDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "today" / "tomorrow" / "3 days out". */
function leadPhrase(leadDays: number): string {
  if (leadDays === 0) return 'today';
  if (leadDays === 1) return 'tomorrow';
  return `${leadDays} days out`;
}

/** "Today" / "Tomorrow, Sat Aug 30" / "Sat Aug 30". */
function dayLabel(item: ScoreAlertItem): string {
  if (item.leadDays === 0) return 'Today';
  if (item.leadDays === 1) return `Tomorrow, ${formatDay(item.targetDate)}`;
  return formatDay(item.targetDate);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "A, B and C" without the serial comma, which reads oddly in a subject. */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The sentence for one item, used on its own in a single-item email and as the
 * lead line of a digest.
 *
 * A heads-up whose day has already arrived is not a heads-up. That case exists
 * because "the best day in the window" is sometimes today, and warning that
 * today's forecast "can still move" is nonsense, so the caveat is dropped.
 */
function sentenceFor(item: ScoreAlertItem): string {
  const rounded = Math.round(item.score);
  const species = item.speciesName ?? 'your target species';
  const day = formatDay(item.targetDate);

  let text: string;

  if (item.beat === 'confirm') {
    const when = item.leadDays === 0 ? 'today' : `on ${day}`;
    text =
      item.leadDays === 0
        ? `${item.spotName} is peaking at ${rounded} for ${species} today. Go.`
        : `${item.spotName} is still forecast to peak at ${rounded} for ${species} ${when}. It held.`;
  } else if (item.leadDays <= 1) {
    const when = item.leadDays === 0 ? 'Today' : 'Tomorrow';
    text = `${when} is the best day in your next week at ${item.spotName}: ${rounded} for ${species}.`;
  } else {
    text = `${item.spotName} is forecast to peak at ${rounded} for ${species} on ${day}, the best day in your next week. That is ${leadPhrase(item.leadDays)}, so it can still move.`;
  }

  // The alert promised a species and we scored a different one. Say so rather
  // than quietly letting the number stand in for something it is not about.
  if (!item.speciesMatched) {
    text += ` This is the spot's best species, not the one on your alert.`;
  }

  return text;
}

/** The subject line, which is the only part most people read. */
function subjectFor(items: ScoreAlertItem[]): string {
  const top = items[0];
  const rounded = Math.round(top.score);
  const species = top.speciesName ?? 'your target species';
  const day = formatDay(top.targetDate);

  let lead: string;
  if (top.beat === 'confirm' && top.leadDays === 0) {
    lead = `Today at ${top.spotName}: ${species} ${rounded}`;
  } else if (top.beat === 'confirm') {
    lead = `Confirmed for ${day}: ${species} ${rounded} at ${top.spotName}`;
  } else if (top.leadDays === 0) {
    lead = `Today is your best day for ${species} at ${top.spotName}: ${rounded}`;
  } else {
    lead = `${day} looks strong for ${species} at ${top.spotName}: ${rounded}`;
  }

  const rest = items.length - 1;
  if (rest === 0) return lead;
  return `${lead}, and ${rest} more ${rest === 1 ? 'spot' : 'spots'}`;
}

/**
 * SMS, held to one 160-character segment.
 *
 * A digest does not fit a text message, so past a single item the text stops
 * trying to be the message and becomes a pointer to it. Naming the best day and
 * the count is enough to decide whether to look now or at lunch.
 *
 * Where it points depends on whether an email is actually going out. An
 * angler who picked SMS and nothing else has no email to be sent to, so
 * "full rundown in your email" would be pointing at a message that does not
 * exist. They get sent to the app instead.
 */
function smsFor(items: ScoreAlertItem[], alsoEmailing: boolean): string {
  const top = items[0];
  const rounded = Math.round(top.score);
  const species = top.speciesName ?? 'your species';
  const day = formatDay(top.targetDate);
  const rest = items.length - 1;

  let text: string;

  if (rest === 0) {
    if (top.beat === 'confirm') {
      text =
        top.leadDays === 0
          ? `Today at ${top.spotName}: ${species} peaking at ${rounded}. Go.`
          : `Confirmed: ${day} at ${top.spotName}, ${species}, peak ${rounded}. It held.`;
    } else if (top.leadDays <= 1) {
      const when = top.leadDays === 0 ? 'Today' : 'Tomorrow';
      text = `${when} is your best day for ${species} at ${top.spotName}: ${rounded}.`;
    } else {
      text = `${day} looks strong for ${species} at ${top.spotName}: ${rounded}, ${leadPhrase(top.leadDays)}. Forecast can still move.`;
    }
  } else {
    const where = alsoEmailing ? 'Full rundown in your email.' : 'See them all at reelcaster.com/alerts';
    text = `${day}: ${top.spotName} ${rounded} for ${species}, plus ${rest} more ${rest === 1 ? 'spot' : 'spots'}. ${where}`;
  }

  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/** One row of the multi-item list. */
function rowHtml(item: ScoreAlertItem, appBase: string): string {
  const rounded = Math.round(item.score);
  const tier = tierFor(rounded);
  const species = item.speciesName ?? 'Best species';
  const href = item.spotSlug ? `${appBase}/explore/spot/${item.spotSlug}` : appBase;
  const note = item.beat === 'confirm' ? 'Confirmed' : leadPhrase(item.leadDays);

  return `
    <tr>
      <td style="padding: 14px 0; border-top: 1px solid ${RULE};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <p style="margin: 0 0 3px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">
                ${escapeHtml(dayLabel(item))} &middot; ${escapeHtml(note)}
              </p>
              <a href="${href}" style="font-size: 15px; font-weight: 600; color: ${INK}; text-decoration: none;">${escapeHtml(item.spotName)}</a>
              <p style="margin: 3px 0 0; font-size: 13px; color: ${INK_MUTE};">${escapeHtml(species)}${
                // The alert named a species and we scored a different one. The
                // single-item body says so in its sentence; a row has no
                // sentence, and dropping the caveat here would let the number
                // quietly stand in for something it is not about.
                item.speciesMatched ? '' : ' <span style="font-style: italic;">(spot best, not your species)</span>'
              }</p>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 74px;">
              <div style="font-size: 30px; line-height: 1; font-weight: 800; letter-spacing: -0.03em; color: ${tier.num};">${rounded}</div>
              <span style="display: inline-block; margin-top: 5px; background-color: ${tier.bg}; color: ${tier.ink}; font-family: ${MONO}; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; padding: 2px 8px; border-radius: 3px;">${tier.label.toUpperCase()}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function generateScoreAlertDigest(
  params: ScoreAlertDigestParams,
): ScoreAlertMessage {
  const { items, smsItems = items, alsoEmailing, appBase, manageAlertsUrl } = params;

  if (items.length === 0) {
    throw new Error('generateScoreAlertDigest called with no items');
  }

  const subject = subjectFor(items);
  // Empty when none of today's alerts asked for a text. The caller reads this
  // as "no SMS to send" rather than sending an empty message.
  const sms = smsItems.length > 0 ? smsFor(smsItems, alsoEmailing) : '';
  const top = items[0];
  const single = items.length === 1;

  // A single item keeps the hero layout: one big number is the fastest thing to
  // read, and most digests are one item. Several items become a list, because a
  // hero for one of six spots implies a ranking the score does not support.
  let headline: string;
  let body: string;

  if (single) {
    if (top.beat === 'confirm') {
      headline = top.leadDays === 0 ? 'Today is the day' : `${formatDay(top.targetDate)} is confirmed`;
    } else {
      headline =
        top.leadDays === 0
          ? 'Today is the best day this week'
          : top.leadDays === 1
            ? 'Tomorrow is the best day this week'
            : `${formatDay(top.targetDate)} is looking strong`;
    }
    body = sentenceFor(top);
  } else {
    const spots = [...new Set(items.map((i) => i.spotName))];
    headline = `${items.length} days worth a look`;
    body = `${joinList(spots.slice(0, 3))}${spots.length > 3 ? ` and ${spots.length - 3} more` : ''}. Soonest first.`;
  }

  const heroHtml = single
    ? `
          <tr>
            <td style="padding: 0 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: top;">
                    <h1 style="margin: 0 0 8px; font-size: 22px; line-height: 1.25; font-weight: 700; color: ${INK};">${escapeHtml(headline)}</h1>
                    ${
                      top.speciesName
                        ? `<span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px;">${escapeHtml(top.speciesName)}</span>`
                        : ''
                    }
                  </td>
                  <td style="vertical-align: top; text-align: right; width: 110px;">
                    <div style="font-size: 52px; line-height: 0.85; font-weight: 800; letter-spacing: -0.04em; color: ${tierFor(Math.round(top.score)).num};">${Math.round(top.score)}</div>
                    <span style="display: inline-block; margin-top: 10px; background-color: ${tierFor(Math.round(top.score)).bg}; color: ${tierFor(Math.round(top.score)).ink}; font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; padding: 3px 12px; border-radius: 4px;">${tierFor(Math.round(top.score)).label.toUpperCase()}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 28px 0;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: ${INK};">${escapeHtml(body)}</p>
            </td>
          </tr>`
    : `
          <tr>
            <td style="padding: 0 28px;">
              <h1 style="margin: 0 0 6px; font-size: 22px; line-height: 1.25; font-weight: 700; color: ${INK};">${escapeHtml(headline)}</h1>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: ${INK_MUTE};">${escapeHtml(body)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 28px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                ${items.map((i) => rowHtml(i, appBase)).join('')}
              </table>
            </td>
          </tr>`;

  const ctaHref = single && top.spotSlug ? `${appBase}/explore/spot/${top.spotSlug}` : `${appBase}/alerts`;
  const ctaLabel = single ? 'See the forecast' : 'See all your spots';

  const eyebrow = single
    ? `${dayLabel(top)} &middot; ${escapeHtml(top.spotName)}`
    : 'Your alerts';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${SANS}; background-color: ${BAND};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BAND};">
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid ${RULE}; border-top: 3px solid ${BRAND}; border-radius: 10px; overflow: hidden;">

          <tr>
            <td style="padding: 22px 28px 0;">
              <p style="margin: 0 0 14px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK_MUTE};">
                ${eyebrow}
              </p>
            </td>
          </tr>
${heroHtml}

          <tr>
            <td style="padding: 22px 28px 26px;">
              <a href="${ctaHref}" style="display: inline-block; background-color: ${BRAND}; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 20px; border-radius: 6px;">${ctaLabel}</a>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 28px 20px; border-top: 1px solid ${RULE};">
              <p style="margin: 0; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.06em; color: ${INK_MUTE};">
                One message a day, at most. <a href="${manageAlertsUrl}" style="color: ${INK_MUTE};">Manage your alerts</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, sms };
}
