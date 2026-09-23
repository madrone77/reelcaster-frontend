/**
 * GET /api/stripe/checkout/resume?t=<token>
 *
 * The button in the "almost done signing up" email. Opens a fresh signed-out
 * checkout for the address the token was issued to and sends the reader
 * straight to it: no form, no retyping the email.
 *
 * The address never appears in the link. The token is looked up here.
 *
 * The session carries the token in its metadata, and so does the subscription,
 * which is how the webhook knows an account came from this email and credits
 * it (the "Email reminder" tick in the BlueCaster roster).
 *
 * Anything that stops a fresh checkout lands on a page that still works:
 * an unknown token or a failure goes to /plans, and an address that has since
 * made an account goes to sign in rather than to a second purchase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { currencyForRegion } from '@/lib/pricing';
import { findUserIdByEmail } from '@/lib/checkout-account';
import {
  PAY_FIRST_ENABLED,
  createAnonCheckoutSession,
  withSplitCookie,
} from '@/lib/anon-checkout';
import {
  ABANDON_EMAIL_TEST,
  CHECKOUT_REMINDER_TABLE,
  REMINDER_TOKEN_METADATA,
  countReminderEvent,
} from '@/lib/checkout-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Where the link says it came from, in paywall_events and the Bought at column. */
const FROM = 'checkout-reminder-email';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const fallback = () => NextResponse.redirect(new URL('/plans', origin), 303);

  const token = request.nextUrl.searchParams.get('t')?.trim();
  if (!token || !/^[0-9a-f]{32}$/.test(token) || !PAY_FIRST_ENABLED) return fallback();

  const { data: row, error } = await admin
    .from(CHECKOUT_REMINDER_TABLE)
    .select('email, region, clicked_at, variant')
    .eq('token', token)
    .maybeSingle();
  if (error || !row) return fallback();

  if (!row.clicked_at) {
    const { data: first } = await admin
      .from(CHECKOUT_REMINDER_TABLE)
      .update({ clicked_at: new Date().toISOString() })
      .eq('token', token)
      .is('clicked_at', null)
      .select('token');
    if (first?.length) await countReminderEvent(admin, { token, variant: row.variant }, 'cta_click');
  }

  // Signed up since the email went out. Sending them to buy again would open
  // a second subscription the anon path would then refuse to attach.
  if (await findUserIdByEmail(admin, row.email)) {
    return NextResponse.redirect(new URL('/login', origin), 303);
  }

  const region = row.region ?? '';
  try {
    const stripe = await getStripe();
    const created = await createAnonCheckoutSession({
      request,
      stripe,
      admin,
      currency: currencyForRegion(region, request.headers.get('x-vercel-ip-country')),
      email: row.email,
      region,
      from: FROM,
      extraMetadata: { [REMINDER_TOKEN_METADATA]: token },
      // The email's arm rides to Stripe, so a trial from either email is
      // counted for abandon_email_v1 (and the cookie keeps it for later).
      ...(row.variant ? { forceArms: { [ABANDON_EMAIL_TEST]: row.variant } } : {}),
    });
    if (!created.ok || !created.session.url) return fallback();

    return withSplitCookie(
      NextResponse.redirect(created.session.url, 303),
      created.priced,
    );
  } catch (err) {
    console.error('[checkout resume] session failed', err);
    return fallback();
  }
}
