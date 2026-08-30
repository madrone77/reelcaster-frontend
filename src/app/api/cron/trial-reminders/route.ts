/**
 * GET /api/cron/trial-reminders
 *
 * Sends the day-4 note to every trial that converts inside the next 3 days and
 * has not been reminded yet.
 *
 * This owns the send. Stripe's customer.subscription.trial_will_end webhook
 * does the same job and is kept as a backstop, but it only fires if that event
 * is subscribed on the live endpoint, which is a dashboard setting rather than
 * something the code can guarantee. A card-required trial that auto-charges
 * needs this notice to go out, so it does not hang on a checkbox.
 *
 * Every 6 hours rather than daily. The window is a fixed 3 days wide, so the
 * run frequency decides how much notice the last person in each batch gets:
 * daily could cut it to 2 days, six-hourly holds it between 2.75 and 3.
 *
 * GET, not POST. Vercel Cron issues GET requests, and a POST-only route answers
 * them with 405 forever without anything appearing to be wrong.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { amountLabelForStored } from '@/lib/pricing';
import {
  findDueTrials,
  sendTrialReminder,
  type TrialReminderOutcome,
} from '@/lib/trial-reminder';

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

  const due = await findDueTrials(admin);

  const tally: Record<TrialReminderOutcome, number> = {
    sent: 0,
    already_sent: 0,
    no_email: 0,
    send_failed: 0,
  };

  // One at a time. The batch is small (a day's worth of trial starts), and
  // Resend rate-limits, so there is nothing to win by firing them together.
  for (const row of due) {
    const outcome = await sendTrialReminder(admin, {
      userId: row.user_id,
      trialEndsAt: row.trial_ends_at,
      // The amount on THEIR subscription. A price test makes the tier an
      // ambiguous answer, and this notice is the one that must be exact.
      amountLabel: amountLabelForStored(
        row.subscription_amount_cents,
        row.subscription_tier,
      ),
    });
    tally[outcome] += 1;
  }

  if (tally.send_failed > 0) {
    console.error(`[trial reminder cron] ${tally.send_failed} sends failed, will retry next run`);
  }

  return NextResponse.json({ ok: true, due: due.length, ...tally });
}
