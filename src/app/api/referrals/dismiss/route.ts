/**
 * POST /api/referrals/dismiss  { surface: 'spot' | 'dashboard' }  → { ok: true }
 *
 * Stamps the nag as dismissed on the account's `user_settings.dismissed_nags`.
 * The surface is checked against the enum because the body is client-written
 * and this lands in a jsonb column: an unchecked key would let a browser put
 * arbitrary keys of arbitrary size in the row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isReferralNagSurface } from '@/lib/referral-nag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let surface: unknown;
  try {
    surface = ((await request.json()) as { surface?: unknown }).surface;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isReferralNagSurface(surface)) {
    return NextResponse.json({ error: 'unknown_surface' }, { status: 400 });
  }

  // The row may not exist yet for a young account. DO NOTHING on conflict so
  // this can never blank a column another writer already filled in.
  const { error: ensureError } = await admin
    .from('user_settings')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ensureError) {
    console.error('[referral nag] could not ensure user_settings row', ensureError);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  // Merge, not replace: a second surface's no must not erase the first's.
  const { data: current } = await admin
    .from('user_settings')
    .select('dismissed_nags')
    .eq('user_id', user.id)
    .maybeSingle();
  const merged = {
    ...((current?.dismissed_nags as Record<string, string> | null) ?? {}),
    [surface]: new Date().toISOString(),
  };

  const { error: writeError } = await admin
    .from('user_settings')
    .update({ dismissed_nags: merged })
    .eq('user_id', user.id);
  if (writeError) {
    console.error('[referral nag] dismiss write failed', writeError);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
