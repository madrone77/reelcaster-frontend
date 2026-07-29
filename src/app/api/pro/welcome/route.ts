/**
 * Backs the one-time "Welcome to Pro" modal.
 *
 *   GET  /api/pro/welcome  -> should the modal show, and in which variant?
 *   POST /api/pro/welcome  -> the user dismissed it; never show it again.
 *
 * This deliberately does NOT ride along on `useSubscription()`. PostgREST
 * fails the whole select if any named column is missing, so adding
 * `pro_welcome_seen_at` to that hook's query would collapse every paying
 * account to `free` on any environment where this migration has not run yet.
 * Keeping the modal on its own endpoint means an unmigrated database costs us
 * the modal and nothing else.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(authHeader.substring(7));

  return error || !user ? null : user.id;
}

/** Same rule the six entitlement gates use. */
function isPro(tier: string, status: string): boolean {
  return (
    (tier === 'pro_annual' || tier === 'pro_monthly') &&
    (status === 'active' || status === 'trialing')
  );
}

const HIDDEN = { show: false as const };

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(HIDDEN);

  const { data, error } = await admin
    .from('user_settings')
    .select(
      'subscription_tier, subscription_status, subscription_period_end, comp_expires_at, pro_welcome_seen_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  // Unmigrated database (or any read failure): stay quiet rather than showing
  // a modal we then can't record a dismissal for — that would loop forever.
  if (error) {
    console.error('[pro/welcome] settings read failed', error);
    return NextResponse.json(HIDDEN);
  }
  if (!data) return NextResponse.json(HIDDEN);

  const tier = data.subscription_tier ?? 'free';
  const status = data.subscription_status ?? 'none';

  if (!isPro(tier, status) || data.pro_welcome_seen_at) {
    return NextResponse.json(HIDDEN);
  }

  const compExpiresAt = data.comp_expires_at ?? null;
  const comped = compExpiresAt !== null && new Date(compExpiresAt) > new Date();

  return NextResponse.json({
    show: true,
    comped,
    tier,
    // For a comp this is the day the grant lapses; otherwise the next renewal.
    until: comped ? compExpiresAt : (data.subscription_period_end ?? null),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { error } = await admin
    .from('user_settings')
    .update({ pro_welcome_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[pro/welcome] dismiss failed', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
