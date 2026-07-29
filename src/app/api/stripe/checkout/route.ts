import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import {
  currencyForRegion,
  priceIdFor,
  type BillingCurrency,
  type PricingPlan,
} from '@/lib/pricing';

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
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const stripe = await getStripe();

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

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
    // surfaces as an unparseable 500 client-side.
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
  try {
    const { data: existingSettings } = await admin
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

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

    const origin = appOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      currency,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan,
        currency,
        region: region || '',
        from: body.from ?? '',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          currency,
        },
      },
    });

    return NextResponse.json({ url: session.url, id: session.id });
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

  const { data: settings } = await admin
    .from('user_settings')
    .select('subscription_tier, subscription_status, subscription_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  const tier = settings?.subscription_tier ?? 'free';
  const status = settings?.subscription_status ?? 'none';
  const isActive =
    (tier === 'pro_annual' || tier === 'pro_monthly') &&
    (status === 'active' || status === 'trialing');

  return NextResponse.json({
    session_id: sessionId,
    tier,
    status,
    is_active: isActive,
    period_end: settings?.subscription_period_end ?? null,
  });
}
