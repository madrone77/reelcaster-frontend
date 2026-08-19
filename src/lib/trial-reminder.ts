/**
 * The day-4 trial email: one send, whoever asks for it.
 *
 * The landing page promises "we email you three days out, before anything is
 * charged", and for a card-required trial that auto-charges, that notice is a
 * legal requirement rather than a courtesy (Canadian consumer-protection rules
 * and the US FTC negative-option rule both want the date and the amount stated
 * in advance). So it gets two independent triggers:
 *
 *   1. GET /api/cron/trial-reminders, every 6 hours. Owns the send.
 *   2. Stripe's customer.subscription.trial_will_end webhook, as a backstop.
 *
 * Two triggers because either one alone is a single point of failure. The
 * webhook only fires if that event is subscribed on the live endpoint, which is
 * a dashboard setting no code can guarantee. The cron only fires if
 * trial_ends_at got written, which depends on the webhook having landed. They
 * fail in different ways, which is the point.
 *
 * Exactly one email comes out of that because both go through
 * claimTrialReminder, which is a conditional UPDATE: the first caller to set
 * user_settings.trial_reminder_sent_at wins and everyone else is told to stop.
 * If the send then fails, the claim is released so the next run retries.
 *
 * The email is not only a bill. A trial that ends with nobody having saved a
 * spot did not lose on price, it lost on setup, so the note leads with where
 * the account actually got to and what is left undone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { trialEndingEmail, type TrialSetupState } from '@/lib/email-templates/billing';
import { SUPPORT_EMAIL } from '@/lib/site';

/**
 * How far ahead of the charge the reminder goes out. Matches what Stripe's own
 * trial_will_end event uses, so the two triggers agree on the day, and matches
 * the "three days out" on the landing page. On a 7-day trial that is day 4.
 */
export const REMINDER_LEAD_DAYS = 3;

const DAY_MS = 86_400_000;

export interface TrialDue {
  user_id: string;
  trial_ends_at: string;
  subscription_tier: string | null;
}

/**
 * Trials that are inside the reminder window and have not been reminded.
 *
 * Upper bound AND lower bound. Without `trial_ends_at > now()` an old trialing
 * row whose status never got updated would keep matching forever, and every
 * run would try to email somebody about a date in the past.
 */
export async function findDueTrials(
  admin: SupabaseClient,
  now: Date = new Date(),
  limit = 200,
): Promise<TrialDue[]> {
  const { data, error } = await admin
    .from('user_settings')
    .select('user_id, trial_ends_at, subscription_tier')
    .eq('subscription_status', 'trialing')
    .is('trial_reminder_sent_at', null)
    .not('trial_ends_at', 'is', null)
    .gt('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', new Date(now.getTime() + REMINDER_LEAD_DAYS * DAY_MS).toISOString())
    .order('trial_ends_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[trial reminder] due query failed', error);
    return [];
  }

  return (data ?? []) as TrialDue[];
}

/**
 * Take the send, or find out somebody else already has.
 *
 * One statement, so two concurrent callers cannot both come away thinking they
 * won: Postgres serialises the row update and only the first sees a row come
 * back. Returns true when this caller owns the send.
 */
async function claimTrialReminder(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('user_settings')
    .update({ trial_reminder_sent_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('trial_reminder_sent_at', null)
    .select('user_id');

  if (error) {
    console.error('[trial reminder] claim failed', userId, error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/** Put the send back on the table after a failure, so the next run retries. */
async function releaseTrialReminder(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from('user_settings')
    .update({ trial_reminder_sent_at: null })
    .eq('user_id', userId);

  if (error) {
    // Worth shouting about: a stuck claim means this person silently never
    // gets the notice we are legally required to send them.
    console.error('[trial reminder] could not release claim', userId, error);
  }
}

/**
 * What this account has set up. Head counts, not row fetches: the numbers are
 * all the email uses, and PostgREST truncates a large select at 1000 rows
 * without saying so, which would quietly understate a heavy user.
 */
export async function readSetupState(
  admin: SupabaseClient,
  userId: string,
): Promise<TrialSetupState | undefined> {
  const [spots, alerts] = await Promise.all([
    admin
      .from('user_favorite_spots')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    admin
      .from('user_alert_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);

  if (spots.error || alerts.error) {
    // Send the plain notice rather than no notice. See trialEndingEmail.
    console.warn('[trial reminder] setup counts unavailable', userId, spots.error ?? alerts.error);
    return undefined;
  }

  return {
    savedSpots: spots.count ?? 0,
    activeAlerts: alerts.count ?? 0,
  };
}

async function emailForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error('[trial reminder] could not read user', userId, error);
    return null;
  }
  return data.user?.email ?? null;
}

export type TrialReminderOutcome =
  | 'sent'
  | 'already_sent'
  | 'no_email'
  | 'send_failed';

/**
 * Send the day-4 note to one account. Safe to call from anywhere, any number
 * of times: the claim makes every call after the first a no-op.
 */
export async function sendTrialReminder(
  admin: SupabaseClient,
  params: {
    userId: string;
    trialEndsAt: string;
    amountLabel: string;
  },
): Promise<TrialReminderOutcome> {
  if (!(await claimTrialReminder(admin, params.userId))) return 'already_sent';

  const email = await emailForUser(admin, params.userId);
  if (!email) {
    // Nothing to retry against, and leaving the claim set stops every later
    // run from re-doing this lookup for an account that has no address.
    return 'no_email';
  }

  const setup = await readSetupState(admin, params.userId);
  const { subject, html } = trialEndingEmail({
    trialEndsAt: params.trialEndsAt,
    amountLabel: params.amountLabel,
    setup,
  });

  // The copy says "reply to this email", and the From is a noreply address.
  const result = await sendEmail({ to: email, subject, html, replyTo: SUPPORT_EMAIL });

  if (!result.success) {
    console.error('[trial reminder] send failed', params.userId, result.error);
    await releaseTrialReminder(admin, params.userId);
    return 'send_failed';
  }

  return 'sent';
}
