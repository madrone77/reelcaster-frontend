/**
 * Run with: npx tsx src/lib/billing-profile.test.ts
 *
 * The mapping's whole job is to tell three states apart: a value Stripe gave
 * us, a real zero, and a field Stripe could not answer for. Getting the third
 * one wrong is the failure that matters -- it writes null over a lifetime value
 * or a postal code that a previous sync had right, and nothing downstream can
 * tell that it happened. So most of these cases are about absence.
 */

import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { billingProfileFrom, type BillingProfileInput } from './billing-profile';

const NOW = '2026-09-10T12:00:00.000Z';

function input(over: Partial<BillingProfileInput> = {}): BillingProfileInput {
  return {
    customer: null,
    card: null,
    subscription: null,
    paidInvoices: null,
    ...over,
  };
}

function customer(over: Record<string, unknown> = {}): Stripe.Customer {
  return {
    id: 'cus_1',
    name: 'Christopher Manning',
    balance: 0,
    currency: 'usd',
    preferred_locales: ['en-US'],
    address: {
      city: 'Snohomish',
      state: 'WA',
      postal_code: '98296',
      country: 'US',
      line1: '12821 58th Dr SE',
      line2: null,
    },
    ...over,
  } as unknown as Stripe.Customer;
}

function card(over: Record<string, unknown> = {}): Stripe.PaymentMethod {
  return {
    id: 'pm_1',
    type: 'card',
    card: { brand: 'visa', funding: 'credit', country: 'US', last4: '4242' },
    ...over,
  } as unknown as Stripe.PaymentMethod;
}

function invoice(
  amountPaid: number,
  paidAt: number,
  currency = 'usd',
): Stripe.Invoice {
  return {
    amount_paid: amountPaid,
    currency,
    created: paidAt,
    status_transitions: { paid_at: paidAt },
  } as unknown as Stripe.Invoice;
}

// ── The everyday case ──────────────────────────────────────────────
{
  const patch = billingProfileFrom(
    input({ customer: customer(), card: card() }),
    NOW,
  );
  assert.equal(patch.bill_name, 'Christopher Manning');
  assert.equal(patch.bill_city, 'Snohomish');
  assert.equal(patch.bill_region, 'WA');
  assert.equal(patch.bill_postal, '98296');
  assert.equal(patch.bill_country, 'US');
  assert.equal(patch.bill_locale, 'en-US');
  assert.equal(patch.bill_card_brand, 'visa');
  assert.equal(patch.bill_card_funding, 'credit');
  assert.equal(patch.bill_card_country, 'US');
  assert.equal(patch.bill_balance_cents, 0);
  assert.equal(patch.bill_synced_at, NOW);
}

// ── A postal-code-only customer, which is what hosted Checkout leaves ──
//
// 20 of 52 live customers have a street address; 32 have a postal code. The
// thin ones must contribute their postal code and country and stay silent
// about the rest, rather than blanking a city an earlier sync had.
{
  const patch = billingProfileFrom(
    input({
      customer: customer({
        name: null,
        address: {
          city: null,
          state: null,
          postal_code: '98116',
          country: 'us',
          line1: null,
          line2: null,
        },
      }),
    }),
    NOW,
  );
  assert.ok(!('bill_name' in patch), 'no name must not be written');
  assert.ok(!('bill_city' in patch), 'no city must not be written');
  assert.ok(!('bill_region' in patch), 'no region must not be written');
  assert.equal(patch.bill_postal, '98116');
  // Lower-cased on the way in, because two spellings of one market is a broken
  // report.
  assert.equal(patch.bill_country, 'US');
}

// ── An unreadable customer contributes nothing but the timestamp ──
{
  const patch = billingProfileFrom(input(), NOW);
  assert.deepEqual(patch, { bill_synced_at: NOW });
}

