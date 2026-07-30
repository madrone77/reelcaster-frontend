import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import {
  ANNUAL_PRICE_ID,
  currencyForRegion,
  priceIdFor,
  type BillingCurrency,
  type PricingPlan,
} from '@/lib/pricing';
import { TRIAL_DAYS, checkTrialEligibility } from '@/lib/trial';
import { resolveEntitlement } from '@/lib/entitlement';
import { isPlausibleEmail, findUserIdByEmail } from '@/lib/checkout-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  plan?: PricingPlan;
  region?: string; // 'BC' | 'WA' | 'OR' | 'Other' | other slug
  from?: string;   // analytics: 'spot' | 'pricing' | etc.
  /** Anonymous checkout: the address the account will be created under. */
  email?: string;
}

export async function POST(request: NextRequest) {
  const stripe = await getStripe();

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Two ways in. Signed in: we know who you are. Signed out: you give us an
  // email and the account is created by the webhook once Stripe confirms —
  // paying shouldn't require an account you don't have yet.
  const user = await getUserFromRequest(request);
  const anonEmail = (body.email ?? '').toString().trim().toLowerCase();

  if (!user) {
    if (!anonEmail) {
      return NextResponse.json({ error: 'email_required' }, { status: 400 });
    }
    if (!isPlausibleEmail(anonEmail)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    // If that address already has an account, send them to sign in instead of
    // creating a second one. Letting an anonymous payer attach a subscription
    // to somebody else's account is not a flow worth having: the payer can't
    // manage what they bought, and the account holder gets a subscription they
    // never agreed to.
    try {
      const existing = await findUserIdByEmail(admin, anonEmail);
      if (existing) {
        return NextResponse.json(
          { error: 'account_exists', requires_signin: true },
          { status: 409 },
        );
      }
    } catch (err) {
      console.error('[stripe checkout] could not check for an existing account', err);
      return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
    }
  }

  const buyerEmail = user?.email ?? anonEmail;

  const plan: PricingPlan = body.plan === 'annual' ? 'annual' : 'monthly';
  const region = (body.region ?? '').toString().trim();

  // "Other" region = uncovered. Bounce to waitlist instead of taking money for
  // something we can't deliver yet.
  if (region.toLowerCase() === 'other') {
    return NextResponse.json(
      { redirect: '/explore?waitlist=1' },
      { status: 200 },
    );
  }

  const priceId = priceIdFor(plan);
  if (!priceId) {
    // The plan's STRIPE_*_PRICE_ID env var is unset (see src/lib/pricing.ts).
    // Fail with JSON rather than crashing on an empty line_items price, which
    // surfaces as an unparseable 500 client-side. The annual plan carries the
    // trial, so this gap takes the trial down with it.
    console.error(`[stripe checkout] no price ID configured for plan "${plan}"`);
    return NextResponse.json({ error: 'plan_unavailable', plan }, { status: 503 });
  }

  // BC bills in CAD, WA/OR in USD; paywall CTAs send no region, so fall back
  // to the request's IP country. Both currencies live on the same price.
  let currency: BillingCurrency = currencyForRegion(
    region,
    request.headers.get('x-vercel-ip-country'),
  );

  // Look up an existing stripe_customer_id, or create the customer + row.
  // An anonymous buyer has no row yet — their customer is created fresh and
  // linked by the webhook once Stripe confirms.
  try {
    const { data: existingSettings } = user
      ? await admin
          .from('user_settings')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null };

    let stripeCustomerId = existingSettings?.stripe_customer_id ?? null;

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

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: buyerEmail || undefined,
        // supabase_user_id is absent for an anonymous buyer. pending_email is
        // what the webhook resolves the account from instead — see
        // resolveUserId() in the webhook.
        metadata: user
          ? { supabase_user_id: user.id }
          : { pending_email: buyerEmail },
      });
      stripeCustomerId = customer.id;

      if (user) {
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
      }
    } else if (region && user) {
      await admin
        .from('user_settings')
        .update({ primary_region_slug: region })
        .eq('user_id', user.id);
    }

    // The 7-day trial rides on the annual plan only. Monthly is instant-charge,
    // which keeps "start your trial" and "buy the yearly plan" one decision.
    // Ineligible customers aren't told why — they just go through paid checkout.
    // Runs for anonymous buyers too — that's the whole reason the email is
    // collected on our page instead of Stripe's. userId is null for them, so
    // the has_used_trial layer no-ops and the email-hash layer carries it.
    const eligibility =
      plan === 'annual'
        ? await checkTrialEligibility(admin, user?.id ?? null, buyerEmail)
        : { eligible: false as const, reason: undefined };

    if (plan === 'annual' && !eligibility.eligible) {
      console.info(
        '[stripe checkout] trial withheld',
        user?.id ?? `anon:${buyerEmail}`,
        eligibility.reason,
      );
    }

    const origin = appOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      currency,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Explicit even though it's the default for subscription mode: the whole
      // trial design assumes a card is on file when the trial ends.
      payment_method_collection: 'always',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        supabase_user_id: user?.id ?? '',
        pending_email: user ? '' : buyerEmail,
        plan,
        currency,
        region: region || '',
        from: body.from ?? '',
        trial: eligibility.eligible ? 'yes' : 'no',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user?.id ?? '',
          pending_email: user ? '' : buyerEmail,
          plan,
          currency,
        },
        ...(eligibility.eligible
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
      trial_days: eligibility.eligible ? TRIAL_DAYS : 0,
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

  // Anonymous callers get the public shape: whether the offer exists at all,
  // and nothing about anybody's account.
  //
  // We can't resolve trial ELIGIBILITY without knowing who they are, so this
  // reports the offer as available whenever the annual price is configured. A
  // returning customer who is no longer eligible therefore sees trial terms
  // here — and then sees the real amount on Stripe's own checkout page before
  // any card is charged, which is where it counts. Checking eligibility by
  // email at this point would be worse: it would turn the endpoint into an
  // oracle for whether a given address has an account.
  if (!user) {
    const annualAvailable = Boolean(ANNUAL_PRICE_ID);
    return NextResponse.json({
      tier: 'free',
      status: 'none',
      is_active: false,
      in_grace: false,
      period_end: null,
      trial_available: annualAvailable,
      trial_days: TRIAL_DAYS,
      annual_available: annualAvailable,
    });
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
