/**
 * One place that answers "is this user entitled to Pro right now?".
 *
 * Six API routes used to hand-roll this check, and they had already drifted
 * apart (some matched `tier.startsWith('pro')`, others compared the two tier
 * strings explicitly). That drift is how `map/forecast-14d` ended up leaking
 * all 14 days before 2026-07-22. Everything goes through here now.
 *
 * Entitlement is NOT just `subscription_tier`. A user is entitled when:
 *   - the subscription is active, or
 *   - the subscription is trialing (the 7-day annual trial), or
 *   - payment has failed but we're still inside the 7-day grace window.
 *
 * The grace check is evaluated at read time against `grace_until`, so an
 * expired grace period lapses on its own — no cron, no sweeper job.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Entitlement {
  /** The only field most callers need. */
  isPro: boolean;
  tier: string;
  status: string;
  /** True when isPro is being carried by the grace window rather than payment. */
  inGrace: boolean;
  /** True during the 7-day trial. */
  isTrialing: boolean;
  graceUntil: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
}

export const FREE_ENTITLEMENT: Entitlement = {
  isPro: false,
  tier: 'free',
  status: 'none',
  inGrace: false,
  isTrialing: false,
  graceUntil: null,
  trialEndsAt: null,
  periodEnd: null,
};

/** Payment problems, as opposed to a real cancellation. Grace applies to these. */
const PAYMENT_PROBLEM_STATUSES = new Set(['past_due', 'unpaid']);

interface SettingsRow {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  subscription_period_end?: string | null;
  grace_until?: string | null;
  trial_ends_at?: string | null;
}

/**
 * Resolve entitlement from an already-fetched user_settings row. Split out so
 * routes that already read the row (e.g. to check a phone number in the same
 * query) don't have to hit the DB twice.
 */
export function entitlementFromSettings(
  settings: SettingsRow | null | undefined,
  now: Date = new Date(),
): Entitlement {
  if (!settings) return FREE_ENTITLEMENT;

  const tier = settings.subscription_tier ?? 'free';
  const status = settings.subscription_status ?? 'none';
  const graceUntil = settings.grace_until ?? null;

  const hasProTier = tier === 'pro_annual' || tier === 'pro_monthly';
  const isTrialing = status === 'trialing';

  const inGrace =
    hasProTier &&
    PAYMENT_PROBLEM_STATUSES.has(status) &&
    graceUntil !== null &&
    new Date(graceUntil).getTime() > now.getTime();

  const isPro = hasProTier && (status === 'active' || isTrialing || inGrace);

  return {
    isPro,
    tier,
    status,
    inGrace,
    isTrialing,
    graceUntil,
    trialEndsAt: settings.trial_ends_at ?? null,
    periodEnd: settings.subscription_period_end ?? null,
  };
}

/** The columns entitlementFromSettings needs. Use this in .select() calls. */
export const ENTITLEMENT_COLUMNS =
  'subscription_tier, subscription_status, subscription_period_end, grace_until, trial_ends_at';

/**
 * Fetch and resolve in one call. Most routes want this.
 *
 * Note the webhook keeps `subscription_tier` at the paid value while a payment
 * is failing, so a lapsed grace window is caught here rather than in the DB.
 */
export async function resolveEntitlement(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<Entitlement> {
  if (!userId) return FREE_ENTITLEMENT;

  const { data } = await admin
    .from('user_settings')
    .select(ENTITLEMENT_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  return entitlementFromSettings(data as SettingsRow | null);
}
