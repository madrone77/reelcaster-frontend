/**
 * Everything we know about a person, for Meta, hashed. Server only: it reads
 * Stripe and user_settings.
 *
 * Two callers. `resolveMetaIdentity` feeds the Conversions API leg for the
 * day-7 purchase, which is a server-only event with no pixel to carry the
 * browser's identifiers and until 2026-09-08 went up with the click id alone.
 * `metaIdentityForUser` feeds the pay modal for a signed-in reader, so the
 * events it fires carry the same set.
 *
 * WHAT IS KNOWN BY WHEN. Email: at checkout (typed, or from Stripe). Name: on
 * the Stripe customer once the card is entered, so from the success page on.
 * Phone: on user_settings once an SMS alert number has been verified. Meta
 * matches each event on what arrives with THAT event, so the point of this
 * file is that the later events (purchase, anything a signed-in reader does)
 * get the fuller set; nothing here re-matches an event already sent.
 *
 * Best effort throughout. A Stripe or Supabase hiccup costs a field, never the
 * event, and nothing here throws.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { metaUserDataHashes, type MetaUserDataHashes } from './meta-match';

/**
 * Loaded on use, not at import. `./stripe` reaches `server-only` through
 * secrets.ts, and this module is imported by conversion-upload.ts, whose
 * tests run under plain tsx where that package does not resolve. Nothing here
 * needs Stripe until a row is actually being enriched.
 */
async function stripeClient() {
  const { getStripe } = await import('./stripe');
  return getStripe();
}

/** The `user_data` object the Conversions API takes, minus the click id. */
export interface MetaIdentity extends MetaUserDataHashes {
  external_id?: string;
  fbp?: string;
}

interface RowLike {
  user_id: string | null;
  stripe_subscription_id: string | null;
  fbp?: string | null;
}

/** The identity to send with a queued conversion row. */
export async function resolveMetaIdentity(admin: SupabaseClient, row: RowLike): Promise<MetaIdentity> {
  const [customer, phone] = await Promise.all([
    customerFromSubscription(row.stripe_subscription_id),
    verifiedPhone(admin, row.user_id),
  ]);
  const hashes = await metaUserDataHashes({
    email: customer.email,
    fullName: customer.name,
    phone,
  });
  const out: MetaIdentity = { ...hashes };
  if (row.user_id) out.external_id = row.user_id;
  if (row.fbp) out.fbp = row.fbp;
  return out;
}

/** The identity for a signed-in reader, from the account and its Stripe customer. */
export async function metaIdentityForUser(
  admin: SupabaseClient,
  input: { userId: string; email: string | null },
): Promise<MetaUserDataHashes> {
  let phone: string | null = null;
  let customerId: string | null = null;
  try {
    const { data } = await admin
      .from('user_settings')
      .select('phone_e164, phone_verified, stripe_customer_id')
      .eq('user_id', input.userId)
      .maybeSingle();
    if (data?.phone_verified && data.phone_e164) phone = data.phone_e164 as string;
    customerId = (data?.stripe_customer_id as string | null) ?? null;
  } catch {
    /* no settings row, or the read failed: identify with what the auth user holds */
  }
  const customer = customerId ? await customerById(customerId) : { email: null, name: null };
  return metaUserDataHashes({
    email: input.email ?? customer.email,
    fullName: customer.name,
    phone,
  });
}

async function verifiedPhone(admin: SupabaseClient, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await admin
      .from('user_settings')
      .select('phone_e164, phone_verified')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.phone_verified && data.phone_e164 ? (data.phone_e164 as string) : null;
  } catch {
    return null;
  }
}

async function customerFromSubscription(
  subscriptionId: string | null,
): Promise<{ email: string | null; name: string | null }> {
  if (!subscriptionId) return { email: null, name: null };
  try {
    const stripe = await stripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] });
    const customer = subscription.customer;
    if (!customer || typeof customer === 'string' || customer.deleted) return { email: null, name: null };
    return { email: customer.email ?? null, name: customer.name ?? null };
  } catch {
    return { email: null, name: null };
  }
}

async function customerById(customerId: string): Promise<{ email: string | null; name: string | null }> {
  try {
    const stripe = await stripeClient();
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return { email: null, name: null };
    return { email: customer.email ?? null, name: customer.name ?? null };
  } catch {
    return { email: null, name: null };
  }
}
