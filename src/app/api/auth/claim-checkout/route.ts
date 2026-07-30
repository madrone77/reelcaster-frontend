import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import { findUserIdByEmail } from '@/lib/checkout-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * How long after checkout a session may still be redeemed for a sign-in link.
 *
 * The exchange exists to carry someone straight from Stripe into their new
 * account, which happens in seconds. Anything beyond a short window is a
 * credential sitting in browser history for no benefit — they can always use
 * the magic-link flow on /login instead.
 */
const CLAIM_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Exchange a completed Stripe Checkout session for a one-time sign-in link.
 *
 * This is how the buy-first flow finishes: an anonymous visitor paid, the
 * webhook created their account, and they arrive at /billing/success with no
 * session. Rather than making them go find an email, we hand them a magic
 * link and they land inside the product already signed in.
 *
 * ── Why this isn't a hole ────────────────────────────────────────────────
 *
 * `session_id` travels in the success_url, so it ends up in browser history,
 * referrer headers, and any screenshot of the address bar. Treat it as
 * low-grade secret, and pile on constraints so a leak is worthless:
 *
 *   1. The session must exist in Stripe, be `complete`, and have a
 *      subscription — a cancelled or abandoned session buys nothing.
 *   2. It must be recent (CLAIM_WINDOW_MS). Old links stop working.
 *   3. It must be unredeemed. `checkout_claims.session_id` is the primary key,
 *      so the insert itself is the lock — two concurrent claims can't both
 *      win, and a replay after the fact loses.
 *   4. It only ever mints a link for the account the SESSION names. It can't
 *      be pointed at an arbitrary email.
 *
 * Accounts that already existed before this checkout are refused outright:
 * that path would let anyone holding a session id sign in as an established
 * user. Those buyers were sent to sign in at checkout time anyway.
 */
export async function POST(request: NextRequest) {
  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = (body?.session_id ?? '').toString().trim();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 400 });
  }

  const stripe = await getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: 'invalid_session' }, { status: 404 });
  }

  // (1) Completed, and actually bought a subscription.
  if (session.status !== 'complete' || !session.subscription) {
    return NextResponse.json({ error: 'session_incomplete' }, { status: 409 });
  }

  // (2) Recent.
  const createdMs = (session.created ?? 0) * 1000;
  if (!createdMs || Date.now() - createdMs > CLAIM_WINDOW_MS) {
    return NextResponse.json({ error: 'session_expired' }, { status: 410 });
  }

  // Only anonymous checkouts are claimable. A session that already carried a
  // supabase_user_id belonged to someone who was signed in — they don't need
  // this, and honouring it would turn a session id into a way to become them.
  if (session.metadata?.supabase_user_id) {
    return NextResponse.json({ error: 'not_claimable' }, { status: 403 });
  }

  const email =
    session.metadata?.pending_email ||
    session.customer_details?.email ||
    session.customer_email ||
    null;

  if (!email) {
    return NextResponse.json({ error: 'no_email_on_session' }, { status: 409 });
  }

  // (4) The account is whichever one the webhook made for this email. If the
  // webhook hasn't landed yet the client polls and retries.
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(admin, email);
  } catch (err) {
    console.error('[claim-checkout] user lookup failed', err);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'account_pending' }, { status: 202 });
  }

  // Refuse accounts that predate this checkout — see the header comment.
  const { data: settings } = await admin
    .from('user_settings')
    .select('created_via_checkout')
    .eq('user_id', userId)
    .maybeSingle();

  if (!settings?.created_via_checkout) {
    return NextResponse.json({ error: 'not_claimable' }, { status: 403 });
  }

  // (3) Single use. The PK collision is the lock; do this BEFORE minting the
  // link so a racing request can't also get one.
  const { error: claimError } = await admin
    .from('checkout_claims')
    .insert({ session_id: sessionId, user_id: userId });

  if (claimError) {
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  const origin = appOrigin(request);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/billing/success?claimed=1` },
  });

  if (linkError || !link?.properties?.action_link) {
    console.error('[claim-checkout] could not mint sign-in link', linkError);
    // The claim row is already written, so this session is spent. Say so
    // plainly rather than pretending a retry will help.
    return NextResponse.json({ error: 'link_failed' }, { status: 502 });
  }

  return NextResponse.json({ url: link.properties.action_link });
}
