/**
 * Score Alert Messages
 *
 * A score alert is now a small conversation about one fishing day rather than a
 * single "conditions are good right now" ping, so the copy changes with the
 * beat:
 *
 *   heads_up    days out, said early enough to book the day off, and explicitly
 *               caveated because the forecast can still move
 *   confirm     the day is here or imminent and it held. Go.
 *   stand_down  we promised this day and it fell apart. Said plainly, because
 *               by now the day off is booked.
 *
 * Every message carries how far out the day is. That is what makes the early
 * ones trustworthy instead of annoying: an angler who knows a number is six
 * days out reads it as a plan, not a promise.
 *
 * Styled to match the composite alert email (same palette, same mark).
 */

import type { AlertBeat } from '@/lib/custom-alert-engine';

export interface ScoreAlertMessageParams {
  beat: AlertBeat;
  spotName: string;
  speciesName: string | null;
  /** False when we scored the spot's best species instead of the one chosen. */
  speciesMatched: boolean;
  /** The fishing day, YYYY-MM-DD. */
  targetDate: string;
  /** 0 = today. */
  leadDays: number;
  score: number;
  threshold: number;
  /** What we told them last time. Only used by stand_down. */
  previousScore?: number | null;
  forecastUrl: string;
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

function leadPhrase(leadDays: number): string {
  if (leadDays === 0) return 'today';
  if (leadDays === 1) return 'tomorrow';
  return `${leadDays} days out`;
}

export function generateScoreAlertMessage(
  params: ScoreAlertMessageParams,
): ScoreAlertMessage {
  const {
    beat,
    spotName,
    speciesName,
    speciesMatched,
    targetDate,
    leadDays,
    score,
    previousScore,
    forecastUrl,
    manageAlertsUrl,
  } = params;

  const day = formatDay(targetDate);
  const rounded = Math.round(score);
  const tier = tierFor(rounded);
  const species = speciesName ?? 'your target species';
  const isToday = leadDays === 0;
  const dayLabel = isToday ? 'Today' : leadDays === 1 ? `Tomorrow, ${day}` : day;

  let subject: string;
  let headline: string;
  let body: string;
  let sms: string;

  if (beat === 'heads_up') {
    subject = `${day} looks strong for ${species} at ${spotName}: ${rounded}`;
    headline = `${day} is looking strong`;
    body = `${spotName} is forecast to peak at ${rounded} for ${species} on ${day}. That is ${leadPhrase(leadDays)}, so it can still move. We will confirm the morning before.`;
    sms = `${day} looks strong for ${species} at ${spotName}: ${rounded}. That is ${leadPhrase(leadDays)} so it can still move, we will confirm the morning before.`;
  } else if (beat === 'confirm') {
    subject = isToday
      ? `Today at ${spotName}: ${species} ${rounded}`
      : `Confirmed for ${day}: ${species} ${rounded} at ${spotName}`;
    headline = isToday ? 'Today is the day' : `${day} is confirmed`;
    body = isToday
      ? `${spotName} is peaking at ${rounded} for ${species} today. Go.`
      : `${spotName} is still forecast to peak at ${rounded} for ${species} on ${day}. It held. Go.`;
    sms = isToday
      ? `Today at ${spotName}: ${species} peaking at ${rounded}. Go.`
      : `Confirmed: ${day} at ${spotName}, ${species}, peak ${rounded}. It held. Go.`;
  } else {
    const from =
      previousScore != null ? `, down from ${Math.round(previousScore)}` : '';
    subject = `${day} at ${spotName} has dropped to ${rounded}`;
    headline = `${day} has fallen apart`;
    body = `${spotName} is now forecast to peak at ${rounded} for ${species} on ${day}${from}. We told you it was looking good, so we are telling you it is not any more. Might be worth keeping the day flexible.`;
    sms = `Heads up: ${day} at ${spotName} has dropped to ${rounded} for ${species}${from}. Might be worth keeping the day flexible.`;
  }

  // The alert promised a species and we scored a different one. Say so rather
  // than quietly letting the number stand in for something it is not about.
  const fallbackNote = speciesMatched
    ? ''
    : ` This is the spot's best species, not the one on your alert.`;
  if (fallbackNote) {
    body += fallbackNote;
    sms += fallbackNote;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${SANS}; background-color: ${BAND};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BAND};">
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid ${RULE}; border-top: 3px solid ${BRAND}; border-radius: 10px; overflow: hidden;">

          <tr>
            <td style="padding: 22px 28px 0;">
              <p style="margin: 0 0 14px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK_MUTE};">
                ${dayLabel} · ${spotName}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: top;">
                    <h1 style="margin: 0 0 8px; font-size: 22px; line-height: 1.25; font-weight: 700; color: ${INK};">${headline}</h1>
                    ${
                      speciesName
                        ? `<span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px;">${speciesName}</span>`
                        : ''
                    }
                  </td>
                  <td style="vertical-align: top; text-align: right; width: 110px;">
                    <div style="font-size: 52px; line-height: 0.85; font-weight: 800; letter-spacing: -0.04em; color: ${tier.num};">${rounded}</div>
                    <span style="display: inline-block; margin-top: 10px; background-color: ${tier.bg}; color: ${tier.ink}; font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; padding: 3px 12px; border-radius: 4px;">${tier.label.toUpperCase()}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 28px 0;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: ${INK};">${body}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 22px 28px 26px;">
              <a href="${forecastUrl}" style="display: inline-block; background-color: ${BRAND}; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 20px; border-radius: 6px;">See the forecast</a>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 28px 20px; border-top: 1px solid ${RULE};">
              <p style="margin: 0; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.06em; color: ${INK_MUTE};">
                <a href="${manageAlertsUrl}" style="color: ${INK_MUTE};">Manage your alerts</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // One SMS segment is 160 characters. Past that the carrier splits it and the
  // angler pays attention to the first half only.
  const smsTrimmed = sms.length > 160 ? `${sms.slice(0, 157)}...` : sms;

  return { subject, html, sms: smsTrimmed };
}
