/**
 * Run with: npx tsx src/lib/google-data-manager.test.ts
 *
 * The wire format of the Google upload, asserted rather than discovered.
 *
 * This uploader cannot be exercised locally: it needs credentials that do not
 * exist yet, and the API it posts to fast-fails the whole request on one bad
 * field rather than reporting per-event errors. So the shape of the body, the
 * id it deduplicates on, and the decision about what carries a value are
 * pinned here, where a mistake is a failed test instead of a conversion Google
 * silently never recorded.
 *
 * The one thing no test can prove is that Google accepts it. Run the drain
 * once with GOOGLE_DM_VALIDATE_ONLY=1 for that; the API answers with what it
 * would have rejected and records nothing.
 */

import assert from 'node:assert/strict';
import {
  buildIngestRequest,
  googleAdIdentifiers,
  googleDataManagerAction,
  googleDataManagerConfig,
  googleEventTimestamp,
  type DataManagerConfig,
} from './google-data-manager';
import { conversionEventId, conversionValue, type ConversionRow } from './conversion-upload';

function row(over: Partial<ConversionRow>): ConversionRow {
  return {
    id: 1,
    event_type: 'trial_start',
    occurred_at: '2026-09-11T04:48:55.000Z',
    click_at: '2026-09-11T04:31:00.000Z',
    value_cents: 0,
    modeled_value_cents: 0,
    currency: 'usd',
    click_id: 'Cj0KCQjw_abc',
    click_type: 'gclid',
    upload_network: 'google',
    upload_attempts: 0,
    landing_path: '/lp/seattle/5',
    stripe_subscription_id: 'sub_1UF',
    user_id: null,
    dedupe_key: null,
    ...over,
  };
}

function cfg(over: Partial<DataManagerConfig> = {}): DataManagerConfig {
  return {
    clientId: 'client',
    clientSecret: 'secret',
    refreshToken: 'refresh',
    customerId: '4379403393',
    actions: { trial_start: '7001', purchase: '7002' },
    validateOnly: false,
    trialValueCents: null,
    ...over,
  };
}

// ── The transaction id is the browser tag's, or dedupe does not happen ──

/**
 * The entire reason both copies of a trial can be sent without double
 * counting. The gtag conversion on /billing/success sends `transaction_id:
 * eventId`, and eventId is this string. If the two ever drift, Google records
 * two conversions for one trial and the campaign bids on a number twice its
 * real size.
 */
{
  const r = row({});
  const body = buildIngestRequest({
    row: r,
    actionId: '7001',
    customerId: '4379403393',
    transactionId: conversionEventId(r)!,
  });
  const event = (body.events as Record<string, unknown>[])[0];
  assert.equal(event.transactionId, 'sub_1UF:trial_start');
  assert.equal(conversionEventId(r), 'sub_1UF:trial_start');
}

// ── Timestamps ──────────────────────────────────────────────────────

{
  // RFC 3339, Z-normalised. The Ads API's space-separated offset form is not
  // accepted here, so a copy of the old googleDateTime would fail every event.
  assert.equal(googleEventTimestamp('2026-09-11T04:48:55.000Z'), '2026-09-11T04:48:55.000Z');
  assert.match(googleEventTimestamp('2026-09-11T04:48:55+00:00')!, /T.*Z$/);
  assert.equal(googleEventTimestamp('not a date'), null);
}

{
  // The conversion time, not the click time. A purchase is charged a week
  // after the click, and dating it to the click asserts a sale that had not
  // happened yet.
  const r = row({
    event_type: 'purchase',
    occurred_at: '2026-09-18T04:51:00.000Z',
    click_at: '2026-09-11T04:31:00.000Z',
    value_cents: 3300,
  });
  const body = buildIngestRequest({
    row: r,
    actionId: '7002',
    customerId: '4379403393',
    transactionId: conversionEventId(r)!,
    value: conversionValue(r),
  });
  const event = (body.events as Record<string, unknown>[])[0];
  assert.equal(event.eventTimestamp, '2026-09-18T04:51:00.000Z');
}

// ── Click ids are three mutually exclusive fields ───────────────────

{
  assert.deepEqual(googleAdIdentifiers(row({})), { gclid: 'Cj0KCQjw_abc' });
  // iOS suppresses gclid. Handling only gclid drops the mobile half silently.
  assert.deepEqual(googleAdIdentifiers(row({ click_type: 'gbraid', click_id: 'gb1' })), {
    gbraid: 'gb1',
  });
  assert.deepEqual(googleAdIdentifiers(row({ click_type: 'wbraid', click_id: 'wb1' })), {
    wbraid: 'wb1',
  });
  // A Meta click is not a Google identifier, even on a row that reached here.
  assert.equal(googleAdIdentifiers(row({ click_type: 'fbclid', click_id: 'IwY2' })), null);
  assert.equal(googleAdIdentifiers(row({ click_id: null })), null);
}

