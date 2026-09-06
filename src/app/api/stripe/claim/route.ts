import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import { sendEmail } from '@/lib/email-service';
import { checkoutSignInEmail } from '@/lib/email-templates/billing';
import {
  EXPRESS_MARKER,
  isExpressSetupIntentId,
} from '@/lib/express-checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** How long after checkout the URL handoff stays usable. */
const CLAIM_WINDOW_MS = 30 * 60 * 1000;

/**
 * Finish a pay-first purchase: turn a completed Checkout Session into a signed-in
 * session, without the buyer ever filling in a form.
 *
 * Unauthenticated by necessity — the whole point is that the caller has no
 * account yet. The Checkout Session id is the credential, so it is checked
 * hard:
 *
 *   - the session must exist in Stripe and be `complete` (an id alone proves
 *     nothing; an abandoned checkout must not mint a login);
 *   - it must be recent (CLAIM_WINDOW_MS), so an id sitting in browser history
 *     or a shared URL goes stale;
 *   - it must be unclaimed, enforced by a primary-key insert, so the handoff
 *     works exactly once;
 *   - and the account must have been CREATED by this purchase.
 *
 * That last one is the important one. If the email already had an account,
 * completing a checkout for it is not proof of owning the inbox — otherwise
 * anyone could buy Pro on someone else's address and be handed their session.
 * Those get an emailed sign-in link, which only the inbox owner can use.
 *
 * Storage: `user_settings.created_via_checkout` answers "did this purchase
 * create the account", and a row in `checkout_claims` means "already
 * redeemed". Both predate this route in the database; see the migration.
 *
 * Two kinds of credential are accepted, because there are two ways to buy. A
 * hosted checkout hands back a Checkout Session (`cs_`); an in-page wallet
 * purchase never creates one, so the SetupIntent the wallet confirmed (`seti_`)
 * stands in its place. The checks are the same shape either way — exists, is
 * ours, actually completed, recent, unclaimed — and `checkout_claims.session_id`
 * is a text primary key, so both ids share one ledger with no migration.
 */
export async function POST(request: NextRequest) {
  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = (body?.session_id ?? '').toString().trim();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const resolved = await resolveCredential(sessionId);
  if ('response' in resolved) return resolved.response;
  const { proof, link } = resolved;
  const { customerId } = proof;

  // The webhook hasn't provisioned the account yet. Not an error — the caller
  // polls this endpoint until it has. The email is the one Stripe holds for
  // the customer right now, not the one on the session, so a correction made
  // while waiting (PATCH below) shows up on the next poll.
  if (!link) {
    return NextResponse.json(
      { status: 'pending', email: await customerEmail(customerId, proof.email) },
      { status: 202 },
    );
  }

  // The account's own address for the account this purchase created: that is
  // where the sign-in has to go, and it may differ from the session's if the
  // buyer corrected it. The pre-existing-account path below keeps the
  // session's email, since there the inbox is the proof.
  const email = link.created_via_checkout
    ? ((await emailForUser(link.user_id)) ?? proof.email)
    : proof.email;

  // The account predates this purchase, so paying for it proves nothing about
  // owning the inbox. Only the inbox can complete this one.
  if (!link.created_via_checkout) {
    await emailSignInLink(request, email);
    return NextResponse.json({ status: 'emailed' });
  }

  // The claim is the insert: session_id is the primary key, so a second
  // attempt (a reload, a shared URL, two racing tabs) conflicts and falls
  // through to the emailed link.
  const { error: claimError } = await admin
    .from('checkout_claims')
    .insert({ session_id: sessionId, user_id: link.user_id });

  if (claimError) {
    await emailSignInLink(request, email);
    return NextResponse.json({ status: 'emailed' });
  }

  if (!email) {
    return NextResponse.json({ status: 'emailed' });
  }

  const actionLink = await generateSignInLink(request, email);
  if (!actionLink) {
    return NextResponse.json({ status: 'emailed' });
  }

  return NextResponse.json({ status: 'signed_in', url: actionLink, email });
}

/**
 * Correct the email a purchase is being provisioned under.
 *
 * The phone sheet sends buyers to Stripe without asking for an address, so
 * the first time they see the one that will own their account is the success
 * page, and a typo there is a paid account nobody can sign in to. Same
 * credential and checks as the claim (a completed, recent purchase), and the
 * same trust: the purchase already earns a signed-in session, so it can earn
 * the address that session is for.
 *
 * What moves: the Stripe customer's email (which the webhook reads when it
 * provisions, and which the customer's invoices go to), the subscription's
 * `checkout_email` when one is set (the webhook reads that first), and, if the
 * webhook already ran, the auth user's email. An account that predates the
 * purchase is never renamed: paying for an address is not owning it.
 */
