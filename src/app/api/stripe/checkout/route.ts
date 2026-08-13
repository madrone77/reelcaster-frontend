import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import {
  ANNUAL_PRICE_ID,
  currencyForRegion,
  TRIAL_DAYS,
  type BillingCurrency,
} from '@/lib/pricing';
import {
  checkTrialEligibility,
  checkTrialEligibilityByEmail,
} from '@/lib/trial';
import { resolveEntitlement } from '@/lib/entitlement';
import { readWall } from '@/lib/attribution';

/**
 * Which wall sent this buyer to checkout, read off the rc_wall cookie rather
 * than threaded down through <ProTrialModal> → <TrialCtaProvider> → <TrialBuy>
 * as a prop. The cookie is already on the request, and the redirect out to
 * Stripe's hosted page is precisely what a prop would not survive.
 *
 * Both keys go into `subscription_data.metadata`, not just the session's. The
 * webhook resolves everything from `subscription.metadata`, so anything left
 * only on the session is invisible to it — which is why the `from` that has
 * been set on sessions all along never reached the database.
 */
function attributionMetadata(request: NextRequest): Record<string, string> {
  const wall = readWall(request.headers.get('cookie') ?? '');
  if (!wall) return {};
  return {
    attr_feature: (wall.feature || '').slice(0, 200),
    attr_from: (wall.from || '').slice(0, 200),
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Pay-first checkout (buy Pro with no account, account provisioned from the
 * email Stripe bills). NEXT_PUBLIC_ so the paywall UI and this route read the
 * same switch — the modal shows its email field only when this is on.
 */
const PAY_FIRST_ENABLED = process.env.NEXT_PUBLIC_PAY_FIRST_CHECKOUT === '1';

/**
 * Checkout for someone who has no account yet.
 *
 * The paywall's whole point is that deciding to pay shouldn't require a signup
 * form first: Stripe takes the email and the card, and the webhook provisions
 * the account from `customer_details.email`. So this creates a session with NO
 * customer attached — the customer, and then the user row, come into existence
 * downstream.
 *
 * The email is still collected in our UI (one field, no password) because it's
 * the only way to check trial eligibility BEFORE Stripe applies a trial. Layer
 * 3 in the webhook catches whatever slips through.
 */
async function anonCheckout(request: NextRequest) {
  // Off until someone has watched one real transaction go through. Every
  // other path is unaffected; with this unset the paywall keeps sending
  // signed-out buyers to /plans/checkout exactly as it does today.
  if (!PAY_FIRST_ENABLED) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const email = (body.email ?? '').toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'email_required' }, { status: 400 });
  }

  const region = (body.region ?? '').toString().trim();

  if (region.toLowerCase() === 'other') {
    return NextResponse.json({ redirect: '/explore?waitlist=1' }, { status: 200 });
  }

  if (!ANNUAL_PRICE_ID) {
    console.error('[stripe checkout] STRIPE_ANNUAL_PRICE_ID is not configured');
    return NextResponse.json(
      { error: 'plan_unavailable', plan: 'annual' },
      { status: 503 },
    );
  }

  const stripe = await getStripe();
  const currency: BillingCurrency = currencyForRegion(
    region,
    request.headers.get('x-vercel-ip-country'),
  );

  const eligibility = await checkTrialEligibilityByEmail(admin, email);
  const trialEligible = eligibility.eligible;
  if (!trialEligible) {
    console.info('[stripe checkout] anon trial withheld', eligibility.reason);
  }

  try {
    const origin = appOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // No `customer`: Stripe creates one from the email it collects, and the
      // webhook binds it to the account it provisions.
      customer_email: email,
      currency,
      line_items: [{ price: ANNUAL_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: 'always',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        // No supabase_user_id yet — `anon_checkout` is the webhook's signal to
        // provision one rather than log an unresolvable subscription.
        anon_checkout: 'true',
        checkout_email: email,
        plan: 'annual',
        currency,
        region: region || '',
        from: body.from ?? '',
        trial: String(trialEligible),
      },
      subscription_data: {
        metadata: {
          anon_checkout: 'true',
          checkout_email: email,
          plan: 'annual',
          currency,
          trial: String(trialEligible),
          ...attributionMetadata(request),
        },
        ...(trialEligible
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                end_behavior: { missing_payment_method: 'cancel' as const },
              },
            }
          : {}),
      },
    });

    return NextResponse.json({
      url: session.url,
      id: session.id,
      trial_days: trialEligible ? TRIAL_DAYS : 0,
    });
  } catch (err) {
    console.error('[stripe checkout] anon session failed', err);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
}

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

interface CheckoutBody {
  region?: string; // 'BC' | 'WA' | 'OR' | 'Other' | other slug
  from?: string;   // analytics: 'spot' | 'pricing' | etc.
  /** Signed-out buyers only: the address Stripe bills and we provision from. */
  email?: string;
}

