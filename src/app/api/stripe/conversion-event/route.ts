import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { EXPRESS_MARKER, isExpressSetupIntentId } from '@/lib/express-checkout';
import { metaUserDataHashes } from '@/lib/meta-match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * How stale a checkout credential may be. Same window as /api/stripe/claim: a
 * `session_id` lives in browser history, referrers, and screenshots, so it
 * should stop answering questions shortly after the purchase it describes.
 */
const WINDOW_MS = 30 * 60 * 1000;

/** How hard the browser report chases the webhook. See the POST handler. */
const WRITE_ATTEMPTS = 5;
const WRITE_RETRY_MS = 1200;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Resolved {
  customerId: string;
  createdMs: number;
}

interface Refused {
  error: string;
  status: number;
}

/**
 * `getStripe()` throws when the secret is unset. That is a deployment fault,
 * not a bad request, so it must not surface as a 500 with a stack trace on a
 * page a customer has just paid on — and it must not be mistaken for "that
 * session does not exist" either.
 */
async function stripeOrNull() {
  try {
    return await getStripe();
  } catch {
    return null;
  }
}

/**
 * Tell the checkout return page which Meta event to fire, and under which id.
 *
 * The browser holds a `session_id` and nothing else. The Conversions API keys
 * its events on `<stripe_subscription_id>:<event_type>` (conversion-upload.ts),
 * so without this the two halves of one conversion cannot be deduplicated and
 * every Meta-sourced trial would be counted twice.
 *
 * Unauthenticated, like /api/stripe/claim and for the same reason: a pay-first
 * buyer has no account yet at this point. It is far weaker than that route
 * though — it mints nothing and returns no personal data, only a Stripe
 * subscription id, which is inert without the secret key. The session checks
 * are kept anyway so an arbitrary id cannot be used to probe whether a checkout
 * exists.
 *
 * Answers `event: null` rather than an error for anything that is not a trial.
 * Monthly is charged immediately and starts no trial, and reporting one would
 * be a straight lie to the bidder. This mirrors the webhook exactly, which only
 * records `trial_start` when the subscription status is `trialing`.
 */
export async function GET(request: NextRequest) {
  const sessionId = (new URL(request.url).searchParams.get('session_id') ?? '').trim();

  const nothing = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });

  const express = isExpressSetupIntentId(sessionId);
  if (!sessionId || (!express && !sessionId.startsWith('cs_'))) {
    return nothing({ error: 'invalid_session' }, 400);
  }

  const resolved = express
    ? await customerFromSetupIntent(sessionId)
    : await customerFromCheckoutSession(sessionId);

  if ('error' in resolved) {
    return nothing({ error: resolved.error }, resolved.status);
  }

  if (!resolved.createdMs || Date.now() - resolved.createdMs > WINDOW_MS) {
    return nothing({ error: 'session_expired' }, 410);
  }

  const stripe = await stripeOrNull();
  if (!stripe) return nothing({ error: 'stripe_unavailable' }, 503);

  // `status: 'trialing'` does the whole job: it is the same condition the
  // webhook uses to record a trial_start conversion, so the two can never
  // disagree about whether a trial happened.
  let subscriptions;
  try {
    subscriptions = await stripe.subscriptions.list({
      customer: resolved.customerId,
      status: 'trialing',
      limit: 1,
    });
  } catch {
    return nothing({ error: 'stripe_unavailable' }, 502);
  }

  const subscription = subscriptions.data[0];
  if (!subscription) return nothing({ event: null, event_id: null });

  // The hashed billing email and name, for the pixel's advanced matching. This is the
  // event that matches worst (3.0/10 on 2026-09-08) because the click cookie
  // often does not survive the trip through Stripe, and the address is the
  // identifier that recovers it. Hashed here (src/lib/meta-match.ts) so the
  // page never holds the raw address for a tag. Best effort: a Stripe hiccup
  // on this read costs the match, not the event.
  const customer = await customerIdentity(stripe, resolved.customerId);
  const hashes = await metaUserDataHashes({ email: customer.email, fullName: customer.name });

  return nothing({
    event: 'StartTrial',
    event_id: `${subscription.id}:trial_start`,
    email_hash: hashes.em ?? null,
    first_name_hash: hashes.fn ?? null,
    last_name_hash: hashes.ln ?? null,
  });
}

async function customerIdentity(
  stripe: Awaited<ReturnType<typeof getStripe>>,
  customerId: string,
): Promise<{ email: string | null; name: string | null }> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return { email: null, name: null };
    // The billing name, which Stripe collects with the card: the first
    // moment we hold one for a pay-first buyer.
    return { email: customer.email ?? null, name: customer.name ?? null };
  } catch {
    return { email: null, name: null };
  }
}

async function customerFromCheckoutSession(
  sessionId: string,
): Promise<Resolved | Refused> {
  const stripe = await stripeOrNull();
  if (!stripe) return { error: 'stripe_unavailable', status: 503 };

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { error: 'invalid_session', status: 404 };
  }

  if (session.status !== 'complete') {
    return { error: 'session_incomplete', status: 409 };
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : (session.customer?.id ?? null);
  if (!customerId) return { error: 'no_customer', status: 409 };

  return { customerId, createdMs: (session.created ?? 0) * 1000 };
}

