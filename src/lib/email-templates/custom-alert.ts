/**
 * Custom Alert Email Template
 *
 * Generates HTML email for custom fishing condition alerts — styled to match
 * the ReelCaster app's explore spot card (light, mono labels, tier score,
 * conditions KPI grid).
 */

import type { ConditionSnapshot } from '@/lib/custom-alert-engine';

interface CustomAlertEmailParams {
  alertName: string;
  locationName: string;
  matchedTriggers: string[];
  conditionSnapshot: ConditionSnapshot;
  logicMode: 'AND' | 'OR';
  forecastUrl: string;
  manageAlertsUrl: string;
  /** Score-alert mode produces a polished subject like "Chinook peak today at Pedder Bay — 82 at 11am". */
  alertKind?: 'composite' | 'score';
  scoreThreshold?: number | null;
  speciesName?: string | null;
}

interface EmailContent {
  subject: string;
  html: string;
}

/** Compass point only (no degrees) — for the compact KPI grid. */
function windDirShort(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}

const TIDE_SHORT: Record<string, string> = {
  incoming: 'Incoming',
  outgoing: 'Outgoing',
  high_slack: 'High slack',
  low_slack: 'Low slack',
};

const SOLUNAR_SHORT: Record<string, string> = {
  major: 'Major',
  minor: 'Minor',
  none: 'None',
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function generateCustomAlertEmail(params: CustomAlertEmailParams): EmailContent {
  const {
    alertName,
    locationName,
    matchedTriggers,
    conditionSnapshot,
    logicMode,
    forecastUrl,
    manageAlertsUrl,
    alertKind,
    scoreThreshold,
    speciesName,
  } = params;

  const triggeredAt = conditionSnapshot.timestamp
    ? new Date(conditionSnapshot.timestamp)
    : new Date();
  const timestamp = formatTimestamp(triggeredAt.toISOString());

  const triggerCount = matchedTriggers.length;
  const triggerText = triggerCount === 1 ? 'condition' : 'conditions';

  // Phase 6: prefix all real-time triggers with "Alert:" so users can
  // disambiguate them from scheduled "Forecast:" digests at a glance.
  let subject: string;
  if (alertKind === 'score' && conditionSnapshot.fishing_score !== undefined) {
    const speciesLabel = speciesName ?? 'Fishing';
    const score = Math.round(conditionSnapshot.fishing_score);
    const hourLabel = triggeredAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    }).toLowerCase().replace(' ', '');
    subject = `Alert: ${speciesLabel} peak today at ${locationName}, ${score} at ${hourLabel}`;
  } else {
    subject = `Alert: ${alertName}, ${triggerCount} ${triggerText} matched at ${locationName}`;
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

  // Hosted logo — email clients don't render SVG, so we ship a rasterized PNG
  // at an absolute URL.
  const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://reelcaster.com';
  const LOGO = `${BASE}/reelcaster-mark-email.png`;

  // Score → tier, using the same thresholds as the app (Good ≥75 / Fair ≥55).
  const scoreRaw = conditionSnapshot.fishing_score;
  const hasScore =
    matchedTriggers.includes('fishing_score') &&
    scoreRaw !== undefined &&
    scoreRaw !== null;
  const scoreVal = hasScore ? Math.round(scoreRaw as number) : null;
  const tier =
    scoreVal === null
      ? null
      : scoreVal >= 75
        ? { label: 'Good', num: '#16A34A', bg: '#DCFCE7', ink: '#166534' }
        : scoreVal >= 55
          ? { label: 'Fair', num: '#D97706', bg: '#FEF3C7', ink: '#92400E' }
          : { label: 'Poor', num: '#DC2626', bg: '#FEE2E2', ink: '#991B1B' };

  // Compact conditions KPIs — like the explore spot card's WIND/SEA/CURRENT
  // row. Only include the fields the snapshot actually carries (max 4).
  const s = conditionSnapshot;
  const kpis: { label: string; value: string }[] = [];
  if (s.wind_speed_mph !== undefined && s.wind_speed_mph !== null) {
    const dir =
      s.wind_direction !== undefined && s.wind_direction !== null
        ? ` ${windDirShort(s.wind_direction)}`
        : '';
    kpis.push({ label: 'Wind', value: `${Math.round(s.wind_speed_mph)} mph${dir}` });
  }
  if (s.tide_phase) {
    kpis.push({ label: 'Tide', value: TIDE_SHORT[s.tide_phase] || s.tide_phase });
  }
  if (s.pressure_hpa !== undefined && s.pressure_hpa !== null) {
    kpis.push({ label: 'Pressure', value: `${Math.round(s.pressure_hpa)} hPa` });
  }
  if (s.water_temp_c !== undefined && s.water_temp_c !== null) {
    kpis.push({ label: 'Water', value: `${s.water_temp_c.toFixed(1)}°C` });
  }
  if (kpis.length < 4 && s.solunar_phase && s.solunar_phase !== 'none') {
    kpis.push({ label: 'Solunar', value: SOLUNAR_SHORT[s.solunar_phase] || s.solunar_phase });
  }
  const kpiCells = kpis
    .slice(0, 4)
    .map(
      (k) => `
                        <td style="padding: 14px 0 0; vertical-align: top;">
                          <div style="font-family: ${MONO}; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">${k.label}</div>
                          <div style="font-family: ${MONO}; font-size: 13px; font-weight: 600; color: ${INK}; margin-top: 3px;">${k.value}</div>
                        </td>`,
    )
    .join('');
  const kpiGridHtml = kpis.length
    ? `
                <tr>
                  <td colspan="2" style="padding: 0 22px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid ${RULE};">
                      <tr>${kpiCells}</tr>
                    </table>
                  </td>
                </tr>`
    : '';

  // Chip (species), the left conclusion line, and the right-hand score/badge.
  const speciesChipHtml = speciesName
    ? `<span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px;">${speciesName}</span>`
    : '';

  const conclusionLine = hasScore
    ? scoreThreshold !== undefined && scoreThreshold !== null
      ? `Above your ${scoreThreshold} threshold`
      : 'ReelCaster Score'
    : `${triggerCount} ${triggerText} ${logicMode === 'AND' ? '(all required)' : '(any match)'} matched`;

  const rightHtml =
    hasScore && tier
      ? `<div style="font-size: 56px; line-height: 0.85; font-weight: 800; letter-spacing: -0.04em; color: ${tier.num};">${scoreVal}</div>
                    <span style="display: inline-block; margin-top: 12px; background-color: ${tier.bg}; color: ${tier.ink}; font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; padding: 3px 12px; border-radius: 4px;">${tier.label.toUpperCase()}</span>`
      : `<span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 12px; border-radius: 4px;">Matched</span>`;

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

          <!-- App-style toolbar header: logo + live-alert pill -->
          <tr>
            <td style="padding: 16px 28px; border-bottom: 1px solid ${RULE};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="${LOGO}" alt="ReelCaster" width="100" height="46" style="display: block; border: 0; outline: none; text-decoration: none;">
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="display: inline-block; background-color: #DCFCE7; color: #166534; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 9px; border-radius: 4px;">● Live alert</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Context + spot card -->
          <tr>
            <td style="padding: 26px 28px 0;">
              <p style="margin: 0 0 16px; font-family: ${MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${INK_MUTE};">
                Detected · ${timestamp}
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid ${RULE}; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px 22px; vertical-align: top;">
                    ${speciesChipHtml}
                    <h2 style="margin: ${speciesName ? '12px' : '0'} 0 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1.2;">${locationName}</h2>
                    <p style="margin: 10px 0 0; font-family: ${MONO}; font-size: 12px; color: ${INK_SOFT};">${conclusionLine}</p>
                  </td>
                  <td style="padding: 20px 22px; vertical-align: top; text-align: right; white-space: nowrap;">
                    ${rightHtml}
                  </td>
                </tr>${kpiGridHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 24px 28px; text-align: center;">
              <a href="${forecastUrl}" style="display: inline-block; background-color: ${BRAND}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;">View full forecast →</a>
            </td>
          </tr>

          <!-- Good to know -->
          <tr>
            <td style="padding: 0 28px 26px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${SURFACE}; border: 1px solid ${RULE}; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="margin: 0 0 8px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${INK_MUTE};">Good to know</p>
                    <ul style="margin: 0; padding: 0 0 0 18px; color: ${INK_SOFT}; font-size: 13px; line-height: 1.7;">
                      <li>Conditions can change, so check the forecast before heading out.</li>
                      <li>Always prioritize safety and check local regulations.</li>
                      <li>This alert won&rsquo;t fire again for ${getApproxCooldown()} hours (cooldown).</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 28px; background-color: ${BAND}; border-top: 1px solid ${RULE}; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 13px;">
                <a href="${manageAlertsUrl}" style="color: ${BRAND}; text-decoration: none; font-weight: 600;">Manage your alerts</a>
                <span style="color: #CBD5E1;">&nbsp;·&nbsp;</span>
                <a href="${manageAlertsUrl}" style="color: ${BRAND}; text-decoration: none; font-weight: 600;">Disable this alert</a>
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

  return { subject, html };
}

function getApproxCooldown(): number {
  // Default cooldown - in a real implementation, this would come from the profile
  return 12;
}
