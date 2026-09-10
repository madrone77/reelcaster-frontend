/**
 * Run with: npx tsx src/lib/meta-gateway-owned.test.ts
 *
 * The pixel's Conversions API Gateway relays every browser event to Meta as a
 * server event, so this queue must not send Meta a copy of anything the
 * browser already fired. If it does, nothing errors: Meta pairs the browser
 * event with one server copy, the other stands, and Ads Manager flags
 * "Event not deduplicated" while the ad set bids on a doubled count.
 *
 * Purchase is the exception that must keep flowing: day 7, no browser.
 *
 * REVISED 2026-09-10. `trial_start` used to sit in the owned set beside
 * `paywall_view`, which was right about the common case and wrong about the
 * one that mattered: a trial whose browser copy never fired reached Meta zero
 * times. Now the browser says when it has fired and this queue backstops the
 * rest, so the assertions below are about `trialCopyIsOurs` rather than about
 * membership of a set. StartTrial is the event the Meta campaign bids on as
 * of the same day, which is why it is worth this much care.
 */

import assert from 'node:assert/strict';
import {
  BROWSER_COPY_GRACE_MS,
  META_GATEWAY_OWNED_EVENTS,
  hasMetaIdentifier,
  metaFbc,
  trialCopyIsOurs,
  uploadConversion,
  type ConversionRow,
} from './conversion-upload';

delete process.env.META_PIXEL_ID;
delete process.env.META_CAPI_ACCESS_TOKEN;

function row(over: Partial<ConversionRow>): ConversionRow {
  return {
    id: 1,
    event_type: 'purchase',
    occurred_at: '2026-09-03T12:00:00.000Z',
    click_at: '2026-09-03T11:00:00.000Z',
    value_cents: 3300,
    modeled_value_cents: 0,
    currency: 'cad',
    click_id: 'IwY2xjawUF',
    click_type: 'fbclid',
    upload_network: 'meta',
    upload_attempts: 0,
    landing_path: '/lp/vancouver/4',
    stripe_subscription_id: 'sub_123',
    user_id: null,
    dedupe_key: 'pv:s:986d1a4a-da74-4a72-8564-8ea2f40260f4',
    ...over,
  } as ConversionRow;
}

const TRIAL_AT = '2026-09-03T12:00:00.000Z';
const trialAtMs = new Date(TRIAL_AT).getTime();