export async function PATCH(request: NextRequest) {
  let sessionId: string;
  let email: string;
  try {
    const body = await request.json();
    sessionId = (body?.session_id ?? '').toString().trim();
    email = (body?.email ?? '').toString().trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 400 });
  }

  const resolved = await resolveCredential(sessionId);
  if ('response' in resolved) return resolved.response;
  const { proof, link } = resolved;

  if (link && !link.created_via_checkout) {
    return NextResponse.json({ error: 'account_exists' }, { status: 409 });
  }

  const stripe = await getStripe();
  try {
    await stripe.customers.update(proof.customerId, { email });
    if (proof.subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(proof.subscriptionId);
      if (sub.metadata?.checkout_email) {
        await stripe.subscriptions.update(proof.subscriptionId, {
          metadata: { checkout_email: email },
        });
      }
    }
  } catch (err) {
    console.error('[stripe claim] could not update customer email', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 502 });
  }

  if (link) {
    const { error } = await admin.auth.admin.updateUserById(link.user_id, {
      email,
      email_confirm: true,
    });
    if (error) {
      console.error('[stripe claim] could not update account email', error);
      // Almost always: the new address already has an account.
      return NextResponse.json({ error: 'email_taken' }, { status: 409 });
    }
  }

  return NextResponse.json({ status: 'updated', email });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The purchase credential, checked, and the account it maps to if the webhook
 * has made one yet. Shared by the claim and the correction so the two cannot
 * disagree about what counts as proof.
 */
async function resolveCredential(sessionId: string): Promise<
  | {
      proof: Extract<Proof, { customerId: string }>;
      link: { user_id: string; created_via_checkout: boolean | null } | null;
    }
  | { response: NextResponse }
> {
  const express = isExpressSetupIntentId(sessionId);
  if (!express && !sessionId.startsWith('cs_')) {
    return {
      response: NextResponse.json({ error: 'invalid_session' }, { status: 400 }),
    };
  }

  const proof = express
    ? await proofFromSetupIntent(sessionId)
    : await proofFromCheckoutSession(sessionId);

  if ('error' in proof) {
    return {
      response: NextResponse.json({ error: proof.error }, { status: proof.status }),
    };
  }

  if (!proof.createdMs || Date.now() - proof.createdMs > CLAIM_WINDOW_MS) {
    return {
      response: NextResponse.json({ error: 'session_expired' }, { status: 410 }),
    };
  }

  const { data: link } = await admin
    .from('user_settings')
    .select('user_id, created_via_checkout')
    .eq('stripe_customer_id', proof.customerId)
    .maybeSingle();

  return { proof, link: link ?? null };
}

/** The email Stripe holds for a customer right now, else the fallback. */
async function customerEmail(
  customerId: string,
  fallback: string | null,
): Promise<string | null> {
  try {
    const stripe = await getStripe();
    const customer = await stripe.customers.retrieve(customerId);
    return customer.deleted ? fallback : (customer.email ?? fallback);
  } catch {
    return fallback;
  }
}

/** The address on an auth user, by id. */
async function emailForUser(userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/** What a valid purchase credential resolves to, whichever kind it is. */
type Proof =
  | {
      customerId: string;
      createdMs: number;
      email: string | null;
      /** The subscription the purchase made, when the credential names one. */
      subscriptionId: string | null;
    }
  | { error: string; status: number };

async function proofFromCheckoutSession(sessionId: string): Promise<Proof> {
  const stripe = await getStripe();

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

  return {
    customerId,
    createdMs: (session.created ?? 0) * 1000,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    subscriptionId:
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription?.id ?? null),
  };
}

/**
 * The in-page wallet equivalent. A succeeded SetupIntent means the customer
 * authorised Apple Pay / Google Pay on their own device, which is the same
 * strength of claim a completed hosted checkout makes.
 *
 * It is NOT on its own proof that a subscription exists — but it doesn't have
 * to be: the caller only gets past this point once the webhook has provisioned
 * an account from the subscription, and no subscription means no
 * `user_settings` row to find.
 */
async function proofFromSetupIntent(setupIntentId: string): Promise<Proof> {
  const stripe = await getStripe();

  let intent;
  try {
    intent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch {
    return { error: 'invalid_session', status: 404 };
  }

  // Someone else's SetupIntent — from any other flow on this Stripe account —
  // must not mint a login.
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

  return {
    customerId,
    createdMs: (intent.created ?? 0) * 1000,
    email: intent.metadata?.checkout_email ?? null,
    subscriptionId: null,
  };
}

async function generateSignInLink(
  request: NextRequest,
  email: string,
): Promise<string | null> {
  const origin = appOrigin(request);
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/explore` },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[stripe claim] could not generate sign-in link', error);
    return null;
  }
  return data.properties.action_link;
}

async function emailSignInLink(request: NextRequest, email: string | null) {
  if (!email) return;
  const actionLink = await generateSignInLink(request, email);
  if (!actionLink) return;

  const { subject, html } = checkoutSignInEmail(actionLink);
  await sendEmail({ to: email, subject, html });
}
