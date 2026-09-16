/**
 * Emails for alert leads: score alerts left by a visitor with no account.
 *
 * The confirm email is the only thing that turns a lead on. Nothing sends to
 * an address until its owner has clicked through, so the list is made of
 * people who asked, and a typo'd or borrowed address never hears from us twice.
 */

import { shell, greeting, button, escapeHtml, attrUrl, INK, INK_SOFT, INK_MUTE, BRAND } from './shell';

export interface AlertLeadConfirmParams {
  name: string;
  spotName: string;
  speciesName: string | null;
  threshold: number;
  confirmUrl: string;
  unsubscribeUrl: string;
}

export function alertLeadConfirmEmail(p: AlertLeadConfirmParams): { subject: string; html: string } {
  const what = p.speciesName
    ? `${escapeHtml(p.speciesName)} at ${escapeHtml(p.spotName)}`
    : escapeHtml(p.spotName);
  const subject = `Confirm your alert for ${p.spotName}`;

  const body = `
    <tr><td>
      ${greeting(p.name)}
      <h1 style="margin:0 0 12px;font-size:22px;line-height:30px;color:${INK};">Confirm your ReelCaster alert</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:${INK_SOFT};">
        We'll email you when ${what} is forecast to score <strong>${p.threshold}+</strong>.
        One tap to switch it on:
      </p>
      <p style="margin:0 0 20px;">${button(p.confirmUrl, 'Confirm my alert')}</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:${INK_MUTE};">
        Didn't ask for this? Ignore this email and you won't hear from us.
      </p>
    </td></tr>`;

  const footerHtml = `ReelCaster &middot; <a href="${attrUrl(p.unsubscribeUrl)}" style="color:${BRAND};">Unsubscribe</a>`;

  return { subject, html: shell(body, { preheader: `Switch on your alert for ${escapeHtml(p.spotName)}`, footerHtml }) };
}

/** Footer for a lead's alert email: no account to manage, so sign up or stop. */
export function alertLeadDigestFooter(signupUrl: string, unsubscribeUrl: string): string {
  return `One message a day, at most. Want alerts on more spots? <a href="${attrUrl(signupUrl)}" style="color: ${INK_MUTE};">Create a free account</a> &middot; <a href="${attrUrl(unsubscribeUrl)}" style="color: ${INK_MUTE};">Unsubscribe</a>`;
}
