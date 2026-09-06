/**
 * Give a month, get a month: the service-role half.
 *
 * Three jobs, all called from routes that already hold the admin client:
 *
 *   1. ensureReferralCode: mint an account's share code on first ask.
 *   2. grantReferralAtSignup: the friend's month and the sponsor's month, run
 *      once from /api/attribution/signup when a new account first authenticates
 *      with an rc_ref cookie.
 *   3. referralSummary: what the account card shows.
 *
 * WHY THE GUARDS ARE THE APPROVAL. The /first offer is approved by hand
 * because a URL that grants Pro on its own is a paywall bypass. This link does
 * grant on its own, and what stands in for the admin is:
 *
 *   - the code must belong to an existing account, and not to the claimant;
 *   - the claimant's account must be brand new (the same 2-day age guard
 *     attribution uses), so a returning user signing in on a new laptop cannot
 *     claim, and neither can an old account someone forwards a link to;
 *   - one credit per friend, enforced by a unique index, not by code;
 *   - the friend's email, normalised the way the trial guard normalises it
 *     (+tags stripped, dots dropped at Gmail), must not be the sponsor's own;
 *   - twelve credits per sponsor per rolling year, after which a signup still
 *     gets its month but the sponsor's is recorded as 'capped'.
 *
 * What that leaves open is somebody with several real inboxes farming a year
 * of Pro, which costs a $33 plan at most. Acceptable.
 *
 * HOW THE SPONSOR IS PAID. Two shapes, chosen by whether Stripe knows them:
 *
 *   - No stripe_customer_id: 30 days are added to their comp. If a comp is
 *     already running the new end is 30 days past its end, so months stack. If
 *     they are on the free tier the comp starts now. This is the same write
 *     the bluecaster admin makes for an approved offer, and the nightly
 *     expire_lapsed_comps() sweep ends it.
 *   - A stripe_customer_id: a customer balance credit of one twelfth of what
 *     they pay, in their own currency. Stripe applies it to the next invoice
 *     automatically. This is the honest "month" on a plan that only bills by
 *     the year, and it survives a cancellation and a resubscribe. The rule
 *     from lib/reelcaster-supabase.ts in bluecaster holds here too: never
 *     write the billing columns of a row Stripe owns.
 */

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { sendEmail } from '@/lib/email-service';
import { referralCreditEmail, type ReferralPayout } from '@/lib/email-templates/referral';
import { emailIdentityHash } from '@/lib/trial';
import { trackServerEvent } from '@/lib/mixpanel-server';
import { dollars } from '@/lib/pricing';
import { siteUrl } from '@/lib/site';
import {
  REFERRAL_CAP_PER_YEAR,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_DAYS,
  referralPath,
} from '@/lib/referrals';

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

/** Mirrors the bluecaster admin's comp write, so both grants look the same. */
const COMP_TIER = 'pro_annual';
const COMP_STATUS = 'active';

function randomCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += REFERRAL_CODE_ALPHABET[bytes[i] % REFERRAL_CODE_ALPHABET.length];
  }
  return out;
}

/**
 * The account's share code, minting one if it has none.
 *
 * The unique partial index is the only arbiter of collisions. Two requests for
 * the same account racing each other both try to write, the `.is(null)` guard
 * lets exactly one through, and the loser re-reads. A code colliding with
 * another account's is a unique violation, and the loop tries a fresh one.
 */
export async function ensureReferralCode(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: existing, error: readError } = await admin
    .from('user_settings')
    .select('referral_code')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    console.error('[referrals] could not read referral code', userId, readError);
    return null;
  }
  if (existing?.referral_code) return existing.referral_code as string;

  // The row may not exist yet for an account created seconds ago.
  const { error: ensureError } = await admin
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ensureError) {
    console.error('[referrals] could not ensure user_settings row', userId, ensureError);
    return null;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data, error } = await admin
      .from('user_settings')
      .update({ referral_code: code })
      .eq('user_id', userId)
      .is('referral_code', null)
      .select('referral_code');

    if (error) {
      // 23505: the code is somebody else's. Try another.
      if ((error as { code?: string }).code === '23505') continue;
      console.error('[referrals] could not mint referral code', userId, error);
      return null;
    }
    if (data && data.length > 0) return data[0].referral_code as string;

    // Nothing matched: a parallel request minted first. Read what it wrote.
    const { data: won } = await admin
      .from('user_settings')
      .select('referral_code')
      .eq('user_id', userId)
      .maybeSingle();
    if (won?.referral_code) return won.referral_code as string;
  }

  console.error('[referrals] gave up minting a referral code', userId);
  return null;
}