// ── Values ──────────────────────────────────────────────────────────

{
  // A trial sends no value: the conversion action carries a fixed one in the
  // Ads UI, and sending a number here would override it.
  const r = row({});
  const body = buildIngestRequest({
    row: r,
    actionId: '7001',
    customerId: '4379403393',
    transactionId: 'sub_1UF:trial_start',
    value: conversionValue(r),
  });
  const event = (body.events as Record<string, unknown>[])[0];
  assert.equal('conversionValue' in event, false);
  assert.equal('currency' in event, false);
}

{
  // A purchase sends what Stripe actually charged, in dollars not cents.
  const r = row({ event_type: 'purchase', value_cents: 3300, currency: 'cad' });
  const body = buildIngestRequest({
    row: r,
    actionId: '7002',
    customerId: '4379403393',
    transactionId: 'sub_1UF:purchase',
    value: conversionValue(r),
  });
  const event = (body.events as Record<string, unknown>[])[0];
  assert.equal(event.conversionValue, 33);
  assert.equal(event.currency, 'CAD');
}

// ── Enhanced conversions ────────────────────────────────────────────

{
  // The hashed email rides as a user identifier, and `encoding` is what tells
  // Google it is hex. Sending the hash without the encoding is a silent
  // non-match, which is the failure mode worth a test.
  const body = buildIngestRequest({
    row: row({}),
    actionId: '7001',
    customerId: '4379403393',
    transactionId: 'sub_1UF:trial_start',
    emailHash: 'a'.repeat(64),
  });
  assert.equal(body.encoding, 'HEX');
  const event = (body.events as Record<string, unknown>[])[0];
  assert.deepEqual(event.userData, { userIdentifiers: [{ emailAddress: 'a'.repeat(64) }] });
}

{
  // No email, no userData key at all. An empty object here is a validation
  // error, not an omission.
  const body = buildIngestRequest({
    row: row({}),
    actionId: '7001',
    customerId: '4379403393',
    transactionId: 'sub_1UF:trial_start',
  });
  const event = (body.events as Record<string, unknown>[])[0];
  assert.equal('userData' in event, false);
}

// ── Destination ─────────────────────────────────────────────────────

{
  const body = buildIngestRequest({
    row: row({}),
    actionId: '7001',
    customerId: '4379403393',
    transactionId: 'sub_1UF:trial_start',
    validateOnly: true,
  });
  assert.deepEqual(body.destinations, [
    {
      operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '4379403393' },
      productDestinationId: '7001',
    },
  ]);
  assert.equal(body.validateOnly, true);
  // No consent block: its values are assertions about a signal we do not
  // collect. See the comment in buildIngestRequest.
  assert.equal('consent' in body, false);
}

// ── Which events go to Google ───────────────────────────────────────

{
  const c = cfg();
  assert.equal(googleDataManagerAction(c, 'trial_start'), '7001');
  assert.equal(googleDataManagerAction(c, 'purchase'), '7002');
  // Both upper-funnel events have a browser that always fires them, and the
  // paywall open is the action Smart Bidding currently runs on. Uploading
  // either would be a second copy of an event that never goes missing.
  assert.equal(googleDataManagerAction(c, 'signup'), null);
  assert.equal(googleDataManagerAction(c, 'paywall_view'), null);
  assert.equal(googleDataManagerAction(cfg({ actions: { trial_start: null, purchase: null } }), 'trial_start'), null);
}

// ── Config ──────────────────────────────────────────────────────────

{
  for (const key of [
    'GOOGLE_DM_CLIENT_ID',
    'GOOGLE_DM_CLIENT_SECRET',
    'GOOGLE_DM_REFRESH_TOKEN',
    'GOOGLE_DM_CUSTOMER_ID',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_CUSTOMER_ID',
  ]) {
    delete process.env[key];
  }
  // Nothing set: a clean null, so the uploader rests rather than throwing into
  // a Stripe webhook.
  assert.equal(googleDataManagerConfig(), null);

  process.env.GOOGLE_ADS_CLIENT_ID = 'shared-client';
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'shared-secret';
  process.env.GOOGLE_ADS_CUSTOMER_ID = '437-940-3393';
  // The Ads refresh token is NOT borrowed: it carries the adwords scope only,
  // and would authenticate here and then 403 on every call.
  process.env.GOOGLE_ADS_REFRESH_TOKEN = 'ads-only';
  assert.equal(googleDataManagerConfig(), null);

  process.env.GOOGLE_DM_REFRESH_TOKEN = 'dm-refresh';
  const resolved = googleDataManagerConfig();
  assert.ok(resolved);
  assert.equal(resolved.clientId, 'shared-client');
  // The dashed form copied out of the Ads UI is rejected by the API.
  assert.equal(resolved.customerId, '4379403393');
  assert.equal(resolved.validateOnly, false);
  assert.equal(resolved.trialValueCents, null);
}

console.log('google-data-manager tests passed');
