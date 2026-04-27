import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, appOrigin } from '@/lib/stripe';
import { ANNUAL_PRICE_ID, resolveMonthlyPriceId, type PricingPlan } from '@/lib/pricing';

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

  const origin = appOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=1`,
    metadata: {
      supabase_user_id: user.id,
      plan,
      region: region || '',
      from: body.from ?? '',
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
    },
  });

  return NextResponse.json({ url: session.url, id: session.id });
}
