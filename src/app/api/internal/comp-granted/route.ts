/**
 * POST /api/internal/comp-granted  { user_id, expires_at, year_long? }
 *   → { ok: true, sent: boolean }
 *
 * Tells a customer their comped Pro is live. Called by the bluecaster admin
 * immediately after it writes the grant.
 *
 * Why the email is sent from here rather than from bluecaster, which is where
 * the button is: this app owns every customer-facing email — the Resend sender,
 * the ReelCaster shell, the wording, the unsubscribe surface. A second service
 * emailing our customers directly would be a second place for the branding and
 * the from-address to drift, and it would need its own Supabase auth lookup to
 * turn a user id into an inbox.
 *
 * Auth is the same CRON_SECRET bearer every other internal route uses. The
 * route reveals nothing and writes nothing; the worst an attacker with the
 * secret can do is send a customer an email about a grant they already have.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { compGrantedEmail } from '@/lib/email-templates/billing';
import { sendEmail } from '@/lib/email-service';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(request: NextRequest) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const expected = process.env.CRON_SECRET;
  if (!expected || bearer !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { user_id?: string; expires_at?: string; year_long?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const userId = body.user_id?.trim();
  const expiresAt = body.expires_at?.trim();
  if (!userId || !expiresAt || Number.isNaN(Date.parse(expiresAt))) {
    return NextResponse.json({ error: 'user_id and a valid expires_at are required' }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    console.error('[comp-granted] no email for user', userId, error);
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const { subject, html } = compGrantedEmail({
    expiresAt,
    yearLong: body.year_long ?? false,
  });
  const result = await sendEmail({ to: data.user.email, subject, html });

  if (!result.success) {
    // Surfaced rather than swallowed: the caller shows the admin that the grant
    // landed but the customer wasn't told, which is the one failure here that
    // needs a human to do something about it.
    console.error('[comp-granted] send failed', result.error);
    return NextResponse.json({ error: result.error ?? 'send_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: true });
}
