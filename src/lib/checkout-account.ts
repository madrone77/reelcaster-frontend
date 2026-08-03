/**
 * Accounts created BY a purchase, rather than before one.
 *
 * The paywall lets a signed-out angler pay without signing up first: Stripe
 * Checkout collects the email and the card, and the account is provisioned
 * from `customer_details.email` when the webhook lands. Nobody fills a signup
 * form, and nobody is asked to make an account before they have decided to buy.
 *
 * Two rules hold this together and neither is optional:
 *
 *   1. NEVER create a second account for an email that already has one. The
 *      purchase attaches to the existing user.
 *   2. NEVER hand a session to whoever completed the checkout when the email
 *      already had an account. Paying is not proof of owning the inbox; that
 *      path emails a sign-in link instead. See the claim route.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Locate a user by email address.
 *
 * GoTrue's admin API has no email filter, so this pages through users. That is
 * fine at this product's size and it only runs on the uncommon path (a
 * purchase whose email already has an account); the common path creates the
 * user directly and never scans. Revisit if the user table gets large.
 */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('[checkout-account] listUsers failed', error);
      return null;
    }
    const users: User[] = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < perPage) return null;
  }

  console.error('[checkout-account] listUsers exhausted the page cap');
  return null;
}

export interface ProvisionedAccount {
  userId: string;
  /** True only when this purchase is what brought the account into existence. */
  created: boolean;
}

/**
 * Find the account for a paying email, or create one.
 *
 * Created accounts have no password — they sign in by magic link or Google
 * until they set one. `email_confirm: true` because the address just completed
 * a card payment, which is stronger evidence than a confirmation click.
 *
 * Idempotent: Stripe redelivers webhooks, and a create that loses the race
 * falls through to the lookup rather than erroring.
 */
export async function findOrCreateUserForCheckout(
  admin: SupabaseClient,
  email: string,
): Promise<ProvisionedAccount | null> {
  const address = email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    email_confirm: true,
    user_metadata: { created_via: 'stripe_checkout' },
  });

  if (!error && data?.user) {
    return { userId: data.user.id, created: true };
  }

  // Already registered (or a concurrent create won) — attach to that account.
  const existingId = await findUserIdByEmail(admin, address);
  if (existingId) return { userId: existingId, created: false };

  console.error('[checkout-account] could not find or create user', error);
  return null;
}
