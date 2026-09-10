/**
 * Who to send to, and what to call them.
 *
 * Three mailers had the same private emailForUser: welcome, the day-4 trial
 * reminder, and the lapse notice. Each looked the account up for its address
 * and threw away the user_metadata that came back with it, which is where a
 * Google profile name and the signup form's first name live. One lookup, both
 * answers.
 *
 * The cardholder name is passed IN rather than read here, because every caller
 * already has it for free: each of them claims its send with a conditional
 * UPDATE, and that statement returns the row it claimed, so bill_name rides
 * back on a query that was happening anyway. See src/lib/billing-profile.ts for
 * how that column is filled.
 *
 * SERVER-ONLY: takes a service-role client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { greetingFirstName } from '@/lib/display-name';

export interface Recipient {
  /** Null when the account has no address, which is not worth retrying. */
  email: string | null;
  /** Null when we hold no name. The greeting line is then left out entirely. */
  firstName: string | null;
}

/**
 * Never throws. A failed lookup is a Recipient with no address, and every
 * caller already treats that as "do not send", because there is nothing to
 * send to.
 */
export async function recipientFor(
  admin: SupabaseClient,
  userId: string,
  /** The mirrored cardholder name, when the caller's claim returned one. */
  cardholderName?: string | null,
): Promise<Recipient> {
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    console.error('[member greeting] could not read user', userId, error);
    return { email: null, firstName: null };
  }

  const user = data.user ?? null;
  return {
    email: user?.email ?? null,
    firstName: greetingFirstName(user, cardholderName),
  };
}
