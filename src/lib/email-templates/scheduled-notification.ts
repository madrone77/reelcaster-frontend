/**
 * Scheduled Notification Email Template
 *
 * Personalized fishing forecast digest — styled to match the ReelCaster app's
 * explore spot card (light, mono labels, tiered score, conditions KPI grid),
 * the same language as the real-time custom-alert email.
 */

import type {
  ForecastDay,
  WeatherAlert,
  RegulationChange,
} from '../notification-service';
import type { DFONotice } from '../dfo-notice-service';

export interface ScheduledNotificationEmailData {
  userName?: string;
  userEmail: string;
  locationName?: string;
  bestDay: ForecastDay;
  forecastDays: ForecastDay[];
  weatherAlerts?: WeatherAlert[];
  regulationChanges?: RegulationChange[];
  dfoNotices?: DFONotice[];
  speciesNames?: string[];
  preferences?: {
    fishing_score_threshold: number;
    wind_speed_threshold_kph: number;
    precipitation_threshold_mm: number;
  };
}

// ── ReelCaster brand palette (literal hex — email can't use CSS vars) ──
const MONO =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const BRAND = '#1E40E0';
const BRAND_SOFT = '#E8EDFF';
const INK = '#0F172A';
const INK_SOFT = '#334155';
const INK_MUTE = '#64748B';
const RULE = '#E2E8F0';
const BAND = '#F1F5F9';
const SURFACE = '#F8FAFC';

// Tiering matches the app (Good ≥75 / Fair ≥55 / Poor).
function scoreTier(score: number): { label: string; num: string; bg: string; ink: string } {
  if (score >= 75) return { label: 'Good', num: '#16A34A', bg: '#DCFCE7', ink: '#166534' };
  if (score >= 55) return { label: 'Fair', num: '#D97706', bg: '#FEF3C7', ink: '#92400E' };
  return { label: 'Poor', num: '#DC2626', bg: '#FEE2E2', ink: '#991B1B' };
}

