/**
 * What Stripe knows about a member, mirrored into columns that can be queried.
 *
 * THE PROBLEM THIS SOLVES. Almost nobody fills in a profile. Of 68 accounts, 31
 * have named a region and 23 finished onboarding. Stripe, meanwhile, was handed
 * a real name by 35 of 52 customers, a country by 37, a postal code by 32, and
 * a reason for leaving by 6 of the 7 who cancelled -- all of it sitting in an
 * API nobody could group by. This writes it into `user_settings.bill_*` on
 * every subscription event, so a market report is a SELECT rather than 52 HTTP
 * calls.
 *
 * A MIRROR, NOT A PROFILE. Every field here describes the CARD. The cardholder
 * can be a spouse, the billing address can be an office, and the issuing
 * country can be where somebody banks rather than where they fish. So none of
 * it merges into the fields the member owns: `phone_e164` stays the number
 * Twilio verified, the home city stays what they chose, and BlueCaster's admin
 * keeps labelling these values with their source.
 *
 * NEVER WRITES A NULL OVER A VALUE. A field Stripe does not return this minute
 * means "not readable", not "the person moved to nowhere" -- an expand that
 * silently failed, a customer object that came back deleted. Absent fields are
 * dropped from the patch instead of blanking a column that a previous sync,
 * or the backfill, filled correctly.
 *
 * SERVER-ONLY: service-role and Stripe keys.
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePaymentMethod } from '@/lib/payment-method';

/**
 * The mirrored columns. Every one optional: the patch carries only what this
 * sync could actually read.
 */
export interface BillingProfilePatch {
  bill_name?: string;
  bill_city?: string;
  bill_region?: string;
  bill_postal?: string;
  bill_country?: string;
  bill_locale?: string;
  bill_card_brand?: string;
  bill_card_funding?: string;
  bill_card_country?: string;
  bill_lifetime_cents?: number;
  bill_lifetime_currency?: string;
  bill_paid_invoices?: number;
  bill_first_paid_at?: string;
  bill_balance_cents?: number;
  bill_cancel_reason?: string;
  bill_cancel_feedback?: string;
  bill_cancel_comment?: string;
  bill_synced_at: string;
}

export interface BillingProfileInput {
  customer: Stripe.Customer | null;
  /** The card the subscription bills against, when one is readable. */
  card: Stripe.PaymentMethod | null;
  subscription: Stripe.Subscription | null;
  /**
   * Paid invoices for this customer, or null when the list call failed.
   *
   * The distinction matters: an empty array is "has never paid", which is a
   * true and useful zero, while null is "we could not ask", which must not be
   * written as a zero over somebody's real lifetime value.
   */
  paidInvoices: Stripe.Invoice[] | null;
}

/** Trimmed, or undefined when there is nothing worth storing. */
function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Build the patch. Pure, so the mapping can be tested against the awkward
 * shapes Stripe really returns without a network or a database.
 */