export function referralUrlFor(code: string): string {
  return siteUrl(referralPath(code));
}

/** The sponsor behind a code, or null when the code is nobody's. */
export async function referrerForCode(
  admin: SupabaseClient,
  code: string,
): Promise<{ userId: string } | null> {
  const { data, error } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('referral_code', code)
    .maybeSingle();
  if (error) {
    console.error('[referrals] code lookup failed', code, error);
    return null;
  }
  return data ? { userId: data.user_id as string } : null;
}

/**
 * The first name to put on the /r page: "Casey gave you a month". Reads auth
 * metadata the same way the app's display-name module does, and falls back
 * to nothing rather than to an email address, which is never shown.
 */
export async function referrerFirstName(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const m = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of ['first_name', 'given_name', 'name', 'full_name']) {
    const raw = m[key];
    if (typeof raw === 'string') {
      const token = raw.trim().split(/\s+/)[0];
      if (token) return token;
    }
  }
  return null;
}

interface SettingsRow {
  user_id: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_amount_cents: number | null;
  subscription_currency: string | null;
  comp_expires_at: string | null;
  referred_at: string | null;
}

const SETTINGS_COLUMNS =
  'user_id, subscription_tier, subscription_status, subscription_period_end, stripe_customer_id, stripe_subscription_id, subscription_amount_cents, subscription_currency, comp_expires_at, referred_at';

async function readSettings(admin: SupabaseClient, userId: string): Promise<SettingsRow | null> {
  const { data, error } = await admin
    .from('user_settings')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[referrals] settings read failed', userId, error);
    return null;
  }
  return (data as SettingsRow | null) ?? null;
}

/**
 * Where a new comp window starts. A comp already running stacks on its own
 * end; anything else starts now. A paid subscription never reaches this
 * function (see grantReferralAtSignup), so subscription_period_end here is
 * the comp's own date and reading it is what makes an approved /first year
 * plus a referral month add up rather than overwrite.
 */
function compBase(row: SettingsRow | null, now: Date): Date {
  const candidates = [row?.comp_expires_at, row?.subscription_period_end]
    .filter((v): v is string => !!v)
    .map((v) => new Date(v).getTime())
    .filter((t) => Number.isFinite(t) && t > now.getTime());
  return candidates.length ? new Date(Math.max(...candidates)) : now;
}

async function extendComp(
  admin: SupabaseClient,
  userId: string,
  row: SettingsRow | null,
  reason: string,
  now: Date,
): Promise<string | null> {
  const until = new Date(compBase(row, now).getTime() + REFERRAL_DAYS * DAY_MS).toISOString();
  const { error } = await admin
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        subscription_tier: COMP_TIER,
        subscription_status: COMP_STATUS,
        subscription_period_end: until,
        comp_expires_at: until,
        comp_reason: reason,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) {
    console.error('[referrals] comp write failed', userId, error);
    return null;
  }
  return until;
}

/** Twelve months in the trailing year, counting only months that paid out. */
async function creditsThisYear(admin: SupabaseClient, referrerId: string, now: Date): Promise<number> {
  const { count, error } = await admin
    .from('referral_credits')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referrerId)
    .neq('applied_as', 'capped')
    .gte('created_at', new Date(now.getTime() - YEAR_MS).toISOString());
  if (error) {
    console.error('[referrals] cap count failed', referrerId, error);
    // Unknown is treated as full: a failed read must not hand out an
    // unbounded number of months.
    return REFERRAL_CAP_PER_YEAR;
  }
  return count ?? 0;
}

/**
 * One twelfth of what the sponsor pays, in the currency Stripe locked them
 * to. Falls back to the control price when the webhook has not stamped an
 * amount yet (a trial that has not converted), because that is what the
 * first invoice will be.
 */
