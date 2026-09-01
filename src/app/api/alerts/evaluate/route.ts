/**
 * Alert Evaluation API
 *
 * POST /api/alerts/evaluate - Process all active alert profiles
 *
 * Driven by the GitHub Actions workflow every 30 minutes, and by hand when
 * someone dispatches it. The Vercel cron uses GET /api/cron/evaluate-alerts
 * instead: Vercel only ever sends GET, and the GET below is a health check
 * that evaluates nothing. Pointing a cron at this path would report success
 * forever while never sending an alert.
 *
 * The work itself lives in lib/alert-evaluation so both doors share one path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAlertEvaluation } from '@/lib/alert-evaluation';

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('Starting alert evaluation...');
  const outcome = await runAlertEvaluation();

  if (!outcome.ok) {
    return NextResponse.json({ success: false, error: outcome.error }, { status: 500 });
  }

  return NextResponse.json(outcome.summary);
}

// Allow GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'alerts/evaluate',
    description: 'POST with CRON_SECRET to evaluate all active alert profiles',
  });
}
