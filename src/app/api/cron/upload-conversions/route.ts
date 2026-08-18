/**
 * GET /api/cron/upload-conversions
 *
 * Drains the marketing_conversions upload queue.
 *
 * The webhook already tries to upload the moment it records a conversion, so
 * on a good day this finds nothing. It exists for the bad days: a Google
 * outage, an expired OAuth refresh token, a rate limit. Without it, a
 * conversion missed during a five-minute blip is missed permanently, and
 * Google only accepts a click for 90 days.
 *
 * GET, not POST. Vercel Cron issues GET requests, and a POST-only route
 * answers them with 405 forever without anything appearing to be wrong.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadPendingConversions } from '@/lib/conversion-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: Request) {
  // Vercel signs its cron calls with CRON_SECRET as a bearer token. When the
  // secret is unset the route stays closed rather than open: this endpoint
  // spends real money's worth of API quota and writes to the ad networks.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await uploadPendingConversions(admin, 100);
  return NextResponse.json({ ok: true, ...result });
}
