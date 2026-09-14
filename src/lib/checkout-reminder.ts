/**
 * The "almost done signing up" email: who gets it, and sending it once.
 *
 * WHO. A signed-out buyer whose Checkout Session expired without paying. They
 * typed their email on our paywall (or on Stripe's page), so we have an address
 * and nothing else: no subscription, so no webhook, so no account. Before this,
 * the only trace was the expired session and, for anyone who reached the card
 * form, a bare Stripe customer that looked like a sync bug in the admin.
 *
 * Driven from Stripe rather than our own tables because the session is the only
 * record that exists. An address is skipped when any of these hold:
 *
 *   - it has an account (bought another way, or signed up free since);
 *   - any session for it completed, or one is still open (still at checkout);
 *   - it was already sent this email (the table's primary key, see the claim);
 *   - it is a test domain.
 *
 * WHEN. Signed-out sessions now expire after 3 hours (src/lib/anon-checkout.ts),
 * and GET /api/cron/checkout-reminders runs every 15 minutes, so the email
 * lands 3 to 3.25 hours after somebody opened checkout.
 *
 * Only sessions that expired after REMINDERS_START are automatic. Everything
 * before it was reviewed by hand and sent (or not) with
 * scripts/checkout-reminder-backfill.ts, so turning the cron on could not email
 * a month of people nobody had looked at.
 *
 * SERVER-ONLY: takes a Stripe client and a service-role Supabase client.
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { checkoutReminderEmail } from '@/lib/email-templates/checkout-reminder';
import { checkTrialEligibilityByEmail } from '@/lib/trial';
import { SUPPORT_EMAIL } from '@/lib/site';

export const CHECKOUT_REMINDER_TABLE = 'checkout_reminder_emails';

/** The first expiry the cron owns. Older ones belong to the backfill script. */
export const REMINDERS_START = new Date('2026-09-13T18:40:00-07:00');

/** Stripe's longest session lifetime. A session expiring now began at most this long ago. */
const MAX_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

const TEST_DOMAIN = /@(?:[^@]+\.)?(?:test|example\.com|reelcaster\.test)$/i;

export interface ReminderCandidate {
  email: string;
  /** The newest expired signed-out session for this address. */
  sessionId: string;
  startedAt: string;
  expiredAt: string;
  region: string | null;
  from: string | null;
  /** Sessions this address opened inside the scan. */
  attempts: number;
  /** Stripe made a customer, which it only does once somebody reaches the payment step. */
  reachedPayment: boolean;
}

export type SkipReason =
  | 'has_account'
  | 'completed'
  | 'still_open'
  | 'already_emailed'
  | 'test_address';

export interface ReminderScan {
  candidates: ReminderCandidate[];
  skipped: Array<{ email: string; reason: SkipReason; lastStartedAt: string }>;
}

function emailOf(session: Stripe.Checkout.Session): string | null {
  const raw =
    session.metadata?.checkout_email ||
    session.customer_details?.email ||
    session.customer_email ||
    '';
  const email = raw.trim().toLowerCase();
  return email || null;
}

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();

/**
 * Every account email. GoTrue's admin API has no email filter, so this reads
 * the list once per scan instead of once per candidate.
 */
async function accountEmails(admin: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    // Refuse to scan blind: without the account list, every buyer who came
    // back and paid another way would look abandoned.
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) if (u.email) emails.add(u.email.toLowerCase());
    if (data.users.length < perPage) return emails;
  }
  throw new Error('listUsers exceeded the page cap');
}

async function alreadyEmailed(admin: SupabaseClient, emails: string[]): Promise<Set<string>> {
  const hit = new Set<string>();
  // Chunked: a long .in() list becomes a long URL, and PostgREST answers an
  // over-long one with a 404 that reads like a missing table.
  for (let i = 0; i < emails.length; i += 50) {
    const { data, error } = await admin
      .from(CHECKOUT_REMINDER_TABLE)
      .select('email')
      .in('email', emails.slice(i, i + 50));
    if (error) throw new Error(`reminder lookup failed: ${error.message}`);
    for (const row of data ?? []) hit.add(row.email);
  }
  return hit;
}

/**
 * Addresses owed the email, for signed-out sessions that expired inside
 * [expiredFrom, expiredTo).
 */
