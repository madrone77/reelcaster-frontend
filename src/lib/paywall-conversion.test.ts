/**
 * Run with: npx tsx src/lib/paywall-conversion.test.ts
 *
 * The guard this event cannot afford to lose.
 *
 * A paywall open is reported to an ad network as a conversion, and unlike the
 * three events before it there is no subscription and no account making "once"
 * true for free. `paywallViewDedupeKey` is the only thing standing between one
 * undecided reader opening the same wall three times and Meta being told about
 * three conversions. Get it wrong in the quiet direction — a key that varies
 * within a session — and nothing errors, nothing looks broken, and the
 * optimiser spends the budget finding people who bounce off paywalls.
 *
 * So the key's two branches, its refusal, and the fact that it doubles as the
 * Meta event id are asserted here against the helpers the route actually calls.
 */

import assert from 'node:assert/strict';
import { PAYWALL_VIEW_META_EVENT, paywallViewDedupeKey } from './paywall-conversion';
import {
  conversionEventId,
  conversionValue,
  metaEventName,
  metaFbc,
  type ConversionRow,
} from './conversion-upload';

const SESSION = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
const FBCLID = 'IwAR2xExampleClickIdValue';

function row(over: Partial<ConversionRow>): ConversionRow {
  return {
    id: 1,
    event_type: 'paywall_view',
    occurred_at: '2026-09-01T18:00:00.000Z',
    click_at: '2026-09-01T17:59:40.000Z',
    value_cents: 0,
    modeled_value_cents: 0,
    currency: 'cad',
    click_id: FBCLID,
    click_type: 'fbclid',
    upload_network: 'meta',
    upload_attempts: 0,
    landing_path: '/lp/1/victoria-bc',
    stripe_subscription_id: null,
    user_id: null,
    dedupe_key: `pv:s:${SESSION}`,
    ...over,
  };
}

// ── The key ──────────────────────────────────────────────────────────

// One session, one conversion. The same call twice is the same string, which
// is what the partial unique index turns into a no-op on the second wall open.
assert.equal(
  paywallViewDedupeKey({ sessionId: SESSION, clickId: FBCLID, day: '2026-09-01' }),
  `pv:s:${SESSION}`,
);
assert.equal(
  paywallViewDedupeKey({ sessionId: SESSION, clickId: FBCLID, day: '2026-09-01' }),
  paywallViewDedupeKey({ sessionId: SESSION, clickId: FBCLID, day: '2026-09-01' }),
);

// The session wins over the click id when both are present. It has to: one
// bought click can span several sessions over the ninety days rc_paid lives,
// and keying on the click would report only the first of them.
assert.equal(
  paywallViewDedupeKey({ sessionId: SESSION, clickId: FBCLID, day: '2026-09-01' }),
  paywallViewDedupeKey({ sessionId: SESSION, clickId: 'a-different-click', day: '2026-09-02' }),
);

// No session cookie — a browser blocking them, which is exactly the segment
// that must not silently drop out of a paid campaign's numbers. The click id
// carries it, and the day gives it roughly a session's grain.
assert.equal(
  paywallViewDedupeKey({ sessionId: null, clickId: FBCLID, day: '2026-09-01' }),
  `pv:c:${FBCLID}:2026-09-01`,
);
assert.notEqual(
  paywallViewDedupeKey({ sessionId: null, clickId: FBCLID, day: '2026-09-01' }),
  paywallViewDedupeKey({ sessionId: null, clickId: FBCLID, day: '2026-09-02' }),
);

// Neither: skipped rather than guessed. An unbounded stream of undedupable
// conversions is worse than a small, honest undercount.
assert.equal(paywallViewDedupeKey({ sessionId: null, clickId: null, day: '2026-09-01' }), null);
assert.equal(paywallViewDedupeKey({ sessionId: '', clickId: '', day: '2026-09-01' }), null);

// ── What Meta is told ────────────────────────────────────────────────

// The key is the event id. Same string, so a browser leg added later dedupes
// against this one without a second convention to keep in step.
assert.equal(conversionEventId(row({})), `pv:s:${SESSION}`);
assert.equal(conversionEventId(row({ dedupe_key: null })), null);

// A standard name, and the literal is asserted so that changing it stays a
// decision rather than a rename. It was the custom `PaywallView` until the
// reservation on InitiateCheckout turned out to be holding the name for a CTA
// press nothing ever fired; see src/lib/paywall-conversion.ts. Moving it again
// splits the series in Events Manager, so it should be moved rarely and on
// purpose.
assert.equal(metaEventName('paywall_view'), PAYWALL_VIEW_META_EVENT);
assert.equal(metaEventName('paywall_view'), 'InitiateCheckout');
assert.notEqual(metaEventName('paywall_view'), metaEventName('trial_start'));

// NO VALUE. A modal open four seconds after a click has no defensible worth,
// and a number here would be summable into something that reads as revenue.
assert.equal(conversionValue(row({})), null);
assert.equal(conversionValue(row({ modeled_value_cents: 100 })), null);

// The click time, not the event time, is what fbc is built from — Meta matches
// on fb.1.<click_time_ms>.<fbclid> and the twenty seconds between them is the
// difference between a match and a miss.
assert.equal(
  metaFbc(row({})),
  `fb.1.${Date.parse('2026-09-01T17:59:40.000Z')}.${FBCLID}`,
);

console.log('paywall-conversion: ok');
