import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';
import { ANNUAL_PRICE_ID, resolveMonthlyPriceId, type PricingPlan } from '@/lib/pricing';
import { TRIAL_DAYS, checkTrialEligibility } from '@/lib/trial';

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

  const priceId = plan === 'annual' ? ANNUAL_PRICE_ID : resolveMonthlyPriceId();

  // STRIPE_ANNUAL_PRICE_ID is unset until the $33/yr Price exists in Stripe.
  // Fail loudly here rather than handing Stripe an empty price and getting an
  // opaque 400 back — the annual plan carries the trial, so this is the one
  // config gap that takes the whole trial flow down.
  if (!priceId) {
    console.error('[stripe checkout] no price id for plan', plan);
    return NextResponse.json(
      { error: 'plan_unavailable', message: 'That plan is not available yet.' },
      { status: 503 },
    );
  }

  // Look up an existing stripe_customer_id, or create the customer + row.
  const { data: existingSettings } = await admin
    .from('user_settings')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let stripeCustomerId = existingSettings?.stripe_customer_id ?? null;
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

  // The 7-day trial rides on the annual plan only. Monthly is instant-charge,
  // which keeps "start your trial" and "buy the yearly plan" one decision.
  // Ineligible customers aren't told why — they just go through paid checkout.
  const eligibility =
    plan === 'annual'
      ? await checkTrialEligibility(admin, user.id, user.email)
      : { eligible: false as const, reason: undefined };

  if (plan === 'annual' && !eligibility.eligible) {
    console.info('[stripe checkout] trial withheld', user.id, eligibility.reason);
  }

  const origin = appOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    // Explicit even though it's the default for subscription mode: the whole
    // trial design assumes a card is on file when the trial ends.
    payment_method_collection: 'always',
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing/cancel`,
    metadata: {
      supabase_user_id: user.id,
      plan,
      region: region || '',
      from: body.from ?? '',
      trial: eligibility.eligible ? 'yes' : 'no',
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        plan,
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
