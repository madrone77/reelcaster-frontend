/**
 * GET /api/cron/checkout-reminders
 *
 * Emails every signed-out buyer whose checkout expired unpaid since the last
 * day (the abandoned-checkout email, either arm of abandon_email_v1). Anyone
 * who tapped Stripe's Back arrow was already emailed by
 * /api/stripe/checkout/abandoned and is skipped here by the claim. Who qualifies, and
 * why sending twice is impossible, is in src/lib/checkout-reminder.ts.
 *
 * Every 15 minutes. Sessions expire 3 hours after they open, so this is what
 * decides how close to that the note lands.
 *
 * The scan looks back a full day rather than 15 minutes so a failed run, or a
 * failed send that released its claim, is picked up by the next one. The claim
 * makes the overlap free.
 *
 * GET, not POST. Vercel Cron issues GET requests.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import {
  REMINDERS_START,
  findReminderCandidates,
  sendCheckoutReminder,
  type ReminderOutcome,
} from '@/lib/checkout-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** A burst bigger than this is more likely a bug than a busy afternoon. */
const MAX_SENDS_PER_RUN = 40;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: Request) {
  // Closed rather than open when the secret is unset: this route emails people.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const expiredFrom = new Date(
    Math.max(now.getTime() - LOOKBACK_MS, REMINDERS_START.getTime()),
  );

  let scan;
  try {
    const stripe = await getStripe();
    scan = await findReminderCandidates(stripe, admin, { expiredFrom, expiredTo: now });
  } catch (err) {
    console.error('[checkout reminder cron] scan failed', err);
    return NextResponse.json({ ok: false, error: 'scan_failed' }, { status: 500 });
  }

  const tally: Record<ReminderOutcome, number> = { sent: 0, already_sent: 0, send_failed: 0 };
  const batch = scan.candidates.slice(0, MAX_SENDS_PER_RUN);

  // One at a time: Resend rate-limits, and the batch is a quarter hour's worth.
  for (const candidate of batch) {
    tally[await sendCheckoutReminder(admin, candidate, { trigger: 'expiry' })] += 1;
  }

  if (scan.candidates.length > batch.length) {
    console.warn(
      `[checkout reminder cron] ${scan.candidates.length} owed, capped at ${MAX_SENDS_PER_RUN}; the rest go next run`,
    );
  }

  const skipped: Record<string, number> = {};
  for (const s of scan.skipped) skipped[s.reason] = (skipped[s.reason] ?? 0) + 1;

  return NextResponse.json({ ok: true, owed: scan.candidates.length, ...tally, skipped });
}
