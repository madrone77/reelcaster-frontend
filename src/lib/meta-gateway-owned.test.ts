/**
 * Run with: npx tsx src/lib/meta-gateway-owned.test.ts
 *
 * The pixel's Conversions API Gateway relays every browser event to Meta as a
 * server event, so this queue must not send Meta a copy of anything the
 * browser already fires. If it does, nothing errors: Meta pairs the browser
 * event with one server copy, the other stands, and Ads Manager flags
 * "Event not deduplicated" while the ad set bids on a doubled count.
 *
 * Purchase is the exception that must keep flowing: day 7, no browser.
 */

import assert from 'node:assert/strict';
import { META_GATEWAY_OWNED_EVENTS, uploadConversion, type ConversionRow } from './conversion-upload';

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

async function main() {
  assert.ok(META_GATEWAY_OWNED_EVENTS.has('paywall_view'));
  assert.ok(META_GATEWAY_OWNED_EVENTS.has('trial_start'));
  assert.ok(!META_GATEWAY_OWNED_EVENTS.has('purchase'), 'purchase has no browser leg and must keep uploading');

  // Skipped BEFORE the credential check, so the reason names the real cause
  // in every environment rather than reading as an unconfigured uploader.
  assert.deepEqual(await uploadConversion(row({ event_type: 'paywall_view' })), {
    status: 'skipped',
    reason: 'gateway_owned:paywall_view',
  });
  assert.deepEqual(await uploadConversion(row({ event_type: 'trial_start' })), {
    status: 'skipped',
    reason: 'gateway_owned:trial_start',
  });

  // Purchase gets past the ownership gate; with no credentials in this
  // process it stops at the next check, which is the point: it was not
  // refused for being browser-owned.
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

  console.log('meta-gateway-owned: ok');
}

void main();