async function main() {
  // ── The one event the browser always owns ────────────────────────────
  // A paywall open is fired BY the browser opening the paywall. There is no
  // case where it happens and no browser saw it.
  assert.ok(META_GATEWAY_OWNED_EVENTS.has('paywall_view'));
  assert.ok(!META_GATEWAY_OWNED_EVENTS.has('trial_start'), 'trial_start is decided per row now');
  assert.ok(!META_GATEWAY_OWNED_EVENTS.has('purchase'), 'purchase has no browser leg and must keep uploading');

  assert.deepEqual(await uploadConversion(row({ event_type: 'paywall_view' })), {
    status: 'skipped',
    reason: 'gateway_owned:paywall_view',
  });

  // ── Whose copy is a trial_start ──────────────────────────────────────
  const trial = (over: Partial<ConversionRow> = {}) =>
    row({ event_type: 'trial_start', occurred_at: TRIAL_AT, ...over });

  // Reported by the pixel: ours would be the third arrival.
  assert.equal(
    trialCopyIsOurs(trial({ browser_reported_at: '2026-09-03T12:00:04.000Z' })),
    'browser',
  );
  // Fresh and unreported: the report may still be in flight.
  assert.equal(trialCopyIsOurs(trial(), trialAtMs + 60_000), 'wait');
  // Silent past the grace window: nobody else is going to tell Meta.
  assert.equal(trialCopyIsOurs(trial(), trialAtMs + BROWSER_COPY_GRACE_MS + 1), 'ours');
  // A row that cannot be dated must not wedge in the queue forever.
  assert.equal(trialCopyIsOurs(trial({ occurred_at: 'not a date' })), 'ours');
  // Every other event is unaffected, whatever the timestamps say.
  assert.equal(trialCopyIsOurs(row({ occurred_at: TRIAL_AT }), trialAtMs), 'ours');

  // Decided before the credential check, so the reason names the real cause.
  assert.deepEqual(
    await uploadConversion(trial({ browser_reported_at: '2026-09-03T12:00:04.000Z' })),
    { status: 'skipped', reason: 'browser_reported' },
  );

  // A deferred row is NOT a skipped one. The drain leaves it untouched, and
  // conflating the two would burn its attempts and then rest it forever.
  const fresh = await uploadConversion(trial({ occurred_at: new Date().toISOString() }));
  assert.deepEqual(fresh, { status: 'deferred', reason: 'awaiting_browser_copy' });

  // Past the window it gets on with it, and stops at the next real check.
  assert.deepEqual(await uploadConversion(trial()), {
    status: 'skipped',
    reason: 'meta_not_configured',
  });

  // Purchase still gets past the ownership gate with no waiting at all.
  assert.deepEqual(await uploadConversion(row({ event_type: 'purchase' })), {
    status: 'skipped',
    reason: 'meta_not_configured',
  });

  // Google is untouched by a Meta-only rule.
  const google = await uploadConversion(
    row({ event_type: 'paywall_view', upload_network: 'google', click_type: 'gclid' }),
  );
  assert.equal(google.status, 'skipped');
  assert.notEqual((google as { reason: string }).reason, 'gateway_owned:paywall_view');

  // ── fbc: the stored cookie beats a rebuild, and a guess beats nothing ──
  const realCookie = 'fb.1.1756909733083.IwY2xjawUFabc';
  assert.equal(metaFbc(row({ fbc: realCookie })), realCookie, 'the cookie wins');
  assert.equal(
    metaFbc(row({ click_at: '2026-09-03T11:00:00.000Z', click_id: 'IwY2xjawUF' })),
    `fb.1.${new Date('2026-09-03T11:00:00.000Z').getTime()}.IwY2xjawUF`,
  );
  // THE BUG THIS REPLACED: with no click time the rebuild used to fall back to
  // the conversion time, so a day-7 purchase asserted a click that happened a
  // week after it did. Accepted by Meta, matched against nothing.
  assert.equal(metaFbc(row({ click_at: null })), null, 'never invent a click time');
  assert.equal(metaFbc(row({ click_type: 'gclid' })), null, 'a Google click is not an fbc');
  assert.equal(metaFbc(row({ click_id: null })), null);

  // ── What counts as something Meta can match on ───────────────────────
  assert.ok(hasMetaIdentifier({ em: 'a'.repeat(64) }));
  assert.ok(hasMetaIdentifier({ fbc: realCookie }));
  assert.ok(hasMetaIdentifier({ fbp: 'fb.1.1756909733083.1234567890' }));
  assert.ok(hasMetaIdentifier({ external_id: 'a-user-id' }));
  assert.ok(hasMetaIdentifier({ ph: 'b'.repeat(64) }));
  // An address and a user agent sharpen a match, they do not make one. A
  // shared mobile IP plus a common Android agent credits somebody else's ad.
  assert.ok(!hasMetaIdentifier({ client_ip_address: '24.84.1.1', client_user_agent: 'Mozilla/5.0' }));
  assert.ok(!hasMetaIdentifier({}));

  // ── The identifier gate, with credentials in place ──────────────────
  // Set here rather than at the top so everything above proves it stops at
  // the ownership and credential checks first. Nothing below reaches a fetch:
  // the gate returns before the request is built.
  process.env.META_PIXEL_ID = '1209354965605238';
  process.env.META_CAPI_ACCESS_TOKEN = 'test-token-not-used';

  // A trial with nothing to match on is refused rather than sent as noise.
  assert.deepEqual(
    await uploadConversion(trial({ click_id: null, click_at: null, fbc: null })),
    { status: 'skipped', reason: 'no_meta_identifier' },
  );

  // THE CHANGE THAT MATTERS: no click id is no longer a refusal. Eight of the
  // twelve purchases in the thirty days to 2026-09-10 died on the old
  // `not_a_meta_click` gate, and the hashed email was sitting right there.
  // Asserted against the gate rather than through uploadConversion, because
  // anything that gets PAST the gate posts to graph.facebook.com, and a test
  // that reaches the internet fails on a train.
  const clickless = row({ click_id: null, click_type: null, click_at: null, fbc: null });
  const fbcFor = metaFbc(clickless);
  assert.equal(fbcFor, null, 'nothing to build an fbc from');
  // The object uploadToMeta assembles for that row, given what the Stripe
  // customer yields. It has no click of any kind in it and it is still enough.
  assert.ok(
    hasMetaIdentifier({ em: 'a'.repeat(64), external_id: 'u-1', ...(fbcFor ? { fbc: fbcFor } : {}) }),
    'a hashed email and an account id are enough on their own',
  );

  console.log('meta-gateway-owned: ok');
}

void main();