// ── Lifetime value: summed, dated, and only when the list was readable ──
{
  const paid = billingProfileFrom(
    input({
      customer: customer(),
      paidInvoices: [
        invoice(3999, 1_780_000_000),
        invoice(3999, 1_748_464_000),
      ],
    }),
    NOW,
  );
  assert.equal(paid.bill_lifetime_cents, 7998);
  assert.equal(paid.bill_paid_invoices, 2);
  assert.equal(paid.bill_lifetime_currency, 'usd');
  // The EARLIEST invoice, whichever order Stripe listed them in -- it lists
  // newest first.
  assert.equal(paid.bill_first_paid_at, new Date(1_748_464_000 * 1000).toISOString());
}

// A trialing member has never paid. Zero is the true answer and must be
// written, or every trial reads as "lifetime unknown".
{
  const trial = billingProfileFrom(
    input({ customer: customer(), paidInvoices: [] }),
    NOW,
  );
  assert.equal(trial.bill_lifetime_cents, 0);
  assert.equal(trial.bill_paid_invoices, 0);
  assert.ok(!('bill_first_paid_at' in trial), 'never paid has no first payment');
}

// A failed invoices call is NOT a zero. This is the case that would quietly
// wipe the lifetime value of every paying member the next time Stripe rate
// limited us.
{
  const unreadable = billingProfileFrom(
    input({ customer: customer(), paidInvoices: null }),
    NOW,
  );
  assert.ok(!('bill_lifetime_cents' in unreadable));
  assert.ok(!('bill_paid_invoices' in unreadable));
  assert.ok(!('bill_lifetime_currency' in unreadable));
}

// ── Credit balance ──
//
// Negative is Stripe holding money for them, which is how a referral payout can
// land. It has to survive as a negative number, not be clamped or dropped.
{
  const patch = billingProfileFrom(
    input({ customer: customer({ balance: -275 }) }),
    NOW,
  );
  assert.equal(patch.bill_balance_cents, -275);
}

// ── Cards that are not cards ──
{
  const link = billingProfileFrom(
    input({ customer: customer(), card: card({ type: 'link', card: undefined }) }),
    NOW,
  );
  assert.ok(!('bill_card_brand' in link), 'a non-card method invents no brand');
  assert.ok(!('bill_card_funding' in link));
  assert.ok(!('bill_card_country' in link));
}

// A wallet is still a card to Stripe, and the underlying card is what these
// three describe.
{
  const wallet = billingProfileFrom(
    input({
      customer: customer(),
      card: card({
        card: {
          brand: 'mastercard',
          funding: 'debit',
          country: 'ca',
          wallet: { type: 'apple_pay' },
        },
      }),
    }),
    NOW,
  );
  assert.equal(wallet.bill_card_brand, 'mastercard');
  assert.equal(wallet.bill_card_funding, 'debit');
  assert.equal(wallet.bill_card_country, 'CA');
}

// ── Why they left ──
{
  const gone = billingProfileFrom(
    input({
      customer: customer(),
      subscription: {
        cancellation_details: {
          reason: 'cancellation_requested',
          feedback: 'too_expensive',
          comment: 'Great app, wrong season for me',
        },
      } as unknown as Stripe.Subscription,
    }),
    NOW,
  );
  assert.equal(gone.bill_cancel_reason, 'cancellation_requested');
  assert.equal(gone.bill_cancel_feedback, 'too_expensive');
  assert.equal(gone.bill_cancel_comment, 'Great app, wrong season for me');
}

// A live subscription carries an empty cancellation block on every event. It
// must not clear the reason a previous cancellation recorded -- a member who
// came back is exactly who the reason is interesting about.
{
  const live = billingProfileFrom(
    input({
      customer: customer(),
      subscription: {
        cancellation_details: { reason: null, feedback: null, comment: null },
      } as unknown as Stripe.Subscription,
    }),
    NOW,
  );
  assert.ok(!('bill_cancel_reason' in live));
  assert.ok(!('bill_cancel_feedback' in live));
  assert.ok(!('bill_cancel_comment' in live));
}

// Whitespace is not a value. Stripe will hand back a name of " " from a
// checkout field somebody tabbed through.
{
  const blank = billingProfileFrom(
    input({ customer: customer({ name: '   ' }) }),
    NOW,
  );
  assert.ok(!('bill_name' in blank), 'whitespace is not a name');
}

console.log('billing-profile: all cases pass');