export function billingProfileFrom(
  input: BillingProfileInput,
  syncedAt: string,
): BillingProfilePatch {
  const { customer, card, subscription, paidInvoices } = input;
  const patch: BillingProfilePatch = { bill_synced_at: syncedAt };

  const address = customer?.address;
  assign(patch, 'bill_name', text(customer?.name));
  assign(patch, 'bill_city', text(address?.city));
  assign(patch, 'bill_region', text(address?.state));
  assign(patch, 'bill_postal', text(address?.postal_code));
  // Upper-cased because it is compared against, counted by, and joined on:
  // Stripe returns ISO-3166 alpha-2 already upper, but a hand-set customer can
  // carry "us" and two spellings of one market is a broken report.
  assign(patch, 'bill_country', text(address?.country)?.toUpperCase());
  // The language their browser asked Stripe for. First entry only -- it is the
  // one Stripe itself uses to pick the receipt language.
  assign(patch, 'bill_locale', text(customer?.preferred_locales?.[0]));

  // A wallet purchase is still a card to Stripe (`type: 'card'` with
  // `card.wallet` set), and these three describe the underlying card either
  // way. Non-card methods leave the block empty rather than inventing a brand;
  // how somebody paid is already answered by the pay_method stamp.
  assign(patch, 'bill_card_brand', text(card?.card?.brand));
  assign(patch, 'bill_card_funding', text(card?.card?.funding));
  assign(patch, 'bill_card_country', text(card?.card?.country)?.toUpperCase());

  // Balance is a real number that is legitimately 0, so it is written whenever
  // the customer was readable at all. Negative means Stripe is holding a
  // credit -- which is how a referral payout can land (see referral_credits).
  if (typeof customer?.balance === 'number') {
    patch.bill_balance_cents = customer.balance;
  }

  if (paidInvoices) {
    // Summed from invoices, not inferred from the tier. A comped year bills
    // nothing and a split-test arm bills a different amount, so any figure
    // derived from `subscription_tier` would be fiction for both.
    let cents = 0;
    let firstPaidAt: number | null = null;
    for (const invoice of paidInvoices) {
      cents += invoice.amount_paid ?? 0;
      const at = invoice.status_transitions?.paid_at ?? invoice.created ?? null;
      if (at != null && (firstPaidAt == null || at < firstPaidAt)) firstPaidAt = at;
    }
    patch.bill_lifetime_cents = cents;
    patch.bill_paid_invoices = paidInvoices.length;
    if (firstPaidAt != null) {
      patch.bill_first_paid_at = new Date(firstPaidAt * 1000).toISOString();
    }
    // Stripe locks a customer to the currency of their first invoice forever
    // (the express-checkout route depends on this too), so one currency per
    // customer is safe to state. The customer's own field is preferred over an
    // invoice's because it is the lock itself.
    const currency =
      text(customer?.currency) ?? text(paidInvoices[0]?.currency);
    assign(patch, 'bill_lifetime_currency', currency?.toLowerCase());
  }

  // Why they left, and never cleared afterwards. `reason` is Stripe's own
  // involuntary/voluntary split (payment_failed against
  // cancellation_requested); feedback and comment are what the member chose and
  // typed in the portal. A member who resubscribes keeps the reason from last
  // time, because "they left over price and came back" is worth more than a
  // blank field, and the admin shows it beside the live status.
  const cancel = subscription?.cancellation_details;
  assign(patch, 'bill_cancel_reason', text(cancel?.reason));
  assign(patch, 'bill_cancel_feedback', text(cancel?.feedback));
  assign(patch, 'bill_cancel_comment', text(cancel?.comment));

  return patch;
}

function assign<K extends keyof BillingProfilePatch>(
  patch: BillingProfilePatch,
  key: K,
  value: BillingProfilePatch[K] | undefined,
) {
  if (value !== undefined) patch[key] = value;
}

/** How many invoices to sum. A yearly plan would need a century to exceed it. */
const INVOICE_LIMIT = 100;

/**
 * Everything the mirror needs, fetched independently so one dead call costs one
 * field rather than the whole sync.
 */
export async function readBillingProfile(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<BillingProfileInput> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer?.id ?? null);

  const [customer, card, paidInvoices] = await Promise.all([
    customerId
      ? stripe.customers
          .retrieve(customerId)
          .then((c) => (c.deleted ? null : (c as Stripe.Customer)))
          .catch((err) => {
            console.warn('[billing-profile] customer unreadable', customerId, err);
            return null;
          })
      : Promise.resolve(null),
    resolvePaymentMethod(stripe, subscription),
    customerId
      ? stripe.invoices
          .list({ customer: customerId, status: 'paid', limit: INVOICE_LIMIT })
          .then((page) => page.data)
          .catch((err) => {
            console.warn('[billing-profile] invoices unreadable', customerId, err);
            return null;
          })
      : Promise.resolve(null),
  ]);

  return { customer, card, subscription, paidInvoices };
}

/**
 * Mirror Stripe onto one member's row.
 *
 * Entirely best-effort, and deliberately called AFTER the entitlement upsert it
 * follows. Everything in this file is reporting: a throw here would have Stripe
 * retry an event whose subscription write already succeeded, which is how a
 * marketing column costs somebody their Pro access.
 */
export async function syncBillingProfile(
  stripe: Stripe,
  admin: SupabaseClient,
  args: { subscription: Stripe.Subscription; userId: string },
): Promise<void> {
  try {
    const input = await readBillingProfile(stripe, args.subscription);
    const patch = billingProfileFrom(input, new Date().toISOString());

    // Nothing but the timestamp came back. Stamping a sync that read nothing
    // would make "last synced" a lie about coverage.
    if (Object.keys(patch).length === 1) return;

    const { error } = await admin
      .from('user_settings')
      .update(patch)
      .eq('user_id', args.userId);

    if (error) console.warn('[billing-profile] write failed', error);
  } catch (err) {
    console.warn('[billing-profile] sync failed', args.userId, err);
  }
}