/** Deliberately loose — Stripe re-validates, and we only need to reject junk. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return anonCheckout(request);
  }

  const stripe = await getStripe();

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const region = (body.region ?? '').toString().trim();

  // "Other" region = uncovered. Bounce to waitlist instead of taking money for
  // something we can't deliver yet.
  if (region.toLowerCase() === 'other') {
    return NextResponse.json(
      { redirect: '/explore?waitlist=1' },
      { status: 200 },
    );
  }

  if (!ANNUAL_PRICE_ID) {
    // STRIPE_ANNUAL_PRICE_ID is unset (see src/lib/pricing.ts). Fail with JSON
    // rather than crashing on an empty line_items price, which surfaces as an
    // unparseable 500 client-side. There is only one plan, so this gap takes
    // the whole product — and the trial that rides on it — down with it.
    console.error('[stripe checkout] STRIPE_ANNUAL_PRICE_ID is not configured');
    return NextResponse.json(
      { error: 'plan_unavailable', plan: 'annual' },
      { status: 503 },
    );
  }

  // BC bills in CAD, WA/OR in USD; paywall CTAs send no region, so fall back
  // to the request's IP country. Both currencies live on the same price.
  let currency: BillingCurrency = currencyForRegion(
    region,
    request.headers.get('x-vercel-ip-country'),
  );

  // Look up an existing stripe_customer_id, or create the customer + row.
  try {
    const { data: existingSettings } = await admin
      .from('user_settings')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let stripeCustomerId = existingSettings?.stripe_customer_id ?? null;

    // The free trial is for first-time subscribers only. The DB flag catches
    // history from either Stripe mode (dev/test and prod/live share this row);
    // the per-customer check below catches anything the row missed.
    let hadSubscription = Boolean(existingSettings?.stripe_subscription_id);

    if (stripeCustomerId) {
      // The dev site (test mode) and production (live mode) share this
      // database row, so the stored customer can belong to the other Stripe
      // mode — retrieving it here then fails. Treat that as "no customer yet"
      // instead of failing the checkout.
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (customer.deleted) {
          stripeCustomerId = null;
        } else if (customer.currency && customer.currency !== currency) {
          // Stripe locks a customer to their first billing currency forever; a
          // session in any other currency is refused. Prefer the locked
          // currency — both cad and usd exist on the price, so the session
          // always succeeds.
          console.warn(
            `[stripe checkout] customer ${stripeCustomerId} locked to ${customer.currency}, overriding ${currency}`,
          );
          currency = customer.currency as BillingCurrency;
        }
      } catch {
        console.warn(
          `[stripe checkout] stored customer ${stripeCustomerId} not found in this Stripe mode; creating a new one`,
        );
        stripeCustomerId = null;
      }
    }

    let createdCustomer = false;
    if (!stripeCustomerId) {
      createdCustomer = true;
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await admin
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            primary_region_slug: region || null,
          },
          { onConflict: 'user_id' },
        );
    } else if (region) {
      await admin
        .from('user_settings')
        .update({ primary_region_slug: region })
        .eq('user_id', user.id);
    }

    // Four independent gates, all of which must pass. The first three are the
    // abuse guards in src/lib/trial.ts (per-account flag, normalized-email
    // hash, and — later, in the webhook — the card fingerprint). The fourth is
    // Stripe's own subscription history, which catches something the others
    // don't: a customer who subscribed WITHOUT ever taking a trial, cancelled,
    // and came back. Ineligible customers are never told why; they simply go
    // through normal paid checkout.
    const eligibility = await checkTrialEligibility(admin, user.id, user.email);

    // A just-created customer can't have prior subscriptions; anyone else gets
    // one cheap history check. On a transient Stripe failure here, err toward
    // granting the trial rather than failing the whole checkout.
    if (!hadSubscription && !createdCustomer) {
      try {
        const prior = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'all',
          limit: 1,
        });
        hadSubscription = prior.data.length > 0;
      } catch {
        console.warn(
          `[stripe checkout] subscription-history check failed for ${stripeCustomerId}; allowing trial`,
        );
      }
    }

    const trialEligible = eligibility.eligible && !hadSubscription;

    if (!trialEligible) {
      console.info(
        '[stripe checkout] trial withheld',
        user.id,
        eligibility.reason ?? (hadSubscription ? 'prior_subscription' : 'unknown'),
      );
    }

    const origin = appOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      currency,
      line_items: [{ price: ANNUAL_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      // Explicit even though it's the default for subscription mode: the whole
      // trial design assumes a card is on file when the trial ends.
      payment_method_collection: 'always',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan: 'annual',
        currency,
        region: region || '',
        from: body.from ?? '',
        trial: String(trialEligible),
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: 'annual',
          currency,
          trial: String(trialEligible),
          ...attributionMetadata(request),
        },
        ...(trialEligible
          ? {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                // No card at trial end = cancel, never leave a subscription
                // hanging in an unpayable state.
                end_behavior: { missing_payment_method: 'cancel' as const },
              },
            }
          : {}),
      },
    });

    return NextResponse.json({
      url: session.url,
      id: session.id,
      trial_days: trialEligible ? TRIAL_DAYS : 0,
    });
  } catch (err) {
    // A Stripe/database failure here otherwise escapes as a bodyless 500 the
    // client can't JSON-parse. Log the real cause, return a stable shape.
    console.error('[stripe checkout] failed to create session', err);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
}

/**
 * Poll-friendly status check used by /billing/success. Returns the user's
 * current `subscription_tier`/`subscription_status` from `user_settings` so the
 * UI can wait for the webhook to flip the row before redirecting.
 *
 * The `session_id` query param is accepted for symmetry but isn't required —
 * we trust the webhook (the source of truth) to update `user_settings`. We
 * only need to confirm the change has propagated.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  const entitlement = await resolveEntitlement(admin, user.id);

  // /plans/checkout needs this BEFORE the customer clicks: a page that
  // promises "7 days free" and then charges immediately is the exact thing
  // the FTC negative-option rule is about. Repeat customers see plain paid
  // terms instead — never an explanation of why.
  const trialEligibility = await checkTrialEligibility(admin, user.id, user.email);
  const annualAvailable = Boolean(ANNUAL_PRICE_ID);

  return NextResponse.json({
    session_id: sessionId,
    tier: entitlement.tier,
    status: entitlement.status,
    is_active: entitlement.isPro,
    in_grace: entitlement.inGrace,
    period_end: entitlement.periodEnd,
    trial_available: annualAvailable && trialEligibility.eligible,
    trial_days: TRIAL_DAYS,
    annual_available: annualAvailable,
  });
}
