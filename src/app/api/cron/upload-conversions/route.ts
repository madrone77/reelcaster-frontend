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
 *
 * ON THE TIME LIMIT. The drain posts one HTTP request per conversion, in
 * sequence, and the queue used to hold a handful of rows a week — a full batch
 * of 100 was theoretical. It stopped being theoretical when paywall opens
 * became a reportable event: those arrive by the dozen per day, and 100
 * sequential calls to Meta is comfortably longer than the 15 seconds a
 * Node function defaults to. Raised rather than parallelised, because the
 * failure this route exists to survive is a network having a bad minute, and
 * hammering it with 100 concurrent requests is the wrong response to that.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadPendingConversions } from '@/lib/conversion-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
