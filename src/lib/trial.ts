/**
 * 7-day Pro trial: eligibility and abuse guards.
 *
 * The trial is annual-only. Monthly stays instant-charge, so "start a trial"
 * and "buy the yearly plan" are the same decision for the customer.
 *
 * Three layers stop one person from farming free weeks:
 *
 *   1. has_used_trial on user_settings — same account re-subscribing.
 *   2. Normalized-email hash — casey+2@, c.a.sey@, googlemail aliases.
 *   3. Stripe card fingerprint — a fresh inbox paying with the same card.
 *
 * Layers 1 and 2 run before checkout, so a repeat customer simply doesn't get
 * offered a trial: they're charged normally, with no error and no accusation.
 * Layer 3 can only run after checkout (the card doesn't exist until then), so
 * it's enforced in the webhook — see recordTrialCardFingerprint.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const TRIAL_DAYS = 7;

/** Domains where dots in the local part are not significant. */
const DOT_INSENSITIVE_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
]);

/**
 * Reduce an email to the identity behind it.
 *
 *   Casey+fish2@Gmail.com  ->  casey@gmail.com
 *   c.a.s.e.y@gmail.com    ->  casey@gmail.com
 *   casey+x@hey.com        ->  casey@hey.com   (dots kept: hey.com treats
 *                                               them as significant)
 *
 * Deliberately conservative — dot-stripping only applies to domains that
 * genuinely ignore dots, because collapsing them everywhere would merge
 * distinct people at providers where first.last@ is the naming convention.
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  // Strip +tag.
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);

  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
}

/**
 * Hash rather than store the address: this table exists to answer "have we
 * seen this person before", which doesn't require holding another copy of
 * everyone's email.
 */
export function emailIdentityHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

export interface TrialEligibility {
  eligible: boolean;
  /** Why not — for logging and analytics, never shown to the customer. */
  reason?: 'account_used_trial' | 'identity_used_trial' | 'lookup_failed';
}

/**
 * Pre-checkout check. Runs layers 1 and 2.
 *
 * A false here is not an error state — the customer just goes through normal
 * paid checkout. Never surface the reason to them.
 */
export async function checkTrialEligibility(
  admin: SupabaseClient,
  /**
   * Null for an anonymous checkout — the account doesn't exist yet, so the
   * per-account layer has nothing to check and the email-hash layer carries
   * the weight. That's not a hole: a returning customer's normalized email is
   * already in trial_grants from their first trial.
   */
  userId: string | null,
  email: string | null | undefined,
): Promise<TrialEligibility> {
  // Fail CLOSED on lookup errors. An abuse guard that hands out a free week
  // whenever its own query breaks is worse than no guard — a missing migration
  // or a bad service key would silently open the gate for everyone. Withholding
  // a trial costs one customer a discount; failing open costs the trial.
  if (userId) {
    const { data: settings, error: settingsError } = await admin
      .from('user_settings')
      .select('has_used_trial')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      console.error('[trial] eligibility lookup failed (user_settings)', settingsError);
      return { eligible: false, reason: 'lookup_failed' };
    }

    if (settings?.has_used_trial) {
      return { eligible: false, reason: 'account_used_trial' };
    }
  }

  if (email) {
    const { data: priorGrant, error: grantError } = await admin
      .from('trial_grants')
      .select('id')
      .eq('email_hash', emailIdentityHash(email))
      .eq('outcome', 'granted')
      .maybeSingle();

    if (grantError) {
      console.error('[trial] eligibility lookup failed (trial_grants)', grantError);
      return { eligible: false, reason: 'lookup_failed' };
    }

    if (priorGrant) {
      return { eligible: false, reason: 'identity_used_trial' };
    }
  }

  return { eligible: true };
}

/**
 * Record that a trial was handed out. Called from the webhook the moment a
 * subscription shows up as `trialing`.
 *
 * Idempotent on stripe_subscription_id: Stripe redelivers webhooks, and
 * subscription.created / checkout.session.completed both land here.
 */
export async function recordTrialGrant(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string | null | undefined;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    trialEndsAt: string | null;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from('trial_grants')
    .select('id')
    .eq('stripe_subscription_id', params.stripeSubscriptionId)
    .maybeSingle();

  if (existing) return;

  if (params.email) {
    await admin.from('trial_grants').insert({
      user_id: params.userId,
      email_hash: emailIdentityHash(params.email),
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      outcome: 'granted',
    });
  }

  await admin
    .from('user_settings')
    .update({
      has_used_trial: true,
      trial_started_at: new Date().toISOString(),
      trial_ends_at: params.trialEndsAt,
    })
    .eq('user_id', params.userId);
}

export interface CardCheckResult {
  /** True when this card already consumed a trial under a different grant. */
  duplicate: boolean;
}

/**
 * Layer 3. Attach the card fingerprint to this trial's grant row, unless the
 * card has already trialed — in which case the caller cancels the
 * subscription rather than charging a card the customer didn't expect to be
 * charged today.
 *
 * A shared card (one household, two accounts) trips this too, which is
 * exactly why the outcome is a refusal to trial and not a surprise charge.
 */
export async function recordTrialCardFingerprint(
  admin: SupabaseClient,
  stripeSubscriptionId: string,
  fingerprint: string,
): Promise<CardCheckResult> {
  const { data: priorCardUse } = await admin
    .from('trial_grants')
    .select('id, stripe_subscription_id')
    .eq('card_fingerprint', fingerprint)
    .eq('outcome', 'granted')
    .maybeSingle();

  if (priorCardUse && priorCardUse.stripe_subscription_id !== stripeSubscriptionId) {
    await admin
      .from('trial_grants')
      .update({ card_fingerprint: fingerprint, outcome: 'revoked_duplicate' })
      .eq('stripe_subscription_id', stripeSubscriptionId);
    return { duplicate: true };
  }

  await admin
    .from('trial_grants')
    .update({ card_fingerprint: fingerprint })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  return { duplicate: false };
}
