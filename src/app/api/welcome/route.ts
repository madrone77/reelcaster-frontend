/**
 * The single gate for both welcome modals.
 *
 *   GET  /api/welcome  -> which welcome, if any, is this user owed?
 *   POST /api/welcome  -> they closed one; never show that one again. The body
 *                         says which (`{kind}`); a bare POST means the tour,
 *                         which is what the tour has always sent.
 *
 * Three modals want the root of the app: the three-step new-user tour (every
 * account, once), the Pro setup wizard (Pro accounts, once) and the Pro
 * interstitial (accounts that are NOT Pro, once). Left to themselves they
 * would each fetch on every signed-in page load and could all decide to render
 * on the same one. This route answers the question once, and
 * `WelcomeGate` mounts whichever modal won. The Pro wizard keeps its own
 * /api/pro/welcome call for the variant copy it needs (comped, trialing,
 * renewal date), but that call now only happens when a Pro welcome is actually
 * owed rather than on every page view.
 *
 * Ordering is deliberate: the tour comes first even for someone who bought Pro
 * on the way in. Configuring alerts is worth little to someone who does not yet
 * know what the score is made of, and neither is an argument for paying.
 * `next` tells the gate what to promote when the tour closes, so the second
 * screen follows in the same session without a reload.
 *
 * `next` stays a single slot because the two things that can follow the tour
 * are mutually exclusive by definition: the wizard is for accounts that ARE
 * Pro and the interstitial for accounts that are not. No account is owed
 * both, now or later — buying Pro after dismissing the interstitial sets the
 * wizard owed and leaves `pro_upsell_seen_at` where it is.
 *
 * Like /api/pro/welcome, this deliberately stays off `useSubscription()`:
 * PostgREST fails an entire select if one named column is missing, so a column
 * added here must never be able to collapse a paying account to `free`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { claimAlertLeadForUser } from '@/lib/alert-leads';

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

/** Added after BASE_COLUMNS shipped; see the retry in GET. */
const GATE_COLUMNS = 'welcome_seen_at, pro_upsell_seen_at';

export type WelcomeKind = 'new' | 'pro' | 'upsell';

async function getUserId(request: NextRequest): Promise<string | null> {
  return (await getUser(request))?.id ?? null;
}

async function getUser(request: NextRequest): Promise<{ id: string; email?: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(authHeader.substring(7));

  return error || !user ? null : { id: user.id, email: user.email };
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
  const user = await getUser(request);
  if (!user) return NextResponse.json(NOTHING);
  const userId = user.id;

  // An address that left a signed-out alert (alert_leads) and has now made an
  // account gets that alert moved onto the account. This route runs once per
  // signed-in load, which makes it the one place a new account is always seen.
  await claimAlertLeadForUser(userId, user.email);

  const { data, error } = await admin
    .from('user_settings')
    .select(`${BASE_COLUMNS}, ${GATE_COLUMNS}`)
    .eq('user_id', userId)
    .maybeSingle();

  let row = data as Record<string, unknown> | null;

  if (error) {
    // Almost certainly an unmigrated database. Retry without the newer columns
    // so the Pro wizard, which shipped first, keeps working; the tour and the
    // interstitial just stay quiet until the migration lands. Showing a modal
    // whose dismissal we cannot record would loop it forever — which is why
    // the fallback marks both as already seen rather than as owed.
    const retry = await admin
      .from('user_settings')
      .select(BASE_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (retry.error) {
      console.error('[welcome] settings read failed', retry.error);
      return NextResponse.json(NOTHING);
    }
    const seen = new Date().toISOString();
    row = retry.data
      ? { ...retry.data, welcome_seen_at: seen, pro_upsell_seen_at: seen }
      : null;
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
  const paid = isPro(tier, status);
  const proOwed = paid && !row.pro_welcome_seen_at;
  // The mirror of proOwed, and the reason they can never both be true.
  const upsellOwed = !paid && !row.pro_upsell_seen_at;
  const tourOwed = !row.welcome_seen_at;

  /** Whichever second screen this account is owed, at most one. */
  const after: WelcomeKind | null = proOwed
    ? 'pro'
    : upsellOwed
      ? 'upsell'
      : null;

  if (tourOwed) {
    return NextResponse.json({
      kind: 'new' as const,
      next: after,
      // Lets the tour name the tier it is describing without a second read.
      pro: paid,
    });
  }

  return NextResponse.json({ kind: after, next: null, pro: paid });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Which screen is being dismissed. A bare POST — no body, or not JSON — is
  // the tour, which is exactly what the tour sends and has always sent.
  let kind: WelcomeKind = 'new';
  try {
    const body: { kind?: unknown } = await request.json();
    if (body.kind === 'upsell') kind = 'upsell';
  } catch {
    // No body, or not JSON.
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
  const column = kind === 'upsell' ? 'pro_upsell_seen_at' : 'welcome_seen_at';
  const { error } = await admin
    .from('user_settings')
    .update({ [column]: now, updated_at: now })
    .eq('user_id', userId);

  if (error) {
    console.error('[welcome] dismiss failed', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