/**
 * The in-page wallet path. An Apple Pay or Google Pay purchase never creates a
 * Checkout Session, so the SetupIntent it confirmed is the only id the browser
 * holds. The EXPRESS_MARKER check keeps SetupIntents from any other flow on
 * this Stripe account out.
 */
async function customerFromSetupIntent(
  setupIntentId: string,
): Promise<Resolved | Refused> {
  const stripe = await stripeOrNull();
  if (!stripe) return { error: 'stripe_unavailable', status: 503 };

  let intent;
  try {
    intent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch {
    return { error: 'invalid_session', status: 404 };
  }

  if (intent.metadata?.[EXPRESS_MARKER] !== '1') {
    return { error: 'invalid_session', status: 400 };
  }
  if (intent.status !== 'succeeded') {
    return { error: 'session_incomplete', status: 409 };
  }

  const customerId =
    typeof intent.customer === 'string'
      ? intent.customer
      : (intent.customer?.id ?? null);
  if (!customerId) return { error: 'no_customer', status: 409 };

  return { customerId, createdMs: (intent.created ?? 0) * 1000 };
}

/**
 * The browser saying it fired its own copy of StartTrial.
 *
 * WHY THIS EXISTS. The pixel has a Conversions API Gateway behind it, so one
 * browser event already reaches Meta twice — once from fbevents.js and once
 * relayed as a server event. A third copy from our own uploader is what
 * Ads Manager flagged as "Event not deduplicated" on 2026-09-03, and the fix
 * at the time was to stop uploading trial_start at all. That traded one
 * problem for a worse one: a trial whose browser copy never fired, because an
 * ad blocker ate the script or the buyer shut the tab on Stripe's receipt,
 * reached Meta zero times. Now the uploader is the backstop for exactly those,
 * and this route is how it knows which ones they are.
 *
 * Trusted the same amount as the GET above, which is to say the session id has
 * to resolve to a real, recent, trialing subscription on our own Stripe
 * account. The worst a forger can do with a valid id is suppress the server
 * copy of a conversion Meta was told about by the browser anyway.
 *
 * RACING THE WEBHOOK. The row this stamps is written by the Stripe webhook,
 * which fires on the same payment this page is celebrating. The page needs two
 * Stripe round trips before it can fire a pixel, so the webhook normally wins
 * — but "normally" is not "always", and a miss puts the third copy back. So
 * the write is retried for a few seconds rather than asked once. It is
 * retried HERE and not by the caller: the success page bounces to /explore
 * about two seconds in, and a retry scheduled in that browser would never
 * run. The request itself survives the navigation because the caller sends it
 * with `keepalive`. The 20-minute grace window in conversion-upload.ts is the
 * backstop for the backstop.
 */
export async function POST(request: NextRequest) {
  const noStore = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  let sessionId = '';
  try {
    const body = (await request.json()) as { session_id?: unknown };
    sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  } catch {
    return noStore({ error: 'invalid_body' }, 400);
  }

  const express = isExpressSetupIntentId(sessionId);
  if (!sessionId || (!express && !sessionId.startsWith('cs_'))) {
    return noStore({ error: 'invalid_session' }, 400);
  }

  const resolved = express
    ? await customerFromSetupIntent(sessionId)
    : await customerFromCheckoutSession(sessionId);
  if ('error' in resolved) return noStore({ error: resolved.error }, resolved.status);

  if (!resolved.createdMs || Date.now() - resolved.createdMs > WINDOW_MS) {
    return noStore({ error: 'session_expired' }, 410);
  }

  const stripe = await stripeOrNull();
  if (!stripe) return noStore({ error: 'stripe_unavailable' }, 503);

  let subscriptions;
  try {
    subscriptions = await stripe.subscriptions.list({
      customer: resolved.customerId,
      status: 'trialing',
      limit: 1,
    });
  } catch {
    return noStore({ error: 'stripe_unavailable' }, 502);
  }

  const subscription = subscriptions.data[0];
  if (!subscription) return noStore({ recorded: false, reason: 'no_trial' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return noStore({ recorded: false, reason: 'unconfigured' });

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(WRITE_RETRY_MS);

    // Only while the row is still pending. A conversion already sent, skipped
    // or failed has had its decision made, and stamping it now would rewrite
    // history for no benefit.
    const { data, error } = await admin
      .from('marketing_conversions')
      .update({ browser_reported_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscription.id)
      .eq('event_type', 'trial_start')
      .eq('upload_status', 'pending')
      .is('browser_reported_at', null)
      .select('id');

    if (error) {
      // Reporting, never the page. The grace window covers this.
      console.warn('[conversion-event] browser report failed', error);
      return noStore({ recorded: false, reason: 'write_failed' });
    }
    if ((data?.length ?? 0) > 0) return noStore({ recorded: true });
  }

  return noStore({ recorded: false, reason: 'no_row' });
}
