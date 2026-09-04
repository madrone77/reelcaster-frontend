/**
 * GET /api/cron/grace-reminders
 *
 * Sends the grace-ending nudge to every declined-card account whose 7-day
 * grace window closes inside the next 2 days and has not been nudged yet.
 *
 * Every 6 hours, offset from the trial-reminders run. The window is a fixed
 * 2 days wide, so the run frequency decides how much notice the last person
 * in each batch gets: six-hourly holds it between 1.75 and 2 days.
 *
 * GET, not POST. Vercel Cron issues GET requests, and a POST-only route answers
 * them with 405 forever without anything appearing to be wrong.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { amountLabelForStored } from '@/lib/pricing';
import {
  findDueGraceWindows,
  sendGraceReminder,
  type GraceReminderOutcome,
} from '@/lib/grace-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: Request) {
  // Vercel signs its cron calls with CRON_SECRET as a bearer token. Closed
  // rather than open when the secret is unset: this route emails customers.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const due = await findDueGraceWindows(admin);

  const tally: Record<GraceReminderOutcome, number> = {
    sent: 0,
    already_sent: 0,
    no_email: 0,
    send_failed: 0,
  };

  // One at a time. The batch is a handful of declines, and Resend rate-limits.
  for (const row of due) {
    const outcome = await sendGraceReminder(admin, {
      userId: row.user_id,
      graceUntil: row.grace_until,
      // The amount on THEIR subscription, not the tier's list price.
      amountLabel: amountLabelForStored(
        row.subscription_amount_cents,
        row.subscription_tier,
      ),
    });
    tally[outcome] += 1;
  }

  if (tally.send_failed > 0) {
    console.error(`[grace reminder cron] ${tally.send_failed} sends failed, will retry next run`);
  }

  return NextResponse.json({ ok: true, due: due.length, ...tally });
}
