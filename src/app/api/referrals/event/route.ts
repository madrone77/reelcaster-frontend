/**
 * POST /api/referrals/event  { kind, surface }  → { ok: true }
 *
 * Records one tap on the referral share controls in `referral_share_events`,
 * so the bluecaster admin can see who tried to share, not only whose link got
 * opened. Kind and surface are checked against their enums because the body is
 * client-written. Device comes from the request's User-Agent, never the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyUserAgent } from '@/lib/device';
import { pacificDay } from '@/lib/pacific-day';
import { isReferralShareKind, isReferralShareSurface } from '@/lib/referral-share-event';

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

  let body: { kind?: unknown; surface?: unknown };
  try {
    body = (await request.json()) as { kind?: unknown; surface?: unknown };
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isReferralShareKind(body.kind) || !isReferralShareSurface(body.surface)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { error: writeError } = await admin.from('referral_share_events').insert({
    day: pacificDay(),
    user_id: user.id,
    kind: body.kind,
    surface: body.surface,
    device: classifyUserAgent(request.headers.get('user-agent')).device,
  });
  if (writeError) {
    console.error('[referrals] share event write failed', writeError);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
