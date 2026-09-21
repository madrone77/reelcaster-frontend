/**
 * POST /api/stripe/checkout/abandoned  { t: <cancel token> } → { ok: true }
 *
 * Posted by /billing/cancel when Stripe's Back arrow brings a signed-out buyer
 * home. The token is the one anon-checkout put on the cancel URL and on the
 * session's metadata; the session it finds says which address to write to.
 * The abandoned-checkout email then goes out now instead of 3 hours later.
 * Who qualifies, and why an address can only ever get one, is in
 * src/lib/checkout-reminder.ts.
 *
 * Always answers { ok: true }: the page does nothing with the result, and
 * saying whether an email went out would tell a caller whether an address has
 * an account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { PAY_FIRST_ENABLED } from '@/lib/anon-checkout';
import { armsFromCookieHeader } from '@/lib/split-tests';
import {
  CANCEL_TOKEN_RE,
  findCancelledCandidate,
  sendCheckoutReminder,
} from '@/lib/checkout-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(request: NextRequest) {
  let token = '';
  try {
    const body = await request.json();
    token = (body?.t ?? '').toString().trim();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!CANCEL_TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }
  if (!PAY_FIRST_ENABLED) return NextResponse.json({ ok: true });

  try {
    const stripe = await getStripe();
    const candidate = await findCancelledCandidate(stripe, admin, token);
    if (candidate) {
      const outcome = await sendCheckoutReminder(admin, candidate, {
        trigger: 'cancel',
        cookieArms: armsFromCookieHeader(request.headers.get('cookie')),
      });
      console.info('[checkout abandoned]', outcome);
    }
  } catch (err) {
    // The cron still covers this address once the session expires.
    console.error('[checkout abandoned] failed', err);
  }
  return NextResponse.json({ ok: true });
}
