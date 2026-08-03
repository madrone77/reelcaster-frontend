import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { storedFirstName, NAME_FALLBACK } from '@/lib/display-name';

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

function firstToken(raw: string | null | undefined): string | null {
  const token = raw?.trim().split(/\s+/)[0];
  return token || null;
}

/**
 * Resolves the display first name, never from the email:
 *   1. the angler's own first_name (auth user_metadata)
 *   2. Stripe customer name, first token — for existing paid users who never set one
 *   3. "Angler"
 * The dashboard calls this only when step 1 is empty.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const own = storedFirstName(user);
  if (own) return NextResponse.json({ firstName: own });

  try {
    const { data: settings } = await admin
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settings?.stripe_customer_id) {
      const stripe = await getStripe();
      const customer = await stripe.customers.retrieve(settings.stripe_customer_id);
      // A deleted customer has `{ deleted: true }` and no `name`.
      const name =
        !('deleted' in customer) ? firstToken(customer.name) : null;
      if (name) return NextResponse.json({ firstName: name });
    }
  } catch {
    // Any Stripe/DB failure just falls through to the literal fallback.
  }

  return NextResponse.json({ firstName: NAME_FALLBACK });
}
