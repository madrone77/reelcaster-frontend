import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { ANNUAL_PRICE_ID } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function tierFromPriceId(priceId: string | null | undefined): 'pro_annual' | 'pro_monthly' {
  return priceId === ANNUAL_PRICE_ID ? 'pro_annual' : 'pro_monthly';
}

async function applySubscriptionToUser(subscription: Stripe.Subscription) {
  const customer = subscription.customer;
  const customerId = typeof customer === 'string' ? customer : customer.id;
  const customerMetaUserId =
    typeof customer === 'string' || customer.deleted
      ? null
      : customer.metadata?.supabase_user_id ?? null;

  let resolvedUserId: string | null =
    subscription.metadata?.supabase_user_id ?? customerMetaUserId;

  if (!resolvedUserId && customerId) {
    const { data } = await admin
      .from('user_settings')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    resolvedUserId = data?.user_id ?? null;
  }

  if (!resolvedUserId) {
    console.error('[stripe webhook] no user_id resolvable for subscription', subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const tier = tierFromPriceId(priceId);
  const status = subscription.status; // active | trialing | past_due | canceled | ...
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  await admin
    .from('user_settings')
    .upsert(
      {
        user_id: resolvedUserId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: status,
        subscription_tier: status === 'active' || status === 'trialing' ? tier : 'free',
        subscription_period_end: periodEnd,
      },
      { onConflict: 'user_id' },
    );
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'webhook_secret_not_configured' },
      { status: 500 },
    );
  }

  const sig = request.headers.get('stripe-signature') ?? '';
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    return NextResponse.json({ error: `webhook_signature: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToUser(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscriptionToUser(sub);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
        if (invoice.subscription) {
          const subId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToUser(sub);
        }
        break;
      }
      default:
        // Ignore other events.
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', event.type, err);
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
