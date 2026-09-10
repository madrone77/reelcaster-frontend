/**
 * Run with: npx tsx src/lib/acquisition-metadata.test.ts
 *
 * What gets captured at checkout is the ceiling on what can ever be reported.
 * A conversion is uploaded up to seven days later, from a server, with no
 * browser to ask — so an identifier missed here is missed permanently, and
 * the miss is silent: the upload succeeds, Meta accepts it, and it matches
 * nobody.
 *
 * Two things this pins down, both of which were real gaps on 2026-09-10:
 * the wallet path stamped none of this at all, and `_fbc` was never read.
 */

import assert from 'node:assert/strict';
import { acquisitionMetadata, clientIp, forwardedAcquisition } from './acquisition-metadata';
import { readFbc } from './attribution';

const FBC = 'fb.1.1756909733083.IwY2xjawUFabcDEF-_123';
const FBP = 'fb.1.1756909733083.1234567890';
const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';

function headers(over: Record<string, string> = {}): Headers {
  return new Headers({ 'user-agent': UA, ...over });
}

function main() {
  // ── _fbc, validated by shape because a visitor can edit a cookie ──────
  assert.equal(readFbc(`_fbc=${FBC}`), FBC);
  assert.equal(readFbc(`_ga=1; _fbc=${FBC}; _fbp=${FBP}`), FBC);
  assert.equal(readFbc(`_fbc=${encodeURIComponent(FBC)}`), FBC, 'url-encoded cookie');
  assert.equal(readFbc('_fbc=nonsense'), null);
  assert.equal(readFbc('_fbc=fb.1.notatime.abc'), null);
  assert.equal(readFbc(`_fbclid=${FBC}`), null, 'must not match a longer cookie name');
  assert.equal(readFbc(''), null);
  assert.equal(readFbc(null), null);

  // ── the client address ────────────────────────────────────────────────
  assert.equal(clientIp(headers({ 'x-forwarded-for': '24.84.1.1' })), '24.84.1.1');
  assert.equal(
    clientIp(headers({ 'x-forwarded-for': '24.84.1.1, 10.0.0.1, 10.0.0.2' })),
    '24.84.1.1',
    'the client is the first entry, the rest are proxies',
  );
  assert.equal(clientIp(headers({ 'x-real-ip': '2001:db8::1' })), '2001:db8::1');
  assert.equal(clientIp(headers()), null);
  // A header anyone can set. Anything not shaped like an address is dropped
  // rather than forwarded to Meta as one.
  assert.equal(clientIp(headers({ 'x-forwarded-for': 'not-an-address' })), null);
  assert.equal(clientIp(headers({ 'x-forwarded-for': 'a'.repeat(80) })), null);

  // ── the whole bag ─────────────────────────────────────────────────────
  const full = acquisitionMetadata(
    headers({
      cookie: `_fbc=${FBC}; _fbp=${FBP}`,
      'x-forwarded-for': '24.84.1.1',
    }),
  );
  assert.equal(full.acq_fbc, FBC);
  assert.equal(full.acq_fbp, FBP);
  assert.equal(full.acq_ip, '24.84.1.1');
  assert.equal(full.acq_ua, UA);
  assert.equal(full.acq_device, 'mobile');

  // Nothing invented when nothing is known. An absent key is honest; an empty
  // string is a value Stripe stores and the webhook then reads back as real.
  const bare = acquisitionMetadata(new Headers());
  assert.ok(!('acq_fbc' in bare));
  assert.ok(!('acq_ip' in bare));
  assert.ok(!('acq_ua' in bare));

  // Stripe caps metadata values at 500 chars and some user agents are long.
  const longUa = acquisitionMetadata(headers({ 'user-agent': 'M'.repeat(900) }));
  assert.ok(longUa.acq_ua.length <= 400);

  // ── carrying it across the two-request wallet flow ────────────────────
  // Step 1 stamps a SetupIntent, step 2 creates the subscription from a bare
  // intent id. The webhook only ever reads subscription.metadata.
  const forwarded = forwardedAcquisition({
    ...full,
    express_checkout: '1',
    checkout_email: 'someone@example.com',
    split_trial_sheet: 'b',
  });
  assert.equal(forwarded.acq_fbc, FBC);
  assert.equal(forwarded.acq_ip, '24.84.1.1');
  assert.ok(!('checkout_email' in forwarded), 'only the acquisition keys travel');
  assert.ok(!('split_trial_sheet' in forwarded), 'splits have their own carrier');
  assert.deepEqual(forwardedAcquisition(null), {});
  assert.deepEqual(forwardedAcquisition({ acq_fbc: undefined }), {}, 'no empty keys');

  console.log('acquisition-metadata: ok');
}

main();
