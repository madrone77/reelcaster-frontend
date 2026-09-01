/**
 * The Vercel cron door onto alert evaluation.
 *
 * Exists because Vercel crons issue GET and /api/alerts/evaluate answers GET
 * with a health check. A cron pointed at that path returns 200 on every tick
 * and never evaluates anything, which is the quietest possible failure for a
 * feature whose whole job is to speak up.
 *
 * This is a SECOND scheduler, not a replacement. The GitHub Action stays.
 * GitHub drops scheduled runs in multi-hour blocks under load: over the week to
 * 2026-09-01 it delivered 6 runs inside the 6-9am send window on three days and
 * 0 or 1 on three others. Two independent schedulers on offset half-hours mean
 * a dropped block on either side still leaves the window covered. The run is
 * idempotent by construction, so the redundancy costs nothing but compute.
 */

import { NextResponse } from 'next/server';
import { runAlertEvaluation } from '@/lib/alert-evaluation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Vercel signs its cron calls with CRON_SECRET as a bearer token. Closed
  // rather than open when the secret is unset: this route texts customers.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  console.log('Starting alert evaluation (vercel cron)...');
  const outcome = await runAlertEvaluation();

  if (!outcome.ok) {
    return NextResponse.json({ success: false, error: outcome.error }, { status: 500 });
  }

  return NextResponse.json(outcome.summary);
}
