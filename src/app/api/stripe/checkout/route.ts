import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import {
  ANNUAL_PRICE_ID,
  MONTHLY_PRICE_ID,
  billingPlanFrom,
  currencyForRegion,
  TRIAL_DAYS,
  type BillingCurrency,
  type BillingPlan,
} from '@/lib/pricing';
import { splitMetadata } from '@/lib/split-tests';
import { checkTrialEligibility } from '@/lib/trial';
import {
  PAY_FIRST_ENABLED,
  createAnonCheckoutSession,
  resolveCheckoutPrice,
  withSplitCookie,
} from '@/lib/anon-checkout';
import { resolveEntitlement } from '@/lib/entitlement';
import { readWall } from '@/lib/attribution';
import { metaIdentityForUser } from '@/lib/meta-identity';
import { paywallEventRow } from '@/lib/paywall-event';
import { acquisitionMetadata } from '@/lib/acquisition-metadata';

/**
 * Which wall sent this buyer to checkout, and which ad (if any) bought them.
 *
 * Moved to src/lib/acquisition-metadata.ts on 2026-09-10 so the wallet path
 * can stamp the same thing. `attributionMetadata(request)` is now
 * `acquisitionMetadata(request.headers)`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * The price resolution, the split cookie and the signed-out session itself
 * live in src/lib/anon-checkout.ts, shared with the "almost done" reminder's
 * resume link.
 */

/**
 * Checkout for someone who has no account yet.
 *
 * The paywall's whole point is that deciding to pay shouldn't require a signup
 * form first: Stripe takes the email and the card, and the webhook provisions
 * the account from `customer_details.email`. So this creates a session with NO
 * customer attached — the customer, and then the user row, come into existence
 * downstream.
 *
 * The email is optional. When the UI collects it (one field, no password) it
 * is the only way to check trial eligibility BEFORE Stripe applies a trial.
 * The phone sheet stopped collecting it (2026-09-06: the button goes straight
 * to Stripe, which takes the email and the card on one screen), and for that
 * caller the pre-check is skipped, the trial is offered, and the webhook's
 * guards catch a repeat. A bad email is still refused; an absent one is not.
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
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 400 });
  }

  const region = (body.region ?? '').toString().trim();
  const plan = billingPlanFrom(body.plan);

  if (region.toLowerCase() === 'other') {
    return NextResponse.json({ redirect: '/explore?waitlist=1' }, { status: 200 });
  }

  const stripe = await getStripe();
  const currency: BillingCurrency = currencyForRegion(
    region,
    request.headers.get('x-vercel-ip-country'),
  );

  try {
    const created = await createAnonCheckoutSession({
      request,
      stripe,
      admin,
      currency,
      email: email || null,
      region,
      from: body.from ?? '',
      plan,
    });
    if (!created.ok) {
      return NextResponse.json(
        { error: 'plan_unavailable', plan },
        { status: 503 },
      );
    }

    // Awaited, unlike the client-side reporters: this route is already doing a
    // round trip to Stripe, one insert is noise beside it, and a fire-and-forget
    // write on a serverless function can be killed by the response returning.
    await recordCheckoutStart(request, 'anon');

    return withSplitCookie(
      NextResponse.json({
        url: created.session.url,
        id: created.session.id,
        trial_days: created.trialEligible ? TRIAL_DAYS : 0,
      }),
      created.priced,
    );
  } catch (err) {
    console.error('[stripe checkout] anon session failed', err);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
}

/**
 * The step between "clicked the offer" and "paid", written where it actually
 * happens.
 *
 * A CTA click is reported by the browser and then the browser leaves for
 * Stripe, so until now the funnel went straight from a click to a subscription
 * days later with nothing in between. Anyone abandoning on the hosted checkout
 * page — which is most of them — was invisible, and a wall whose clicks all die
 * at the card form looked identical to a wall whose clicks convert.
 *
 * Recorded off the SAME rc_wall cookie the subscription metadata is built
 * from, so the checkout row and the eventual conversion agree about which wall
 * they belong to by construction rather than by a join we hope lines up.
 *
 * Nothing here can fail the checkout. A visitor with no wall cookie (came
 * straight to /plans, say) records nothing at all: there is no wall to credit,
 * and inventing one would put conversions on a surface that never sold them.
 */
