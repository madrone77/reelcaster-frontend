import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import {
  ANNUAL_PER_MONTH_CENTS,
  ANNUAL_PRICE_CENTS,
  ANNUAL_PRICE_ID,
  TRIAL_DAYS,
  currencyForRegion,
  type BillingCurrency,
} from '@/lib/pricing';
import {
  checkTrialEligibility,
  checkTrialEligibilityByEmail,
} from '@/lib/trial';
import { EXPRESS_MARKER } from '@/lib/express-checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Apple Pay / Google Pay, bought without leaving the page.
 *
 * The hosted Stripe Checkout route next door (`/api/stripe/checkout`) still
 * exists and is still the fallback for cards; this one backs the Express
 * Checkout Element in the upgrade modal, where the whole point is that a tap
 * on the Apple Pay button is the entire purchase.
 *
 * Two POSTs, because a wallet can't be charged and a subscription can't be
 * created in the same breath:
 *
 *   1. `step: 'setup'`    → resolve the customer, return a SetupIntent secret.
 *                           The browser confirms it against the wallet sheet.
 *   2. `step: 'subscribe'`→ the SetupIntent has succeeded and carries a saved
 *                           payment method; create the subscription on it.
 *
 * Splitting it this way is deliberate: creating the subscription FIRST and
 * confirming after would leave a trialing subscription (and, for pay-first
 * buyers, a provisioned account) behind every time someone opened the Apple Pay
 * sheet and thought better of it — and it would burn their one free trial to do
 * it. Nothing is created until the wallet has actually authorised.
 *
 * Everything step 2 needs is read back off the SetupIntent's own metadata
 * rather than re-posted by the browser, so a tampered second request can't
 * change who is being billed or whether a trial applies.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** See src/app/api/stripe/checkout/route.ts — the same switch gates both. */
const PAY_FIRST_ENABLED = process.env.NEXT_PUBLIC_PAY_FIRST_CHECKOUT === '1';

/** Deliberately loose — Stripe re-validates, and we only need to reject junk. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ExpressBody {
  step?: 'setup' | 'subscribe';
  /** Signed-out buyers: the address the wallet sheet returned. */
  email?: string;
  region?: string;
  from?: string;
  /** step 'subscribe' only. */
  setup_intent?: string;
}

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function noStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      // Resolved partly from the request's IP country, so this must never sit
      // in a shared CDN cache — Vercel keys on the URL, not on the headers.
      'Cache-Control': 'private, no-store',
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * What the browser needs to draw the buttons before anyone clicks: the
 * currency (which decides the wallet sheet's amounts and which methods show)
 * and whether express checkout is sellable at all.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const currency = currencyForRegion(
    url.searchParams.get('region'),
    request.headers.get('x-vercel-ip-country'),
  );

  return noStore({
    // No annual Price configured means no plan to sell, and the element would
    // only fail at the moment of the tap. Better to never draw it.
    available: Boolean(ANNUAL_PRICE_ID),
    /** Signed-out express checkout rides on the same flag as pay-first. */
    anon_available: PAY_FIRST_ENABLED,
    currency,
    trial_days: TRIAL_DAYS,
    price_cents: ANNUAL_PRICE_CENTS,
    per_month_cents: ANNUAL_PER_MONTH_CENTS,
  });
}

export async function POST(request: NextRequest) {
  if (!ANNUAL_PRICE_ID) {
    console.error('[stripe express] STRIPE_ANNUAL_PRICE_ID is not configured');
    return noStore({ error: 'plan_unavailable' }, { status: 503 });
  }

  let body: ExpressBody;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: 'invalid_body' }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  return body.step === 'subscribe'
    ? subscribeStep(body)
    : setupStep(request, body, user?.id ?? null, user?.email ?? null);
}

/* ── Step 1: SetupIntent ─────────────────────────────────────────────── */

