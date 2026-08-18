/**
 * GET /api/cron/ingest-ad-spend
 *
 * Pulls yesterday's (and the preceding week's) ad spend from Google and Meta.
 *
 * Daily rather than hourly: spend figures are only published once a day and
 * are then restated for a few days afterwards, so polling more often would
 * spend API quota re-reading numbers that have not moved. Runs after both
 * platforms have closed out the previous day in Pacific time.
 *
 * GET, not POST. Vercel Cron issues GET requests, and a POST-only route
 * answers them with 405 forever without anything appearing to be wrong.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ingestAdSpend } from '@/lib/ad-spend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A wide backfill across many ads is a lot of paging.
export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ?days= lets a one-off backfill reach further back than the daily window,
  // which is what you want the first time credentials are added and there is
  // history sitting in the ad account already. Capped: the platforms page
  // slowly and an unbounded range would run past maxDuration.
  const requested = Number(new URL(request.url).searchParams.get('days'));
  const days = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 180) : undefined;

  const result = await ingestAdSpend(admin, days);

  // 200 even with per-platform errors: the response body carries them, and a
  // non-2xx would make Vercel report the whole job as failed when one of two
  // platforms succeeded.
  return NextResponse.json({ ok: result.errors.length === 0, ...result });
}