async function recordCheckoutStart(request: NextRequest, viewerTier: string): Promise<void> {
  const wall = readWall(request.headers.get('cookie') ?? '');
  if (!wall?.feature) return;

  try {
    const { error } = await admin.from('paywall_events').insert(
      paywallEventRow(request, {
        kind: 'checkout_start',
        feature: wall.feature,
        surface: wall.from || 'unknown',
        viewerTier,
      }),
    );
    if (error) console.warn('[stripe checkout] paywall event insert failed', error);
  } catch (err) {
    console.warn('[stripe checkout] paywall event insert threw', err);
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
  region?: string; // 'BC' | 'WA' | 'OR' | 'CA' | 'Other' | other slug
  from?: string;   // analytics: 'spot' | 'pricing' | etc.
  /** Signed-out buyers only: the address Stripe bills and we provision from. */
  email?: string;
  /**
   * 'annual' (default) or 'monthly'. Monthly comes only from the plan
   * picker on the phone sheet; anything else reads as annual.
   */
  plan?: string;
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
  const plan: BillingPlan = billingPlanFrom(body.plan);

  // "Other" region = uncovered. Bounce to waitlist instead of taking money for
  // something we can't deliver yet.
  if (region.toLowerCase() === 'other') {
    return NextResponse.json(
      { redirect: '/explore?waitlist=1' },
      { status: 200 },
    );
  }

  if (plan === 'monthly' ? !MONTHLY_PRICE_ID : !ANNUAL_PRICE_ID) {
    // The price id is unset (see src/lib/pricing.ts). Fail with JSON rather
    // than crashing on an empty line_items price, which surfaces as an
    // unparseable 500 client-side. Annual is the product, so that gap takes
    // the whole thing — and the trial that rides on it — down with it;
    // monthly missing only takes the picker's second card.
    console.error(
      `[stripe checkout] ${plan === 'monthly' ? 'STRIPE_MONTHLY_PRICE_ID' : 'STRIPE_ANNUAL_PRICE_ID'} is not configured`,
    );
    return NextResponse.json(
      { error: 'plan_unavailable', plan },
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

    // Monthly never trials: the card is charged today, which is what the
    // sheet's monthly card says. Only the annual plan carries the free week.
    const trialEligible = plan === 'annual' && eligibility.eligible && !hadSubscription;

    if (!trialEligible) {
      console.info(
        '[stripe checkout] trial withheld',
        user.id,
        plan === 'monthly'
          ? 'monthly_plan'
          : (eligibility.reason ?? (hadSubscription ? 'prior_subscription' : 'unknown')),
      );
    }

    // Resolved here rather than at the top of the handler, because `currency`
    // may have just been overridden by the customer's Stripe-locked currency,
    // and the arms are not the same amount in both.
    const priced = await resolveCheckoutPrice(request, stripe, currency, plan);
    if (!priced.ok) {
      return NextResponse.json(
        { error: 'plan_unavailable', plan },
        { status: 503 },
      );
    }

    const origin = appOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      currency,
      line_items: [{ price: priced.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Explicit even though it's the default for subscription mode: the whole
      // trial design assumes a card is on file when the trial ends.
      payment_method_collection: 'always',
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan,
        currency,
        region: region || '',
        from: body.from ?? '',
        trial: String(trialEligible),
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          currency,
          trial: String(trialEligible),
          ...acquisitionMetadata(request.headers),
          // See the note on the anonymous path: the arms ride on the
          // subscription because that is what the webhook reads.
          ...splitMetadata(priced.arms),
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

    // Signed in and buying, so "free" is the tier they are leaving behind. A
    // paid viewer does not reach this route.
    await recordCheckoutStart(request, 'free');

    return withSplitCookie(
      NextResponse.json({
        url: session.url,
        id: session.id,
        trial_days: trialEligible ? TRIAL_DAYS : 0,
      }),
      priced,
    );
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

  // Who this is, hashed Meta's way, so the pay modal can identify the pixel
  // for a signed-in reader with everything the account holds: email, a
  // verified SMS number, the billing name. See src/lib/meta-identity.ts.
  const metaIdentity = await metaIdentityForUser(admin, { userId: user.id, email: user.email ?? null });

  return NextResponse.json({
    session_id: sessionId,
    meta_identity: metaIdentity,
    tier: entitlement.tier,
    status: entitlement.status,
    is_active: entitlement.isPro,
    in_grace: entitlement.inGrace,
    period_end: entitlement.periodEnd,
    trial_available: annualAvailable && trialEligibility.eligible,
    trial_days: TRIAL_DAYS,
    annual_available: annualAvailable,
    // The plan picker's second card. Unset in an environment means the sheet
    // draws the single annual button instead of a choice with a dead option.
    monthly_available: Boolean(MONTHLY_PRICE_ID),
  });
}