export async function findReminderCandidates(
  stripe: Stripe,
  admin: SupabaseClient,
  window: { expiredFrom: Date; expiredTo: Date },
): Promise<ReminderScan> {
  const fromSec = Math.floor(window.expiredFrom.getTime() / 1000);
  const toSec = Math.floor(window.expiredTo.getTime() / 1000);

  // Every session, not only expired ones, from far enough back to include
  // anything that could have expired inside the window. A completed or open
  // session for the same address is what says "do not email".
  const bySession: Stripe.Checkout.Session[] = [];
  const createdFrom = Math.floor(
    (window.expiredFrom.getTime() - MAX_SESSION_LIFETIME_MS) / 1000,
  );
  for await (const session of stripe.checkout.sessions.list({
    limit: 100,
    created: { gte: createdFrom },
  })) {
    bySession.push(session);
  }

  const byEmail = new Map<string, Stripe.Checkout.Session[]>();
  for (const session of bySession) {
    const email = emailOf(session);
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(session);
    byEmail.set(email, list);
  }

  const owed: Array<{ email: string; sessions: Stripe.Checkout.Session[]; last: Stripe.Checkout.Session }> = [];
  for (const [email, sessions] of byEmail) {
    const expiredAnon = sessions.filter(
      (s) =>
        s.metadata?.anon_checkout === 'true' &&
        s.status === 'expired' &&
        s.expires_at >= fromSec &&
        s.expires_at < toSec,
    );
    if (expiredAnon.length === 0) continue;
    const last = expiredAnon.reduce((a, b) => (b.created > a.created ? b : a));
    owed.push({ email, sessions, last });
  }

  const scan: ReminderScan = { candidates: [], skipped: [] };
  if (owed.length === 0) return scan;

  const [accounts, emailed] = await Promise.all([
    accountEmails(admin),
    alreadyEmailed(admin, owed.map((o) => o.email)),
  ]);

  for (const { email, sessions, last } of owed) {
    const skip = (reason: SkipReason) =>
      scan.skipped.push({ email, reason, lastStartedAt: iso(last.created) });

    if (TEST_DOMAIN.test(email)) skip('test_address');
    else if (accounts.has(email)) skip('has_account');
    else if (sessions.some((s) => s.status === 'complete')) skip('completed');
    else if (sessions.some((s) => s.status === 'open')) skip('still_open');
    else if (emailed.has(email)) skip('already_emailed');
    else
      scan.candidates.push({
        email,
        sessionId: last.id,
        startedAt: iso(last.created),
        expiredAt: iso(last.expires_at),
        region: last.metadata?.region || null,
        from: last.metadata?.from || null,
        attempts: sessions.length,
        reachedPayment: Boolean(last.customer),
      });
  }

  scan.candidates.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return scan;
}

export type ReminderOutcome = 'sent' | 'already_sent' | 'send_failed';

/**
 * Send one. The claim is the insert: the address is the primary key, so a
 * second caller gets a unique violation and stops. A failed send deletes the
 * claim so the next run retries.
 */
export async function sendCheckoutReminder(
  admin: SupabaseClient,
  candidate: ReminderCandidate,
): Promise<ReminderOutcome> {
  // Asked now, by the same guard the resume link's checkout will ask, so the
  // email cannot promise a trial the checkout then withholds.
  const eligibility = await checkTrialEligibilityByEmail(admin, candidate.email);

  const { data, error } = await admin
    .from(CHECKOUT_REMINDER_TABLE)
    .insert({
      email: candidate.email,
      checkout_session_id: candidate.sessionId,
      region: candidate.region,
      from_surface: candidate.from,
      trial_offered: eligibility.eligible,
    })
    .select('token')
    .single();

  if (error) {
    if (error.code === '23505') return 'already_sent';
    console.error('[checkout reminder] claim failed', error);
    return 'send_failed';
  }

  const { subject, html } = checkoutReminderEmail({
    token: data.token,
    startedAt: candidate.startedAt,
    trialEligible: eligibility.eligible,
  });

  const result = await sendEmail({ to: candidate.email, subject, html, replyTo: SUPPORT_EMAIL });

  if (!result.success) {
    console.error('[checkout reminder] send failed', result.error);
    const { error: releaseError } = await admin
      .from(CHECKOUT_REMINDER_TABLE)
      .delete()
      .eq('email', candidate.email)
      .is('sent_at', null);
    if (releaseError) console.error('[checkout reminder] could not release claim', releaseError);
    return 'send_failed';
  }

  await admin
    .from(CHECKOUT_REMINDER_TABLE)
    .update({ sent_at: new Date().toISOString() })
    .eq('email', candidate.email);

  return 'sent';
}

/** The metadata key the resume link stamps on the session and subscription. */
export const REMINDER_TOKEN_METADATA = 'checkout_reminder_token';

/**
 * Credit the email with an account. Called by the webhook when it creates an
 * account from a subscription carrying the resume link's token. First credit
 * wins; a webhook redelivery changes nothing.
 */
export async function recordReminderSignup(
  admin: SupabaseClient,
  token: string,
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from(CHECKOUT_REMINDER_TABLE)
    .update({ signed_up_user_id: userId, signed_up_at: new Date().toISOString() })
    .eq('token', token)
    .is('signed_up_user_id', null);
  if (error) console.error('[checkout reminder] signup credit failed', error);
}
