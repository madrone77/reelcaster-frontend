/**
 * Run with: npx tsx src/lib/attribution.test.ts
 *
 * These two builders are the whole of acquisition measurement. They run in two
 * places that cannot share a runtime — middleware on the edge and a useEffect
 * in the browser — and the only thing keeping those two honest is that they
 * call the same function with different inputs. So the cases here are about
 * the inputs each side sees, not about the parsing, which has one code path.
 *
 * The /billing case is the one that came from production. A real paying
 * customer has first touch `/billing/success`, referrer `checkout.stripe.com`,
 * written on the way back from Stripe by a browser that reached checkout with
 * no cookie. rc_entry is write-once for ninety days, so that record does not
 * merely say nothing, it locks out the record that would have said something.
 */

import assert from 'node:assert/strict';
import { buildEntry, buildPaid } from './attribution';

const HOST = 'www.reelcaster.com';

function entry(pathname: string, search = '', referrer = '') {
  return buildEntry({ pathname, search, referrer, host: HOST });
}

// ── First touch ──────────────────────────────────────────────────────────────

function testEntryKeepsTheAdsTags() {
  const e = entry(
    '/lp/6/seattle-wa',
    '?utm_source=ig&utm_medium=paid&utm_campaign=120247627380030452&fbclid=IwABC&loc=seattle-wa',
    'https://l.instagram.com/',
  );
  assert.ok(e);
  assert.equal(e.entry_path, '/lp/6/seattle-wa');
  assert.equal(e.utm_source, 'ig');
  assert.equal(e.utm_medium, 'paid');
  assert.equal(e.utm_campaign, '120247627380030452');
  assert.equal(e.click_type, 'fbclid');
  assert.equal(e.click_id, 'IwABC');
  assert.equal(e.params.loc, 'seattle-wa');
  assert.equal(e.referrer, 'https://l.instagram.com/');
}

/** Case is significant in a network-issued token and mangling one loses the sale. */
function testClickIdKeepsItsCase() {
  const e = entry('/explore', '?gclid=EAIaIQobChMI_MixedCase');
  assert.ok(e);
  assert.equal(e.click_id, 'EAIaIQobChMI_MixedCase');
  assert.equal(e.utm_source, '');
}

function testOwnHostIsNotAReferrer() {
  const e = entry('/explore', '', `https://${HOST}/fishing/wa/seattle-wa`);
  assert.ok(e);
  assert.equal(e.referrer, '');
}

function testBillingNeverBecomesFirstTouch() {
  assert.equal(entry('/billing/success', '?session_id=cs_test'), null);
  assert.equal(entry('/billing/cancel'), null);
  assert.equal(entry('/api/attribution/campaign'), null);
  assert.equal(entry('/auth/callback'), null);
  // The guard is on the segment, not the substring: a city page that happens
  // to start with those letters is a perfectly good landing page.
  assert.ok(entry('/billings-harbour'));
  assert.ok(entry('/'));
}

// ── Paid touch ───────────────────────────────────────────────────────────────

function testPaidNeedsAMarker() {
  assert.equal(buildPaid({ pathname: '/explore', search: '' }), null);
  assert.equal(
    buildPaid({ pathname: '/explore', search: '?utm_source=newsletter&utm_medium=email' }),
    null,
  );
}

function testClickIdAloneIsEnough() {
  // Both real Meta trials arrived exactly like this: a click id, no utm tags,
  // because the ad had no URL parameters set.
  const p = buildPaid({ pathname: '/explore', search: '?fbclid=IwY2xjawTx2y' });
  assert.ok(p);
  assert.equal(p.click_type, 'fbclid');
  assert.equal(p.landing_path, '/explore');
  assert.equal(p.utm_campaign, '');
}

/** iOS gets gbraid instead of gclid. Missing it loses the mobile half of Google. */
function testIosGoogleClickIds() {
  for (const key of ['gbraid', 'wbraid']) {
    const p = buildPaid({ pathname: '/explore/spot/jefferson-head-d0d536', search: `?${key}=abc` });
    assert.ok(p, `${key} should count as paid`);
    assert.equal(p.click_type, key);
  }
}

function testPaidMediumWithoutAClickId() {
  const p = buildPaid({ pathname: '/lp/6/seattle-wa', search: '?utm_medium=cpc&utm_source=google' });
  assert.ok(p);
  assert.equal(p.click_type, '');
  assert.equal(p.utm_source, 'google');
}

const tests = [
  testEntryKeepsTheAdsTags,
  testClickIdKeepsItsCase,
  testOwnHostIsNotAReferrer,
  testBillingNeverBecomesFirstTouch,
  testPaidNeedsAMarker,
  testClickIdAloneIsEnough,
  testIosGoogleClickIds,
  testPaidMediumWithoutAClickId,
];

let failed = 0;
for (const t of tests) {
  try {
    t();
    console.log(`ok   ${t.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${t.name}`);
    console.error(err);
  }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
