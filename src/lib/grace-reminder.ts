/**
 * The grace-ending nudge for a declined card.
 *
 * When the day-7 (or renewal) charge fails, the webhook opens a 7-day grace
 * window and sends one email. Nothing else happens until the window closes and
 * Pro lapses at read time in entitlement.ts. On a $33/yr plan that silence
 * costs the whole year, so this sends a second note when two days are left:
 * the date Pro switches off, the amount, and the button that fixes the card.
 *
 * One trigger, GET /api/cron/grace-reminders every 6 hours. There is no Stripe
 * event for "grace is nearly over" because the window is ours, not Stripe's.
 *
 * Exactly one send per window. The cron claims the send with a conditional
 * UPDATE on user_settings.grace_reminder_sent_at, the same pattern as the
 * day-4 trial reminder in ./trial-reminder. The webhook resets the stamp when
 * it opens a fresh window, so a later decline gets its own nudge.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { graceEndingEmail } from '@/lib/email-templates/billing';
import { SUPPORT_EMAIL } from '@/lib/site';

/**
 * How far ahead of the lapse the nudge goes out. Two days into a 7-day window
 * leaves room for a card update and one automatic retry before Pro turns off.
 */
export const GRACE_REMINDER_LEAD_DAYS = 2;

const DAY_MS = 86_400_000;

/** Payment problems, as opposed to a real cancellation. Mirrors entitlement.ts. */
const PAYMENT_PROBLEM_STATUSES = ['past_due', 'unpaid'];

export interface GraceDue {
  user_id: string;
  grace_until: string;
  subscription_tier: string | null;
  /** What this subscriber is being charged, stamped by the Stripe webhook. */
  subscription_amount_cents: number | null;
}

/**
 * Grace windows inside the nudge window that have not been nudged.
 *
 * Upper bound AND lower bound. Without `grace_until > now()` a lapsed row that
 * Stripe never cancelled would keep matching forever, and every run would try
 * to email somebody about a date in the past.
 */
export async function findDueGraceWindows(
  admin: SupabaseClient,
  now: Date = new Date(),
  limit = 200,
): Promise<GraceDue[]> {
  const { data, error } = await admin
    .from('user_settings')
    .select('user_id, grace_until, subscription_tier, subscription_amount_cents')
    .in('subscription_status', PAYMENT_PROBLEM_STATUSES)
    .is('grace_reminder_sent_at', null)
    .not('grace_until', 'is', null)
    .gt('grace_until', now.toISOString())
    .lte('grace_until', new Date(now.getTime() + GRACE_REMINDER_LEAD_DAYS * DAY_MS).toISOString())
    .order('grace_until', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[grace reminder] due query failed', error);
    return [];
  }

  return (data ?? []) as GraceDue[];
}

/**
 * Take the send, or find out somebody else already has. One statement, so two
 * overlapping runs cannot both come away thinking they won.
 */
async function claimGraceReminder(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('user_settings')
    .update({ grace_reminder_sent_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('grace_reminder_sent_at', null)
    .select('user_id');

  if (error) {
    console.error('[grace reminder] claim failed', userId, error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/** Put the send back on the table after a failure, so the next run retries. */
async function releaseGraceReminder(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from('user_settings')
    .update({ grace_reminder_sent_at: null })
    .eq('user_id', userId);

  if (error) {
    console.error('[grace reminder] could not release claim', userId, error);
  }
}

async function emailForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error('[grace reminder] could not read user', userId, error);
    return null;
  }
  return data.user?.email ?? null;
}

export type GraceReminderOutcome =
  | 'sent'
  | 'already_sent'
  | 'no_email'
  | 'send_failed';

/**
 * Send the grace-ending nudge to one account. Safe to call any number of
 * times: the claim makes every call after the first a no-op.
 */
export async function sendGraceReminder(
  admin: SupabaseClient,
  params: {
    userId: string;
    graceUntil: string;
    amountLabel: string;
  },
): Promise<GraceReminderOutcome> {
  if (!(await claimGraceReminder(admin, params.userId))) return 'already_sent';

  const email = await emailForUser(admin, params.userId);
  if (!email) {
    // Nothing to retry against. Leaving the claim set stops every later run
    // from re-doing this lookup for an account that has no address.
    return 'no_email';
  }

  const { subject, html } = graceEndingEmail({
    graceUntil: params.graceUntil,
    amountLabel: params.amountLabel,
  });

  // The copy says "reply to this email", and the From is a noreply address.
  const result = await sendEmail({ to: email, subject, html, replyTo: SUPPORT_EMAIL });

  if (!result.success) {
    console.error('[grace reminder] send failed', params.userId, result.error);
    await releaseGraceReminder(admin, params.userId);
    return 'send_failed';
  }

  return 'sent';
}
