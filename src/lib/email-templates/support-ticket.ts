/**
 * Support Ticket Email Templates
 *
 * Two emails per filed ticket:
 *  - `buildSupportTriageEmail`  → the support inbox. Optimised for triage, not
 *    looks: every fact needed to answer without a round-trip, up top.
 *  - `buildSupportAckEmail`     → the member. Confirms receipt and hands them
 *    the ticket ref.
 *
 * Both are plain inlined-style HTML like the rest of src/lib/email-templates —
 * no build step, no external CSS, safe in every mail client.
 */

import { SITE_URL } from '@/lib/site';

export interface SupportTicketEmailParams {
  ticketRef: string;
  category: string;
  categoryLabel: string;
  subject: string;
  body: string;
  userEmail: string;
  userId: string;
  tier: string;
  status: string;
  createdAt: string;
  /** Submission-time context: page, userAgent, spotSlug, appBuild… */
  context: Record<string, unknown>;
}

export interface EmailContent {
  subject: string;
  html: string;
}

/**
 * Ticket bodies are user-authored and land in an HTML email. Escape before
 * interpolation — a member pasting a snippet with angle brackets should see
 * their snippet, not a broken layout, and an unescaped body is a live script
 * injection into whatever inbox reads it.
 */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Preserve the member's line breaks without trusting their markup. */
function escMultiline(value: string): string {
  return esc(value).replace(/\r?\n/g, '<br />');
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
    timeZoneName: 'short',
  });
}

const SHELL_OPEN = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F0EFED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#0B1220;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">`;

const SHELL_CLOSE = `</div></body></html>`;

const MONO = `font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;

function labelCell(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #E6E4E1;${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8A92A4;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #E6E4E1;font-size:14px;color:#0B1220;">${value}</td>
  </tr>`;
}

/** Internal triage email → the support inbox. */
export function buildSupportTriageEmail(
  p: SupportTicketEmailParams,
): EmailContent {
  const contextRows = Object.entries(p.context)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:4px 12px 4px 0;${MONO};font-size:11px;color:#8A92A4;vertical-align:top;white-space:nowrap;">${esc(k)}</td>
          <td style="padding:4px 0;${MONO};font-size:11px;color:#2A3344;word-break:break-word;">${esc(
            typeof v === 'string' ? v : JSON.stringify(v),
          )}</td>
        </tr>`,
    )
    .join('');

  const html = `${SHELL_OPEN}
  <div style="background:#FFFFFF;border:1px solid #E6E4E1;border-radius:12px;overflow:hidden;">
    <div style="padding:16px 20px;background:#1E40E0;color:#FFFFFF;">
      <div style="${MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.75;">The Port · Pro support</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px;">${esc(p.ticketRef)} · ${esc(p.categoryLabel)}</div>
    </div>

    <div style="padding:20px;">
      <div style="font-size:17px;font-weight:700;color:#0B1220;margin:0 0 4px;">${esc(p.subject)}</div>
      <div style="${MONO};font-size:11px;color:#8A92A4;margin-bottom:16px;">${esc(formatWhen(p.createdAt))}</div>

      <div style="background:#F7F6F4;border:1px solid #E6E4E1;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#2A3344;white-space:normal;">
        ${escMultiline(p.body)}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        ${labelCell('From', `<a href="mailto:${esc(p.userEmail)}" style="color:#1E40E0;text-decoration:none;">${esc(p.userEmail)}</a>`)}
        ${labelCell('Tier', `${esc(p.tier)} · ${esc(p.status)}`)}
        ${labelCell('User ID', `<span style="${MONO};font-size:12px;">${esc(p.userId)}</span>`)}
        ${labelCell('Category', esc(p.category))}
      </table>

      ${
        contextRows
          ? `<div style="margin-top:20px;">
              <div style="${MONO};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#8A92A4;margin-bottom:8px;">Submission context</div>
              <table style="width:100%;border-collapse:collapse;">${contextRows}</table>
            </div>`
          : ''
      }

      <div style="margin-top:24px;">
        <a href="mailto:${esc(p.userEmail)}?subject=${encodeURIComponent(`Re: [${p.ticketRef}] ${p.subject}`)}"
           style="display:inline-block;background:#1E40E0;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;">
          Reply to member
        </a>
      </div>
    </div>
  </div>
${SHELL_CLOSE}`;

  return {
    subject: `[${p.ticketRef}] ${p.categoryLabel}: ${p.subject}`,
    html,
  };
}

/** Acknowledgement email → the member who filed it. */
export function buildSupportAckEmail(
  p: Pick<
    SupportTicketEmailParams,
    'ticketRef' | 'subject' | 'body' | 'categoryLabel' | 'createdAt'
  >,
): EmailContent {
  const html = `${SHELL_OPEN}
  <div style="background:#FFFFFF;border:1px solid #E6E4E1;border-radius:12px;overflow:hidden;">
    <div style="padding:20px;border-bottom:1px solid #E6E4E1;">
      <div style="${MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A92A4;">The Port · Pro support</div>
      <div style="font-size:22px;font-weight:700;color:#0B1220;margin-top:6px;">We&rsquo;ve got it.</div>
      <div style="font-size:15px;line-height:1.6;color:#2A3344;margin-top:8px;">
        Your request is in the queue. Pro tickets get a reply within
        <strong>one business day</strong> &mdash; usually much sooner.
      </div>
    </div>

    <div style="padding:20px;">
      <table style="width:100%;border-collapse:collapse;">
        ${labelCell('Reference', `<strong style="${MONO};font-size:15px;">${esc(p.ticketRef)}</strong>`)}
        ${labelCell('Category', esc(p.categoryLabel))}
        ${labelCell('Filed', esc(formatWhen(p.createdAt)))}
      </table>

      <div style="margin-top:18px;">
        <div style="${MONO};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#8A92A4;margin-bottom:6px;">Your message</div>
        <div style="font-size:15px;font-weight:600;color:#0B1220;margin-bottom:6px;">${esc(p.subject)}</div>
        <div style="background:#F7F6F4;border:1px solid #E6E4E1;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#2A3344;">
          ${escMultiline(p.body)}
        </div>
      </div>

      <div style="margin-top:24px;">
        <a href="${SITE_URL}/theport"
           style="display:inline-block;background:#1E40E0;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;">
          View in The Port
        </a>
      </div>

      <div style="margin-top:20px;font-size:13px;line-height:1.6;color:#8A92A4;">
        Just reply to this email to add anything &mdash; keep
        <strong style="${MONO};color:#2A3344;">${esc(p.ticketRef)}</strong> in the
        subject line and it&rsquo;ll thread onto the same ticket.
      </div>
    </div>
  </div>

  <div style="text-align:center;padding:16px 8px;font-size:12px;color:#8A92A4;">
    ReelCaster &middot; Victoria, BC
  </div>
${SHELL_CLOSE}`;

  return {
    subject: `[${p.ticketRef}] We received your request`,
    html,
  };
}