async function setupStep(
  request: NextRequest,
  body: ExpressBody,
  userId: string | null,
  userEmail: string | null,
) {
  const stripe = await getStripe();
  const region = (body.region ?? '').toString().trim();

  // Same refusal as the hosted checkout: we don't take money for water we
  // can't forecast.
  if (region.toLowerCase() === 'other') {
    return noStore({ redirect: '/explore?waitlist=1' });
  }

  let currency: BillingCurrency = currencyForRegion(
    region,
    request.headers.get('x-vercel-ip-country'),
  );

  let customerId: string;
  let email: string;
  let trialEligible: boolean;

  if (userId) {
    email = (userEmail ?? '').toLowerCase();

    const { data: settings } = await admin
      .from('user_settings')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    let existing = settings?.stripe_customer_id ?? null;
    let hadSubscription = Boolean(settings?.stripe_subscription_id);

    if (existing) {
      // Dev (test mode) and production (live mode) share this row, so the
      // stored customer can belong to the other Stripe mode. Treat a miss as
      // "no customer yet" rather than failing the purchase.
      try {
        const customer = await stripe.customers.retrieve(existing);
        if (customer.deleted) {
          existing = null;
        } else if (customer.currency && customer.currency !== currency) {
          // Stripe locks a customer to their first billing currency forever.
          // Both live on the same price, so preferring the locked one always
          // succeeds.
          currency = customer.currency as BillingCurrency;
        }
      } catch {
        existing = null;
      }
    }

    if (existing) {
      customerId = existing;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail ?? undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      hadSubscription = false;
      await admin.from('user_settings').upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          primary_region_slug: region || null,
        },
        { onConflict: 'user_id' },
      );
    }

    // Same four gates as the hosted route: the abuse guards in src/lib/trial.ts
    // plus Stripe's own subscription history, which catches a customer who
    // subscribed without ever taking a trial, cancelled, and came back.
    const eligibility = await checkTrialEligibility(admin, userId, userEmail);
    if (!hadSubscription) {
      try {
        const prior = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 1,
        });
        hadSubscription = prior.data.length > 0;
      } catch {
        console.warn('[stripe express] history check failed; allowing trial');
      }
    }
    trialEligible = eligibility.eligible && !hadSubscription;
  } else {
    if (!PAY_FIRST_ENABLED) {
      return noStore({ error: 'unauthorized' }, { status: 401 });
    }

    email = (body.email ?? '').toString().trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      // The wallet sheet is configured with emailRequired, so this is a
      // misconfiguration or a hand-rolled request, not a customer mistake.
      return noStore({ error: 'email_required' }, { status: 400 });
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { anon_checkout: 'true' },
    });
    customerId = customer.id;

    const eligibility = await checkTrialEligibilityByEmail(admin, email);
    trialEligible = eligibility.eligible;
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      // The card is kept to bill the first invoice when the trial ends, with
      // nobody at the keyboard.
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      metadata: {
        [EXPRESS_MARKER]: '1',
        ...(userId ? { supabase_user_id: userId } : { anon_checkout: 'true' }),
        checkout_email: email,
        currency,
        region: region || '',
        from: body.from ?? '',
        // Resolved here, read back in step 2. The browser never gets a say in
        // whether it qualifies for a free week.
        trial: String(trialEligible),
      },
    });

    return noStore({
      client_secret: setupIntent.client_secret,
      currency,
      trial_days: trialEligible ? TRIAL_DAYS : 0,
    });
  } catch (err) {
    console.error('[stripe express] setup intent failed', err);
    return noStore({ error: 'setup_failed' }, { status: 502 });
  }
}

/* ── Step 2: the subscription ────────────────────────────────────────── */

async function subscribeStep(body: ExpressBody) {
  const setupIntentId = (body.setup_intent ?? '').toString().trim();
  if (!setupIntentId.startsWith('seti_')) {
    return noStore({ error: 'invalid_setup_intent' }, { status: 400 });
  }

  const stripe = await getStripe();

  let setupIntent: Stripe.SetupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch {
    return noStore({ error: 'invalid_setup_intent' }, { status: 400 });
  }

  // Only intents this route created, and only ones the wallet has actually
  // authorised. Anything else is a replay or a hand-rolled id.
  if (setupIntent.metadata?.[EXPRESS_MARKER] !== '1') {
    return noStore({ error: 'invalid_setup_intent' }, { status: 400 });
  }
  if (setupIntent.status !== 'succeeded') {
    return noStore(
      { error: 'setup_incomplete', status: setupIntent.status },
      { status: 400 },
    );
  }

  const customerId =
    typeof setupIntent.customer === 'string'
      ? setupIntent.customer
      : (setupIntent.customer?.id ?? null);
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : (setupIntent.payment_method?.id ?? null);

  if (!customerId || !paymentMethodId) {
    console.error('[stripe express] setup intent missing customer or method', setupIntentId);
    return noStore({ error: 'setup_incomplete' }, { status: 400 });
  }

  const meta = setupIntent.metadata ?? {};
  const currency = (meta.currency === 'usd' ? 'usd' : 'cad') as BillingCurrency;
  const trialEligible = meta.trial === 'true';

  try {
    // Also the card the renewal is billed against, so it has to become the
    // customer's default rather than just sitting on the subscription.
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: ANNUAL_PRICE_ID, quantity: 1 }],
        currency,
        default_payment_method: paymentMethodId,
        // Without a trial the first invoice is charged now and may need a 3DS
        // step; this hands us the secret to finish it instead of leaving the
        // subscription stuck at `incomplete`.
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
        metadata: {
          ...(meta.supabase_user_id
            ? { supabase_user_id: meta.supabase_user_id }
            : { anon_checkout: 'true' }),
          checkout_email: meta.checkout_email ?? '',
          plan: 'annual',
          currency,
          from: meta.from ?? '',
          express: 'true',
          trial: String(trialEligible),
        },
        ...(trialEligible
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                // No card at trial end = cancel, never a subscription left
                // hanging in an unpayable state.
                end_behavior: { missing_payment_method: 'cancel' as const },
              },
            }
          : {}),
      },
      // A retried second step (flaky network, double tap) must not sell the
      // same person two subscriptions.
      { idempotencyKey: `express_sub_${setupIntentId}` },
    );

    const invoice = subscription.latest_invoice;
    const clientSecret =
      invoice && typeof invoice !== 'string'
        ? (invoice.confirmation_secret?.client_secret ?? null)
        : null;

    // `incomplete` means the first charge needs the customer back — 3DS on a
    // repeat buyer who isn't trial-eligible. Everyone on a trial lands
    // `trialing` and is done here.
    if (subscription.status === 'incomplete' && clientSecret) {
      return noStore({
        status: subscription.status,
        requires_action: true,
        client_secret: clientSecret,
        subscription_id: subscription.id,
      });
    }

    return noStore({
      status: subscription.status,
      requires_action: false,
      subscription_id: subscription.id,
      trial_days: trialEligible ? TRIAL_DAYS : 0,
    });
  } catch (err) {
    console.error('[stripe express] subscription create failed', err);
    return noStore({ error: 'subscribe_failed' }, { status: 502 });
  }
}
