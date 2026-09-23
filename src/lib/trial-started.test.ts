/**
 * Run with: npx tsx src/lib/trial-started.test.ts
 *
 * Mixpanel `Trial Started` is the number growth ranks cities and writes ads
 * against. It used to wait on the ad-conversion helper AND on a signed-in
 * checkout poll, which dropped the pay-first claim path and any poll that
 * timed out. These cases are the ones that cannot drift: fire only when Pro
 * is confirmed, once per Stripe session_id, never for a missing session.
 */

import assert from 'node:assert/strict';
import {
  consumeTrialStartedGuard,
  isTrialStartedConfirmable,
  trialStartedStorageKey,
  TRIAL_STARTED_STORAGE_PREFIX,
} from './trial-started';

const SESSION = 'cs_test_trial_started_once';

function confirm(over: Partial<Parameters<typeof isTrialStartedConfirmable>[0]> = {}) {
  return isTrialStartedConfirmable({
    sessionId: SESSION,
    checkoutActive: false,
    subscriptionPaid: false,
    claimProvisioned: false,
    ...over,
  });
}

// ── Confirmation: Pro / trialing on this page ─────────────────────────────

assert.equal(confirm({ checkoutActive: true }), true, 'poll is_active fires');
assert.equal(confirm({ subscriptionPaid: true }), true, 'already-Pro hook fires');
assert.equal(confirm({ claimProvisioned: true }), true, 'claim signed_in/emailed fires');

assert.equal(confirm({}), false, 'landing on the page is not enough');
assert.equal(
  confirm({ sessionId: null, checkoutActive: true }),
  false,
  'no session_id cannot dedupe, so it must not fire',
);
assert.equal(
  confirm({ sessionId: '', checkoutActive: true }),
  false,
  'empty session_id is the same refusal',
);

// A poll timeout with Pro still false, or a 202 claim timeout, look like
// the unpaid dummy-session e2e visit. They stay quiet.
assert.equal(
  confirm({ checkoutActive: false, subscriptionPaid: false, claimProvisioned: false }),
  false,
  'timeout without Pro confirmation does not fire',
);

// ── Once-per-session guard ────────────────────────────────────────────────

assert.equal(trialStartedStorageKey(SESSION), `${TRIAL_STARTED_STORAGE_PREFIX}${SESSION}`);
assert.equal(trialStartedStorageKey(SESSION), `rc_mixpanel_fired:${SESSION}`);

function memoryStorage(initial: Record<string, string> = {}): {
  store: Record<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
} {
  const store = { ...initial };
  return {
    store,
    getItem(key) {
      return store[key] ?? null;
    },
    setItem(key, value) {
      store[key] = value;
    },
  };
}

const first = memoryStorage();
assert.equal(consumeTrialStartedGuard(SESSION, first), true, 'first visit fires');
assert.equal(first.store[`rc_mixpanel_fired:${SESSION}`], '1');
assert.equal(consumeTrialStartedGuard(SESSION, first), false, 'refresh does not double-count');

assert.equal(
  consumeTrialStartedGuard('cs_test_other', first),
  true,
  'a different session_id is a different trial',
);

assert.equal(consumeTrialStartedGuard('', first), false, 'empty session_id never fires');
assert.equal(
  consumeTrialStartedGuard(SESSION, null),
  true,
  'no storage (SSR / blocked) fires rather than going quiet',
);

const exploding = {
  getItem(): string | null {
    throw new Error('storage blocked');
  },
  setItem(): void {
    throw new Error('storage blocked');
  },
};
assert.equal(
  consumeTrialStartedGuard(SESSION, exploding),
  true,
  'storage throw fires rather than dropping the trial',
);

console.log('trial-started: ok');
