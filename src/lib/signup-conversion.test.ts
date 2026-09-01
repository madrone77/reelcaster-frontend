/**
 * Run with: npx tsx src/lib/signup-conversion.test.ts
 *
 * The join this design cannot afford to get wrong, again.
 *
 * A signup is reported twice: the browser fires the Meta pixel the moment the
 * account authenticates, and the server posts the same conversion from the
 * upload queue up to an hour later. Meta collapses the pair only when the event
 * NAME and the event ID match on both. If they ever drift, nothing errors and
 * nothing looks broken: the trial count simply reads double, and bidding learns
 * from a number twice the truth.
 *
 * So the two things both halves must agree on are asserted here against the
 * same helpers each half actually calls.
 */

import assert from 'node:assert/strict';
import {
  META_SIGNUP_EVENT,
  SIGNUP_MODELED_VALUE_CENTS,
  SIGNUP_VALUE_CURRENCY,
  signupEventId,
} from './signup-conversion';
import {
  conversionEventId,
  conversionValue,
  metaEventName,
  type ConversionRow,
} from './conversion-upload';

const USER = '6f5b1d02-0c2e-4a1c-9a7e-1b1c9a0d4e11';

function row(over: Partial<ConversionRow>): ConversionRow {
  return {
    id: 1,
    event_type: 'signup',
    occurred_at: '2026-08-29T12:00:00.000Z',
    click_at: null,
    value_cents: 0,
    modeled_value_cents: SIGNUP_MODELED_VALUE_CENTS,
    currency: SIGNUP_VALUE_CURRENCY,
    click_id: null,
    click_type: null,
    upload_network: null,
    upload_attempts: 0,
    landing_path: null,
    stripe_subscription_id: null,
    user_id: USER,
    dedupe_key: null,
    ...over,
  };
}

// The browser builds its eventID from the account id alone, because that is the
// only thing it has. The server has to arrive at the identical string.
assert.equal(conversionEventId(row({})), signupEventId(USER));
assert.equal(signupEventId(USER), `user:${USER}:signup`);

// A signup with no account cannot be deduplicated, so it must not be uploaded
// at all rather than uploaded with a guessed id.
assert.equal(conversionEventId(row({ user_id: null })), null);

// The Stripe events keep the id they have always had. This is the assertion
// that catches a refactor tidying both branches into one shape.
assert.equal(
  conversionEventId(row({ event_type: 'trial_start', stripe_subscription_id: 'sub_123', user_id: USER })),
  'sub_123:trial_start',
);
assert.equal(
  conversionEventId(row({ event_type: 'purchase', stripe_subscription_id: 'sub_123' })),
  'sub_123:purchase',
);

// Names. CompleteRegistration is the standard event the browser fires too.
assert.equal(metaEventName('signup'), META_SIGNUP_EVENT);
assert.equal(metaEventName('signup'), 'CompleteRegistration');
assert.equal(metaEventName('trial_start'), 'StartTrial');
assert.equal(metaEventName('purchase'), 'Purchase');

// Values. A signup carries the modeled figure, in whole currency units, which
// is what the pixel sends as well.
assert.deepEqual(conversionValue(row({})), {
  value: SIGNUP_MODELED_VALUE_CENTS / 100,
  currency: 'CAD',
});

// A trial is worth nothing until it converts, and the purchase event says so a
// week later. Sending a value here would double-count the sale.
assert.equal(
  conversionValue(row({ event_type: 'trial_start', stripe_subscription_id: 'sub_123', modeled_value_cents: 0 })),
  null,
);

// A purchase reports what Stripe charged, never the modeled figure.
assert.deepEqual(
  conversionValue(
    row({
      event_type: 'purchase',
      stripe_subscription_id: 'sub_123',
      value_cents: 3300,
      currency: 'usd',
      modeled_value_cents: 0,
    }),
  ),
  { value: 33, currency: 'USD' },
);

// Setting the modeled value to zero is the supported way to stop sending a
// value on signups without touching the upload code.
assert.equal(conversionValue(row({ modeled_value_cents: 0 })), null);

console.log('signup-conversion: all assertions passed');
