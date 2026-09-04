/**
 * The notice that Pro has switched off after a declined card.
 *
 * The decline email opens a 7-day grace window, the two-days-left nudge in
 * ./grace-reminder warns that it is closing, and this is the last of the
 * three: Pro is off, here is what the account keeps, here is how to get it
 * back. Nobody should find out their forecasts went dark by opening the app.
 *
 * Two things can decide to send it, and they do not agree on timing:
 *
 *   1. GET /api/cron/grace-reminders, every 6 hours. Sweeps for rows whose
 *      grace_until has passed while Stripe is still retrying. Entitlement
 *      lapses at read time, so without this sweep nothing marks the moment.
 *      The subscription still exists, so a card update brings Pro straight
 *      back: the email says so.
 *   2. Stripe's customer.subscription.deleted webhook, when Stripe's own
 *      retries give up and it cancels with reason 'payment_failed'. The
 *      subscription is gone, so the email points at a fresh purchase.
 *
 * Exactly one send per window. Both callers claim the send with a conditional
 * UPDATE on user_settings.lapse_notice_sent_at, the same pattern as the day-4
 * trial reminder. The webhook resets the stamp when it opens a fresh window.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { proLapsedEmail } from '@/lib/email-templates/billing';
import { SUPPORT_EMAIL } from '@/lib/site';

const DAY_MS = 86_400_000;

/**
 * How far back the sweep looks. A row whose grace closed weeks ago and still
 * reads past_due is a fossil (Stripe cancelled and we missed the event, or an
 * admin hand-set it), and a "Pro switched off today" email would be a lie.
 */
const SWEEP_WINDOW_DAYS = 14;

/** Payment problems, as opposed to a real cancellation. Mirrors entitlement.ts. */
const PAYMENT_PROBLEM_STATUSES = ['past_due', 'unpaid'];

export interface LapseDue {
  user_id: string;
  grace_until: string;
  subscription_tier: string | null;
  subscription_amount_cents: number | null;
}

/**
 * Grace windows that have closed and have not been notified.
 *
 * Bounded below as well as above, see SWEEP_WINDOW_DAYS.
 */
export async function findLapsedGraceWindows(
  admin: SupabaseClient,
  now: Date = new Date(),
  limit = 200,
): Promise<LapseDue[]> {
  const { data, error } = await admin
    .from('user_settings')
    .select('user_id, grace_until, subscription_tier, subscription_amount_cents')
    .in('subscription_status', PAYMENT_PROBLEM_STATUSES)
    .is('lapse_notice_sent_at', null)
    .not('grace_until', 'is', null)
    .lte('grace_until', now.toISOString())
    .gt('grace_until', new Date(now.getTime() - SWEEP_WINDOW_DAYS * DAY_MS).toISOString())
    .order('grace_until', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[lapse notice] due query failed', error);
    return [];
  }

  return (data ?? []) as LapseDue[];
}

/**
 * Take the send, or find out somebody else already has. One statement, so the
 * cron and the webhook cannot both come away thinking they won.
 */
async function claimLapseNotice(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('user_settings')
    .update({ lapse_notice_sent_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('lapse_notice_sent_at', null)
    .select('user_id');

  if (error) {
    console.error('[lapse notice] claim failed', userId, error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/** Put the send back on the table after a failure, so the next run retries. */
async function releaseLapseNotice(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from('user_settings')
    .update({ lapse_notice_sent_at: null })
    .eq('user_id', userId);

  if (error) {
    console.error('[lapse notice] could not release claim', userId, error);
  }
}

async function emailForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error('[lapse notice] could not read user', userId, error);
    return null;
  }
  return data.user?.email ?? null;
}

export type LapseNoticeOutcome =
  | 'sent'
  | 'already_sent'
  | 'no_email'
  | 'send_failed';

/**
 * Send the switched-off notice to one account. Safe to call from anywhere,
 * any number of times: the claim makes every call after the first a no-op.
 *
 * `canResume`: true while the Stripe subscription still exists (the cron
 * path), so updating the card revives it. False once Stripe has cancelled it
 * (the webhook path), when the only way back is a new purchase.
 */
export async function sendLapseNotice(
  admin: SupabaseClient,
  params: {
    userId: string;
    amountLabel: string;
    canResume: boolean;
  },
): Promise<LapseNoticeOutcome> {
  if (!(await claimLapseNotice(admin, params.userId))) return 'already_sent';

  const email = await emailForUser(admin, params.userId);
  if (!email) {
    // Nothing to retry against. Leaving the claim set stops every later run
    // from re-doing this lookup for an account that has no address.
    return 'no_email';
  }

  const { subject, html } = proLapsedEmail({
    amountLabel: params.amountLabel,
    canResume: params.canResume,
  });

  // The copy says "reply to this email", and the From is a noreply address.
  const result = await sendEmail({ to: email, subject, html, replyTo: SUPPORT_EMAIL });

  if (!result.success) {
    console.error('[lapse notice] send failed', params.userId, result.error);
    await releaseLapseNotice(admin, params.userId);
    return 'send_failed';
  }

  return 'sent';
}
