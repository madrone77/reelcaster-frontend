import { NextRequest, NextResponse } from 'next/server';
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