function getScoreLabel(score: number): string {
  return scoreTier(score).label;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getSeverityColor(severity: 'warning' | 'danger'): string {
  return severity === 'danger' ? '#DC2626' : '#D97706';
}

export function generateScheduledNotificationEmail(
  data: ScheduledNotificationEmailData
): string {
  const {
    bestDay,
    forecastDays,
    weatherAlerts,
    regulationChanges,
    dfoNotices,
    locationName,
    speciesNames,
  } = data;

  const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://reelcaster.com';
  const LOGO = `${BASE}/reelcaster-mark-email.png`;

  const bestTier = scoreTier(bestDay.score);

  // Best-day conditions KPI grid, like the explore card's WIND/SEA/CURRENT row.
  const kpis = [
    { label: 'Temp', value: `${bestDay.avgTemp}°C` },
    { label: 'Wind', value: `${bestDay.avgWind} km/h` },
    { label: 'Rain', value: `${bestDay.precipitation} mm` },
  ];
  const kpiCells = kpis
    .map(
      (k) => `
                        <td style="padding: 14px 0 0; vertical-align: top;">
                          <div style="font-family: ${MONO}; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">${k.label}</div>
                          <div style="font-family: ${MONO}; font-size: 13px; font-weight: 600; color: ${INK}; margin-top: 3px;">${k.value}</div>
                        </td>`,
    )
    .join('');

  const speciesHtml =
    speciesNames && speciesNames.length > 0
      ? `
          <tr>
            <td style="padding: 24px 28px 0;">
              <p style="margin: 0 0 10px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">Optimized for</p>
              ${speciesNames
                .map(
                  (name) =>
                    `<span style="display: inline-block; margin: 0 6px 6px 0; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 4px;">${name}</span>`,
                )
                .join('')}
            </td>
          </tr>`
      : '';

  const weatherHtml =
    weatherAlerts && weatherAlerts.length > 0
      ? `
          <tr>
            <td style="padding: 24px 28px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="margin: 0 0 10px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #92400E;">Weather alerts</p>
                    ${weatherAlerts
                      .map(
                        (alert) => `
                    <p style="margin: 0 0 6px; font-size: 13px; line-height: 1.5; color: #78350F;">
                      <span style="color: ${getSeverityColor(alert.severity)}; font-weight: 700;">${alert.type.replace('_', ' ').toUpperCase()}:</span>
                      ${alert.message}
                    </p>`,
                      )
                      .join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const forecastRows = forecastDays
    .map((day) => {
      const t = scoreTier(day.score);
      return `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid ${RULE}; font-size: 14px; color: ${INK};">${formatDate(day.date)}</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid ${RULE}; font-family: ${MONO}; font-size: 12px; color: ${INK_SOFT};">${day.conditions}</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid ${RULE}; text-align: right;">
                    <span style="display: inline-block; background-color: ${t.bg}; color: ${t.ink}; font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 4px;">${day.score} ${t.label.toUpperCase()}</span>
                  </td>
                </tr>`;
    })
    .join('');

  const regulationHtml =
    regulationChanges && regulationChanges.length > 0
      ? `
          <tr>
            <td style="padding: 24px 28px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_SOFT}; border: 1px solid #C7D2FE; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="margin: 0 0 12px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${BRAND};">Regulation updates</p>
                    ${regulationChanges
                      .map(
                        (change) => `
                    <div style="margin-bottom: 10px; padding: 12px; background-color: #ffffff; border: 1px solid ${RULE}; border-radius: 6px;">
                      <div style="color: ${INK}; font-weight: 700; font-size: 14px; margin-bottom: 4px;">${change.species_name}</div>
                      <div style="color: ${INK_SOFT}; font-size: 13px; margin-bottom: 4px;">${change.change_type}: ${change.old_value} → ${change.new_value}</div>
                      <div style="font-family: ${MONO}; color: ${INK_MUTE}; font-size: 11px;">Effective ${change.effective_date}</div>
                    </div>`,
                      )
                      .join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const dfoHtml =
    dfoNotices && dfoNotices.length > 0
      ? `
          <tr>
            <td style="padding: 24px 28px 0;">
              <p style="margin: 0 0 12px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">DFO fishery notices</p>
              ${dfoNotices
                .slice(0, 5)
                .map((notice) => {
                  const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
                    critical: { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
                    high: { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
                    medium: { bg: BRAND_SOFT, border: BRAND, text: BRAND },
                    low: { bg: SURFACE, border: '#CBD5E1', text: INK_SOFT },
                  };
                  const colors = priorityColors[notice.priority_level] || priorityColors.medium;
                  const noticeType = notice.is_biotoxin_alert
                    ? 'Biotoxin alert'
                    : notice.is_sanitary_closure
                      ? 'Sanitary closure'
                      : notice.is_closure
                        ? 'Closure'
                        : notice.is_opening
                          ? 'Opening'
                          : 'Information';

                  return `
              <div style="margin-bottom: 10px; padding: 12px 14px; background-color: ${colors.bg}; border-left: 3px solid ${colors.border}; border-radius: 6px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 6px;">
                  <tr>
                    <td style="font-family: ${MONO}; color: ${colors.text}; font-weight: 700; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;">${noticeType}</td>
                    <td style="text-align: right; font-family: ${MONO}; color: ${colors.text}; font-size: 10px;">${notice.notice_number}</td>
                  </tr>
                </table>
                <div style="color: ${INK}; font-weight: 700; font-size: 14px; margin-bottom: 4px;">${notice.title}</div>
                ${
                  notice.areas && notice.areas.length > 0
                    ? `<div style="color: ${INK_SOFT}; font-size: 12px; margin-bottom: 4px;">Areas: ${notice.areas.join(', ')}${notice.subareas && notice.subareas.length > 0 ? ` (${notice.subareas.slice(0, 3).join(', ')}${notice.subareas.length > 3 ? '…' : ''})` : ''}</div>`
                    : ''
                }
                ${
                  notice.species && notice.species.length > 0
                    ? `<div style="color: ${INK_SOFT}; font-size: 12px; margin-bottom: 6px;">Species: ${notice.species.slice(0, 3).join(', ')}${notice.species.length > 3 ? '…' : ''}</div>`
                    : ''
                }
                <a href="${notice.notice_url}" style="color: ${BRAND}; text-decoration: none; font-size: 12px; font-weight: 600;">View full notice →</a>
              </div>`;
                })
                .join('')}
              ${
                dfoNotices.length > 5
                  ? `<p style="margin: 0; text-align: center; font-family: ${MONO}; font-size: 11px; color: ${INK_MUTE};">+ ${dfoNotices.length - 5} more notices online</p>`
                  : ''
              }
            </td>
          </tr>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your fishing forecast · ReelCaster</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${SANS}; background-color: ${BAND};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BAND};">
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid ${RULE}; border-top: 3px solid ${BRAND}; border-radius: 10px; overflow: hidden;">

          <!-- App-style toolbar header: logo + digest pill -->
          <tr>
            <td style="padding: 16px 28px; border-bottom: 1px solid ${RULE};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="${LOGO}" alt="ReelCaster" width="100" height="46" style="display: block; border: 0; outline: none; text-decoration: none;">
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 9px; border-radius: 4px;">Forecast digest</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Best day, as a spot-style score card -->
          <tr>
            <td style="padding: 26px 28px 0;">
              <p style="margin: 0 0 16px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK_MUTE};">
                Your forecast${locationName ? ` · ${locationName}` : ''}
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid ${RULE}; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px 22px; vertical-align: top;">
                    <span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px;">Best day</span>
                    <h2 style="margin: 12px 0 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1.2;">${formatDate(bestDay.date)}</h2>
                    <p style="margin: 10px 0 0; font-family: ${MONO}; font-size: 12px; color: ${INK_SOFT};">${bestTier.label} conditions</p>
                  </td>
                  <td style="padding: 20px 22px; vertical-align: top; text-align: right; white-space: nowrap;">
                    <div style="font-size: 56px; line-height: 0.85; font-weight: 800; letter-spacing: -0.04em; color: ${bestTier.num};">${bestDay.score}</div>
                    <span style="display: inline-block; margin-top: 12px; background-color: ${bestTier.bg}; color: ${bestTier.ink}; font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; padding: 3px 12px; border-radius: 4px;">${bestTier.label.toUpperCase()}</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 0 22px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid ${RULE};">
                      <tr>${kpiCells}</tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${speciesHtml}
${weatherHtml}

          <!-- 7-day forecast -->
          <tr>
            <td style="padding: 24px 28px 0;">
              <p style="margin: 0 0 12px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">7-day forecast</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid ${RULE}; border-radius: 8px; overflow: hidden;">
                ${forecastRows}
              </table>
            </td>
          </tr>
${regulationHtml}
${dfoHtml}

          <!-- CTA -->
          <tr>
            <td style="padding: 26px 28px; text-align: center;">
              <a href="${BASE}" style="display: inline-block; background-color: ${BRAND}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;">View full forecast →</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 28px; background-color: ${BAND}; border-top: 1px solid ${RULE}; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 13px;">
                <a href="${BASE}/profile/forecast-emails" style="color: ${BRAND}; text-decoration: none; font-weight: 600;">Manage preferences</a>
                <span style="color: #CBD5E1;">&nbsp;·&nbsp;</span>
                <a href="${BASE}/profile" style="color: ${BRAND}; text-decoration: none; font-weight: 600;">Unsubscribe</a>
              </p>
              <p style="margin: 0; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.04em; color: #94A3B8;">ReelCaster · Your personal fishing forecast</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateNotificationSubject(data: ScheduledNotificationEmailData): string {
  const { bestDay, locationName } = data;
  const scoreLabel = getScoreLabel(bestDay.score);
  const dayName = formatDate(bestDay.date).split(',')[0]; // Get weekday

  // Phase 6: prefix scheduled digests with "Forecast:" so they don't get
  // confused with real-time "Alert:" emails in the inbox.
  return `Forecast: ${scoreLabel} fishing ${dayName} — ${bestDay.score}/100${locationName ? ` in ${locationName}` : ''}`;
}
