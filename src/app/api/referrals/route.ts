/**
 * GET /api/referrals → ReferralSummary
 *
 * The signed-in account's share link and what it has earned. Mints the code
 * on first ask, which is why this is a route with the service role and not a
 * client read: `referral_code` is one of the columns a browser may not write.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { referralSummary } from '@/lib/referrals-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
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

  const summary = await referralSummary(admin, user.id);
  if (!summary) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  return NextResponse.json(summary, { headers: { 'Cache-Control': 'private, no-store' } });
}
