import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, appOrigin } from '@/lib/stripe';

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

/**
 * Optional body. `flow: 'payment_method_update'` drops the customer on the
 * card form instead of the portal home, and brings them back to the account
 * page when done. That is the whole journey for a declined card, so it should
 * not be three clicks deep inside Stripe.
 */
async function requestedFlow(request: NextRequest): Promise<'payment_method_update' | null> {
  try {
    const body = (await request.json()) as { flow?: unknown } | null;
    return body?.flow === 'payment_method_update' ? 'payment_method_update' : null;
  } catch {
    return null; // no body, or not JSON: the plain portal
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const flow = await requestedFlow(request);

  const { data: settings } = await admin
    .from('user_settings')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings?.stripe_customer_id) {
    return NextResponse.json({ error: 'no_customer' }, { status: 404 });
  }

  const origin = appOrigin(request);
  const stripe = await getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: settings.stripe_customer_id,
    return_url: `${origin}/profile`,
    ...(flow === 'payment_method_update'
      ? {
          flow_data: {
            type: 'payment_method_update',
            after_completion: {
              type: 'redirect',
              redirect: { return_url: `${origin}/settings/account` },
            },
          },
        }
      : {}),
  });

  return NextResponse.json({ url: session.url });
}