function monthlyCredit(row: SettingsRow): { amountCents: number; currency: string } {
  const yearCents = row.subscription_amount_cents ?? 3300;
  const currency = (row.subscription_currency ?? 'cad').toLowerCase();
  return { amountCents: Math.round(yearCents / 12), currency };
}

export type ReferralGrantOutcome =
  | 'granted'
  | 'not_new_account'
  | 'unknown_code'
  | 'self_referral'
  | 'already_referred'
  | 'write_failed';

export interface ReferralGrantResult {
  outcome: ReferralGrantOutcome;
  /** True when the friend's own 30 days were switched on. */
  friendComped: boolean;
}

/**
 * The whole referral, run once for a brand new account. Idempotent by
 * construction: the friend's `referred_at` is write-once and the ledger is
 * unique on the friend, so a second call finds nothing to do.
 */
export async function grantReferralAtSignup(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string | null | undefined;
    code: string;
    isNewAccount: boolean;
  },
): Promise<ReferralGrantResult> {
  const now = new Date();
  const none: ReferralGrantResult = { outcome: 'not_new_account', friendComped: false };
  if (!params.isNewAccount) return none;

  const referrer = await referrerForCode(admin, params.code);
  if (!referrer) return { outcome: 'unknown_code', friendComped: false };
  if (referrer.userId === params.userId) return { outcome: 'self_referral', friendComped: false };

  // Same inbox behind both accounts, +tag or dots aside, is one person.
  if (params.email) {
    const { data: sponsor } = await admin.auth.admin.getUserById(referrer.userId);
    const sponsorEmail = sponsor?.user?.email;
    if (sponsorEmail && emailIdentityHash(sponsorEmail) === emailIdentityHash(params.email)) {
      return { outcome: 'self_referral', friendComped: false };
    }
  }

  // Claim the friend. Write-once on referred_at; losing this race means a
  // parallel call is already doing the rest.
  const { error: ensureError } = await admin
    .from('user_settings')
    .upsert({ user_id: params.userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ensureError) {
    console.error('[referrals] could not ensure friend row', params.userId, ensureError);
    return { outcome: 'write_failed', friendComped: false };
  }

  const { data: claimed, error: claimError } = await admin
    .from('user_settings')
    .update({ referred_by: referrer.userId, referred_at: now.toISOString() })
    .eq('user_id', params.userId)
    .is('referred_at', null)
    .select('user_id');
  if (claimError) {
    console.error('[referrals] friend claim failed', params.userId, claimError);
    return { outcome: 'write_failed', friendComped: false };
  }
  if (!claimed || claimed.length === 0) return { outcome: 'already_referred', friendComped: false };

  // The friend's month. Only an account nobody is billing gets it: a friend
  // who came in through buy-first checkout already has a trial and a card,
  // and the sponsor's side below still pays out for them.
  let friendComped = false;
  const friend = await readSettings(admin, params.userId);
  const friendBilled = !!friend?.stripe_customer_id || !!friend?.stripe_subscription_id;
  if (!friendBilled) {
    const until = await extendComp(
      admin,
      params.userId,
      friend,
      `Referred by ${referrer.userId} ${now.toISOString().slice(0, 10)}`,
      now,
    );
    friendComped = until !== null;
  }

  // The sponsor's month.
  const earned = await creditsThisYear(admin, referrer.userId, now);
  const sponsorRow = await readSettings(admin, referrer.userId);
  let payout: ReferralPayout;
  let ledger: {
    applied_as: 'comp_extension' | 'stripe_credit' | 'capped';
    applied_at: string | null;
    amount_cents: number | null;
    currency: string | null;
    stripe_balance_transaction_id: string | null;
  };

  if (earned >= REFERRAL_CAP_PER_YEAR) {
    payout = { kind: 'capped' };
    ledger = {
      applied_as: 'capped',
      applied_at: null,
      amount_cents: null,
      currency: null,
      stripe_balance_transaction_id: null,
    };
  } else if (sponsorRow?.stripe_customer_id) {
    const { amountCents, currency } = monthlyCredit(sponsorRow);
    let txId: string | null = null;
    try {
      const stripe = await getStripe();
      const tx = await stripe.customers.createBalanceTransaction(sponsorRow.stripe_customer_id, {
        // Negative is a credit in Stripe's ledger.
        amount: -amountCents,
        currency,
        description: `Referral: a month off your next year (${params.userId})`,
        metadata: { referred_user_id: params.userId, kind: 'referral' },
      });
      txId = tx.id;
    } catch (err) {
      // Recorded without a transaction id so the admin can see it did not
      // land. The friend's claim above already won, so this cannot be
      // retried by re-posting; it is a support fix, and it is visible.
      console.error('[referrals] stripe credit failed', referrer.userId, err);
    }
    payout = { kind: 'stripe_credit', amountLabel: dollars(amountCents) };
    ledger = {
      applied_as: 'stripe_credit',
      applied_at: txId ? now.toISOString() : null,
      amount_cents: amountCents,
      currency,
      stripe_balance_transaction_id: txId,
    };
  } else {
    const until = await extendComp(
      admin,
      referrer.userId,
      sponsorRow,
      `Referral month ${now.toISOString().slice(0, 10)}`,
      now,
    );
    payout = until
      ? { kind: 'comp_extension', proUntil: until }
      : { kind: 'capped' };
    ledger = {
      applied_as: 'comp_extension',
      applied_at: until ? now.toISOString() : null,
      amount_cents: null,
      currency: null,
      stripe_balance_transaction_id: null,
    };
  }

  const { data: row, error: ledgerError } = await admin
    .from('referral_credits')
    .insert({
      referrer_user_id: referrer.userId,
      referred_user_id: params.userId,
      ...ledger,
    })
    .select('id')
    .maybeSingle();
  if (ledgerError) {
    console.error('[referrals] ledger insert failed', referrer.userId, ledgerError);
  }

  if (row?.id) {
    await notifyReferrer(admin, { creditId: row.id as string, referrerId: referrer.userId, payout });
  }

  // The sponsor's side of the event, on the sponsor's own id. Awaited so the
  // route does not return before the request is on the wire; bounded inside.
  await trackServerEvent('Referral Month Earned', referrer.userId, {
    payout: ledger.applied_as,
    landed: ledger.applied_at !== null,
    amount_cents: ledger.amount_cents,
    currency: ledger.currency,
    friends_this_year: earned + 1,
    friend_comped: friendComped,
  });

  return { outcome: 'granted', friendComped };
}

/**
 * Tell the sponsor. Claimed on the ledger row, so a retried signup call cannot
 * send twice; released on a failed send so the next one can.
 */
async function notifyReferrer(
  admin: SupabaseClient,
  params: { creditId: string; referrerId: string; payout: ReferralPayout },
): Promise<void> {
  const { data: claimed } = await admin
    .from('referral_credits')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', params.creditId)
    .is('notified_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) return;

  const [{ data: who }, code] = await Promise.all([
    admin.auth.admin.getUserById(params.referrerId),
    ensureReferralCode(admin, params.referrerId),
  ]);
  const to = who?.user?.email;
  if (!to || !code) return;

  const { subject, html } = referralCreditEmail({
    payout: params.payout,
    referralUrl: referralUrlFor(code),
  });
  const result = await sendEmail({ to, subject, html });
  if (!result.success) {
    console.error('[referrals] notify send failed', params.referrerId, result.error);
    await admin.from('referral_credits').update({ notified_at: null }).eq('id', params.creditId);
  }
}

export interface ReferralSummary {
  code: string;
  url: string;
  /** Friends who joined through the link, all time. */
  friends: number;
  /** Months that paid out in the trailing year. */
  monthsThisYear: number;
  cap: number;
  days: number;
}

/** What the account card shows. Mints the code on first ask. */
export async function referralSummary(
  admin: SupabaseClient,
  userId: string,
): Promise<ReferralSummary | null> {
  const code = await ensureReferralCode(admin, userId);
  if (!code) return null;
  const now = new Date();
  const [{ count: friends }, monthsThisYear] = await Promise.all([
    admin
      .from('referral_credits')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', userId),
    creditsThisYear(admin, userId, now),
  ]);
  return {
    code,
    url: referralUrlFor(code),
    friends: friends ?? 0,
    monthsThisYear,
    cap: REFERRAL_CAP_PER_YEAR,
    days: REFERRAL_DAYS,
  };
}
