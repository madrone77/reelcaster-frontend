import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  cardholderFirstName,
  storedFirstName,
  NAME_FALLBACK,
} from '@/lib/display-name';

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
 * Resolves the display first name, never from the email:
 *   1. the angler's own first_name (auth user_metadata)
 *   2. the cardholder name, first token — for paid users who never set one
 *   3. "Angler"
 * The dashboard calls this only when step 1 is empty.
 *
 * Step 2 used to retrieve the Stripe customer on every such call. The webhook
 * now mirrors that name onto user_settings.bill_name, so it rides back on the
 * query this route already makes and the Stripe round trip is gone.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Answered without touching the database when they have named themselves,
  // which is also the case the dashboard resolves on its own before ever
  // calling this.
  const own = storedFirstName(user);
  if (own) return NextResponse.json({ firstName: own });

  try {
    const { data: settings } = await admin
      .from('user_settings')
      .select('bill_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const name = cardholderFirstName(settings?.bill_name);
    if (name) return NextResponse.json({ firstName: name });
  } catch {
    // A DB failure just falls through to the literal fallback.
  }

  return NextResponse.json({ firstName: NAME_FALLBACK });
}
