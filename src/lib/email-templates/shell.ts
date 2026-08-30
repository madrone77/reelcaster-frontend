/**
 * The one HTML shell every ReelCaster email is poured into.
 *
 * It lived inside billing.ts, private, until a second family of emails needed
 * the same frame. Two copies of a table-layout email skeleton drift in the way
 * that is hardest to notice: nobody reads the second one, they read the render,
 * and by then a padding value or a brand hex has quietly forked. BlueCaster
 * already carries a third copy of it for the comp-granted notice and its own
 * header says so.
 *
 * Table layout and inline styles are not stylistic. Outlook renders neither
 * flexbox nor a <style> block, so a normal stylesheet is not available here.
 */

import { siteUrl } from '@/lib/site';

export const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const BRAND = '#1E40E0';
export const INK = '#0F172A';
export const INK_SOFT = '#334155';
export const INK_MUTE = '#64748B';
export const RULE = '#E2E8F0';

/**
 * The default footer, which assumes a subscription exists.
 *
 * That assumption is fine for every billing email and wrong for the welcome
 * note sent to a free account, which has nothing to manage and nothing to
 * cancel. Telling someone who has never paid us how to cancel their
 * subscription reads as a charge they did not notice, so callers in that
 * position pass their own.
 */
const BILLING_FOOTER = `ReelCaster &middot; Manage or cancel your subscription anytime from
          <a href="${siteUrl('/profile')}" style="color:${BRAND};">your account</a>.`;

export interface ShellOptions {
  /** Hidden line inbox lists show beside the subject. */
  preheader: string;
  /** Footer HTML. Defaults to the manage-your-subscription line. */
  footerHtml?: string;
}

/** Wrap table rows in the standard card. `bodyHtml` must be `<tr>` elements. */
export function shell(bodyHtml: string, options: ShellOptions): string {
  const { preheader, footerHtml = BILLING_FOOTER } = options;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F8FAFC;font-family:${SANS};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid ${RULE};border-radius:12px;padding:32px;">
        ${bodyHtml}
        <tr><td style="padding-top:28px;border-top:1px solid ${RULE};color:${INK_MUTE};font-size:12px;line-height:18px;">
          ${footerHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Escape a URL for use inside an href attribute.
 *
 * The Port links carry a query string, and a bare `&` between two parameters
 * is an unescaped entity reference in HTML. Browsers forgive it; the sanitisers
 * that email clients run bodies through are less reliable, and a link that
 * arrives as `?s=guides` with the guide id eaten lands the reader on the index
 * instead of the guide. Cheap to be correct.
 */
export function attrUrl(href: string): string {
  return href.replace(/&/g, '&amp;');
}

export function button(href: string, label: string): string {
  return `<a href="${attrUrl(href)}" style="display:inline-block;background:${BRAND};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">${label}</a>`;
}

/**
 * A date as the customer's calendar shows it.
 *
 * The timezone is pinned. Without it this renders in whatever zone the process
 * happens to be in, which is UTC on Vercel and something else on a laptop, and
 * a trial ending at 00:43 UTC is the previous evening in Vancouver. Getting
 * that wrong by a day on a notice that legally has to state when the card is
 * charged is not a rounding error. Pacific covers the whole customer base
 * (BC and Washington), so it is the honest one to show.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Vancouver',
  });
}
