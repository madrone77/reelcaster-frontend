/**
 * The single gate for both welcome modals.
 *
 *   GET  /api/welcome  -> which welcome, if any, is this user owed?
 *   POST /api/welcome  -> they closed the new-user tour; never show it again.
 *
 * Two modals want the root of the app: the three-step new-user tour (every
 * account, once) and the Pro setup wizard (Pro accounts, once). Left to
 * themselves they would both fetch on every signed-in page load and could both
 * decide to render on the same one. This route answers the question once, and
 * `WelcomeGate` mounts whichever modal won. The Pro wizard keeps its own
 * /api/pro/welcome call for the variant copy it needs (comped, trialing,
 * renewal date), but that call now only happens when a Pro welcome is actually
 * owed rather than on every page view.
 *
 * Ordering is deliberate: the tour comes first even for someone who bought Pro
 * on the way in. Configuring alerts is worth little to someone who does not yet
 * know what the score is made of. `next` tells the gate what to promote when
 * the tour closes, so the Pro wizard follows in the same session without a
 * reload.
 *
 * Like /api/pro/welcome, this deliberately stays off `useSubscription()`:
 * PostgREST fails an entire select if one named column is missing, so a column
 * added here must never be able to collapse a paying account to `free`.
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

/** Columns that predate this feature, so always safe to select. */
const BASE_COLUMNS = 'subscription_tier, subscription_status, pro_welcome_seen_at';

export type WelcomeKind = 'new' | 'pro';

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

const NOTHING = { kind: null as WelcomeKind | null, next: null as WelcomeKind | null };

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(NOTHING);

  const { data, error } = await admin
    .from('user_settings')
    .select(`${BASE_COLUMNS}, welcome_seen_at`)
    .eq('user_id', userId)
    .maybeSingle();

  let row = data as Record<string, unknown> | null;

  if (error) {
    // Almost certainly an unmigrated database. Retry without the new column so
    // the Pro wizard, which shipped first, keeps working; the tour just stays
    // quiet until the migration lands. Showing a modal whose dismissal we
    // cannot record would loop it forever.
    const retry = await admin
      .from('user_settings')
      .select(BASE_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (retry.error) {
      console.error('[welcome] settings read failed', retry.error);
      return NextResponse.json(NOTHING);
    }
    row = retry.data ? { ...retry.data, welcome_seen_at: new Date().toISOString() } : null;
  }

  // No row at all. `user_settings` is created lazily (the Stripe webhook, the
  // attribution write, the first alert), so an account minutes old often has
  // none yet — which is precisely the account this tour exists for. Treat it
  // as owed rather than as ineligible. POST creates the row when they close
  // it, so this cannot loop.
  if (!row) {
    return NextResponse.json({ kind: 'new' as const, next: null, pro: false });
  }

  const tier = (row.subscription_tier as string) ?? 'free';
  const status = (row.subscription_status as string) ?? 'none';
  const proOwed = isPro(tier, status) && !row.pro_welcome_seen_at;
  const tourOwed = !row.welcome_seen_at;

  if (tourOwed) {
    return NextResponse.json({
      kind: 'new' as const,
      next: proOwed ? ('pro' as const) : null,
      // Lets the tour name the tier it is describing without a second read.
      pro: isPro(tier, status),
    });
  }

  return NextResponse.json({
    kind: proOwed ? ('pro' as const) : null,
    next: null,
    pro: isPro(tier, status),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // The row may not exist yet for an account created minutes ago, and an
  // UPDATE matching nothing would leave the tour owed forever. DO NOTHING on
  // conflict so this can never blank a column the Stripe webhook already
  // wrote. Same shape as /api/attribution/signup.
  const { error: ensureError } = await admin
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (ensureError) {
    console.error('[welcome] could not ensure user_settings row', ensureError);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('user_settings')
    .update({ welcome_seen_at: now, updated_at: now })
    .eq('user_id', userId);

  if (error) {
    console.error('[welcome] dismiss failed', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
