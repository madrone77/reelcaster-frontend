/**
 * What a customer's alerts may do given what their account is right now.
 *
 * The engine used to read user_alert_profiles alone. An alert created during
 * the Pro trial kept firing after the trial was cancelled, and an SMS alert
 * kept texting, because the only tier check was the cap at creation time and
 * nothing on cancellation touched the alerts. Stripe was right, the mirror was
 * right, and the sender never asked either of them.
 *
 * The rule applied here is the tier matrix, nothing more: a free account gets
 * one email alert, a Pro account gets up to ten with SMS. Rows are never
 * deactivated. A customer who comes back to Pro finds every alert exactly as
 * they left it, so there is nothing to restore and nothing to get wrong.
 *
 * Pure so it can be tested without Supabase.
 */

import type { AlertProfile } from '@/lib/custom-alert-engine';

/** Why an alert was held back this run. Shows up in the run summary. */
export const NOT_PRO_EXTRA_ALERT =
  'Paused: account is not Pro, and a free account keeps only its oldest email alert';

export interface TierGateOutcome {
  /** Profiles the engine may evaluate, with channels the account is allowed. */
  allowed: AlertProfile[];
  /** Profiles held back, each with the reason to log. */
  held: Array<{ profile: AlertProfile; reason: string }>;
}

/**
 * Keep every alert for a Pro owner. For anyone else keep only their oldest
 * alert, and only by email: SMS is Pro, and an alert that asked for texts alone
 * falls back to email rather than going silent. Oldest wins because it is the
 * one the customer set up as a free account would have, before the trial
 * opened the other nine slots.
 */
export function applyTierToProfiles(
  profiles: AlertProfile[],
  isProByUser: Map<string, boolean>,
): TierGateOutcome {
  const allowed: AlertProfile[] = [];
  const held: TierGateOutcome['held'] = [];

  const byUser = new Map<string, AlertProfile[]>();
  for (const p of profiles) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
    byUser.get(p.user_id)!.push(p);
  }

  for (const [userId, userProfiles] of byUser) {
    if (isProByUser.get(userId) === true) {
      allowed.push(...userProfiles);
      continue;
    }

    const [oldest, ...rest] = [...userProfiles].sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1,
    );

    allowed.push({ ...oldest, delivery_channels: ['email'] });
    for (const p of rest) held.push({ profile: p, reason: NOT_PRO_EXTRA_ALERT });
  }

  return { allowed, held };
}
