/**
 * Run with: npx tsx src/lib/payment-method.test.ts
 *
 * The case that matters most is the one that looks like a non-case: an Apple
 * Pay payment method has `type: 'card'`. Every wallet purchase in the product
 * comes back wearing that type, so a classifier that reads it and stops is
 * wrong for exactly the buyers this stamp was added to count.
 */

import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  PAY_METHOD_KEY,
  paymentMethodIdOf,
  paymentMethodKey,
  resolvePaymentMethodKey,
} from './payment-method';

function pm(type: string, wallet?: string): Stripe.PaymentMethod {
  return {
    id: `pm_${wallet ?? type}`,
    object: 'payment_method',
    type,
    ...(type === 'card'
      ? { card: { brand: 'visa', ...(wallet ? { wallet: { type: wallet } } : {}) } }
      : {}),
  } as unknown as Stripe.PaymentMethod;
}

function sub(over: Record<string, unknown>): Stripe.Subscription {
  return {
    id: 'sub_x',
    object: 'subscription',
    customer: 'cus_x',
    default_payment_method: null,
    metadata: {},
    ...over,
  } as unknown as Stripe.Subscription;
}

function testWalletIsNotJustACard() {
  assert.equal(
    paymentMethodKey(pm('card', 'apple_pay')),
    'apple_pay',
    'an Apple Pay purchase must not be recorded as a plain card',
  );
  assert.equal(paymentMethodKey(pm('card', 'google_pay')), 'google_pay');
  assert.equal(paymentMethodKey(pm('card')), 'card', 'a real card is a card');
  assert.equal(paymentMethodKey(pm('link')), 'link');
  assert.equal(paymentMethodKey(pm('us_bank_account')), 'us_bank_account');
  assert.equal(paymentMethodKey(null), null, 'nothing to say beats a guess');
}

function testIdExtraction() {
  assert.equal(paymentMethodIdOf('pm_123'), 'pm_123');
  assert.equal(paymentMethodIdOf(pm('card', 'apple_pay')), 'pm_apple_pay');
  assert.equal(paymentMethodIdOf(null), null);
}

async function testExpandedMethodNeedsNoFetch() {
  let fetched = 0;
  const stripe = {
    paymentMethods: {
      retrieve: async () => {
        fetched++;
        return pm('card');
      },
    },
  } as unknown as Stripe;

  const key = await resolvePaymentMethodKey(
    stripe,
    sub({ default_payment_method: pm('card', 'apple_pay') }),
  );
  assert.equal(key, 'apple_pay');
  assert.equal(fetched, 0, 'an already-expanded method must not be re-fetched');
}

async function testBareIdIsFetched() {
  const stripe = {
    paymentMethods: {
      retrieve: async (id: string) => {
        assert.equal(id, 'pm_1', 'fetches the id the subscription carries');
        return pm('card', 'google_pay');
      },
    },
  } as unknown as Stripe;

  // Webhook payloads are never expanded, so this is the shape that actually
  // arrives in production.
  const key = await resolvePaymentMethodKey(
    stripe,
    sub({ default_payment_method: 'pm_1' }),
  );
  assert.equal(key, 'google_pay');
}

async function testFallsBackToCustomerDefault() {
  const stripe = {
    customers: {
      retrieve: async () => ({
        id: 'cus_x',
        invoice_settings: { default_payment_method: pm('card', 'apple_pay') },
      }),
    },
  } as unknown as Stripe;

  // A hosted Checkout can leave the method on the customer rather than the
  // subscription. Reporting "unknown" there would hide a real wallet buyer.
  const key = await resolvePaymentMethodKey(stripe, sub({}));
  assert.equal(key, 'apple_pay');
}

async function testStripeFailureIsNotFatal() {
  const stripe = {
    paymentMethods: {
      retrieve: async () => {
        throw new Error('insufficient permissions');
      },
    },
  } as unknown as Stripe;

  const key = await resolvePaymentMethodKey(
    stripe,
    sub({ default_payment_method: 'pm_1' }),
  );
  assert.equal(key, null, 'a failed read leaves it unstamped rather than wrong');
}

async function testDeletedCustomerIsNotStamped() {
  const stripe = {
    customers: { retrieve: async () => ({ id: 'cus_x', deleted: true }) },
  } as unknown as Stripe;

  assert.equal(await resolvePaymentMethodKey(stripe, sub({})), null);
}

function testMetadataKeyIsStable() {
  // BlueCaster's revenue rollup reads this exact key. Renaming it here
  // silently empties the column there.
  assert.equal(PAY_METHOD_KEY, 'pay_method');
}

async function main() {
  testWalletIsNotJustACard();
  testIdExtraction();
  await testExpandedMethodNeedsNoFetch();
  await testBareIdIsFetched();
  await testFallsBackToCustomerDefault();
  await testStripeFailureIsNotFatal();
  await testDeletedCustomerIsNotStamped();
  testMetadataKeyIsStable();
  console.log('payment-method: all tests passed');
}

main();
