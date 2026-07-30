/**
 * Identity for anonymous checkout — buy first, account after.
 *
 * The old flow made you sign up before you could pay, which is the biggest
 * drop-off in the funnel. Now /plans/checkout takes an email, Stripe takes the
 * card, and the webhook creates the account once Stripe confirms.
 *
 * Why an email up front rather than fully anonymous checkout: the trial abuse
 * guards in src/lib/trial.ts run BEFORE the session is created, so a repeat
 * customer is quietly charged normally with no error and no accusation. With
 * no email until Stripe collects it, those two layers would have to move
 * post-hoc — the trial starts, then we cancel it — turning a silent downgrade
 * into a "we cancelled your trial" email. One field keeps the guards intact.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Conservative shape check. Stripe validates properly at checkout. */
export function isPlausibleEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 6 || v.length > 254) return false;
  if (/\s/.test(v)) return false;
  const at = v.indexOf('@');
  if (at < 1 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

/**
 * Find an existing auth user by exact email.
 *
 * Note this is the LITERAL address, not the normalized one used by the trial
 * guards — two different questions. "Has this person had a trial" wants
 * casey+2@ folded into casey@; "does this login already exist" must not, or
 * we'd hand someone else's account to whoever guessed a tagged alias.
 */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();

  // listUsers is paginated; walk until found or exhausted. The user table is
  // small enough that this is fine, and it avoids depending on a filter API
  // that has changed shape across supabase-js versions.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Create the account for a completed checkout, or return the existing one.
 *
 * Idempotent on purpose: Stripe retries webhooks, and
 * `checkout.session.completed` and `customer.subscription.created` can arrive
 * together for the same purchase. Both call this; only one creates.
 *
 * The account is created with no password and `email_confirm: true` — paying
 * through Stripe proves the address well enough, and forcing a confirmation
 * click before they can use what they just bought is a bad first minute. They
 * set a password later, or keep using magic links.
 */
export async function ensureUserForCheckout(
  admin: SupabaseClient,
  email: string,
): Promise<{ userId: string; created: boolean }> {
  const existing = await findUserIdByEmail(admin, email);
  if (existing) return { userId: existing, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    email_confirm: true,
  });

  if (error || !data.user) {
    // Lost a race with a concurrent webhook delivery — re-read rather than
    // failing the purchase.
    const raced = await findUserIdByEmail(admin, email);
    if (raced) return { userId: raced, created: false };
    throw error ?? new Error('could not create user for checkout');
  }

  await admin.from('user_settings').upsert(
    { user_id: data.user.id, created_via_checkout: true },
    { onConflict: 'user_id' },
  );

  return { userId: data.user.id, created: true };
}
