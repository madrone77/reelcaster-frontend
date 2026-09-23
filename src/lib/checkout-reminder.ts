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
 * WHEN. Two triggers, one email per address either way (the claim):
 *
 *   - 'cancel': they tapped Stripe's Back arrow. The cancel URL carries a
 *     token that is also on the session's metadata; /billing/cancel posts it
 *     to /api/stripe/checkout/abandoned, which sends straight away. See
 *     findCancelledCandidate.
 *   - 'expiry': they closed the tab. Signed-out sessions expire after 3 hours
 *     (src/lib/anon-checkout.ts) and GET /api/cron/checkout-reminders runs
 *     every 15 minutes, so the email lands 3 to 3.25 hours after checkout
 *     opened.
 *
 * WHICH EMAIL. Split test abandon_email_v1, arm picked at send time: a is
 * "You're almost done" (back into checkout), b is "your free account is
 * ready" (a sign-in link that makes a free account, Pro link underneath). See
 * chooseReminderArm.
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
import {
  checkoutReminderEmail,
  freeAccountReminderEmail,
} from '@/lib/email-templates/checkout-reminder';
import { checkTrialEligibilityByEmail } from '@/lib/trial';
import { SUPPORT_EMAIL } from '@/lib/site';
import { findUserIdByEmail } from '@/lib/checkout-account';
import { ANON_CHECKOUT_TTL_SECONDS, CANCEL_TOKEN_METADATA } from '@/lib/anon-checkout';
import { loadSplitTests } from '@/lib/split-tests-server';
import { pickWeighted, type SplitArms } from '@/lib/split-tests';
import { pacificDay } from '@/lib/pacific-day';

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

// ── Which email (split test abandon_email_v1) ────────────────────────────

export const ABANDON_EMAIL_TEST = 'abandon_email_v1';

/** The split-test surface both the exposure and the link clicks count under. */
export const ABANDON_EMAIL_SURFACE = 'abandon_email';

export type ReminderTrigger = 'cancel' | 'expiry';

export interface ReminderArm {
  variant: string;
  /** Arm b: the free-account email. */
  freeAccount: boolean;
  /** False when the test is not running: everybody gets a, nobody is counted. */
  counted: boolean;
}

/**
 * The arm for one email. The browser's arm when it already holds one (the
 * cancel trigger has the request's cookie), otherwise a fresh pick by weight.
 * Anything short of a running test sends the control uncounted.
 */
export async function chooseReminderArm(cookieArms: SplitArms = {}): Promise<ReminderArm> {
  const tests = await loadSplitTests();
  const test = tests.find((t) => t.key === ABANDON_EMAIL_TEST);
  if (!test || test.status !== 'running') {
    return { variant: 'a', freeAccount: false, counted: false };
  }
  const held = test.variants.find((v) => v.variant === cookieArms[ABANDON_EMAIL_TEST]);
  const arm = held ?? pickWeighted(test.variants);
  return { variant: arm.variant, freeAccount: arm.config.free_account === true, counted: true };
}

/**
 * One exposure (the email sent) or one cta_click (a link in it opened), keyed
 * by the reminder token so the report's per-session denominator is per email.
 * Never throws: a lost count must not stop an email or a sign-in.
 */
export async function countReminderEvent(
  admin: SupabaseClient,
  row: { token: string; variant: string | null },
  kind: 'exposure' | 'cta_click',
): Promise<void> {
  if (!row.variant) return;
  const base = {
    p_day: pacificDay(),
    p_test_key: ABANDON_EMAIL_TEST,
    p_variant: row.variant,
    p_surface: ABANDON_EMAIL_SURFACE,
    p_currency: '',
    p_device: '',
    p_kind: kind,
  };
  const [counter, session] = await Promise.all([
    admin.rpc('bump_split_test_counter', { ...base, p_geo_country: '', p_geo_region: '' }),
    admin.rpc('bump_split_test_session', { ...base, p_session_id: row.token }),
  ]);
  if (counter.error || session.error) {
    console.error('[checkout reminder] split count failed', counter.error ?? session.error);
  }
}

// ── The cancel trigger ───────────────────────────────────────────────────

export const CANCEL_TOKEN_RE = /^[0-9a-f]{32}$/;

/**
 * The address to email right now, for somebody who just tapped Back on
 * Stripe's page. The token came from the cancel URL; the session carrying it
 * is found among the signed-out sessions opened inside the TTL (Stripe cannot
 * filter by metadata, and a few hours of sessions is one or two pages).
 *
 * Same skip rules as the cron, except that this session is still open by
 * definition. It is expired here, so the address reads as abandoned
 * everywhere and the cron's scan agrees. Null means send nothing.
 */
export async function findCancelledCandidate(
  stripe: Stripe,
  admin: SupabaseClient,
  cancelToken: string,
): Promise<ReminderCandidate | null> {
  const createdFrom = Math.floor(Date.now() / 1000) - ANON_CHECKOUT_TTL_SECONDS - 300;
  const recent: Stripe.Checkout.Session[] = [];
  let session: Stripe.Checkout.Session | null = null;
  for await (const s of stripe.checkout.sessions.list({ limit: 100, created: { gte: createdFrom } })) {
    recent.push(s);
    if (s.metadata?.[CANCEL_TOKEN_METADATA] === cancelToken) session = s;
  }
  if (!session || session.metadata?.anon_checkout !== 'true') return null;
  if (session.status === 'complete') return null;

  const email = emailOf(session);
  if (!email || TEST_DOMAIN.test(email)) return null;

  const mine = recent.filter((s) => emailOf(s) === email);
  if (mine.some((s) => s.status === 'complete')) return null;
  // Another checkout for the same address opened after this one: they went
  // straight back in (Try again), so this one is not the last word.
  if (mine.some((s) => s.id !== session!.id && s.status === 'open' && s.created > session!.created)) {
    return null;
  }
  if (await findUserIdByEmail(admin, email)) return null;

  if (session.status === 'open') {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch (err) {
      // Already expired or completed a moment ago. The completed case is
      // caught by the account check on the next scan; send nothing now.
      console.warn('[checkout reminder] could not expire cancelled session', err);
      return null;
    }
  }

  return {
    email,
    sessionId: session.id,
    startedAt: iso(session.created),
    expiredAt: new Date().toISOString(),
    region: session.metadata?.region || null,
    from: session.metadata?.from || null,
    attempts: mine.length,
    reachedPayment: Boolean(session.customer),
  };
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
  options: { trigger: ReminderTrigger; cookieArms?: SplitArms },
): Promise<ReminderOutcome> {
  const arm = await chooseReminderArm(options.cookieArms);

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
      trigger: options.trigger,
      // Only a counted arm is recorded, so a row with a variant is a row in
      // the test and the links know whether to count their clicks.
      variant: arm.counted ? arm.variant : null,
    })
    .select('token')
    .single();

  if (error) {
    if (error.code === '23505') return 'already_sent';
    console.error('[checkout reminder] claim failed', error);
    return 'send_failed';
  }

  const { subject, html } = (arm.freeAccount ? freeAccountReminderEmail : checkoutReminderEmail)({
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

  if (arm.counted) await countReminderEvent(admin, { token: data.token, variant: arm.variant }, 'exposure');

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
