/**
 * Run with: npx tsx src/lib/traffic-source.test.ts
 *
 * This file decides what the organic report can ever say, so the cases here
 * are about the distinctions that would be silently lost rather than about the
 * regexes. A page kind that collapses into another one does not throw, does not
 * log, and does not show up as a gap: it shows up as a plausible number that is
 * quietly the sum of two different things.
 */

import assert from 'node:assert/strict';
import { classifyPage, classifySource, referrerHost } from './traffic-source';

const HOST = 'www.reelcaster.com';

// ── Page kinds ───────────────────────────────────────────────────────────────

/** The nesting cases. Each of these paths is a prefix of the one before it. */
function testFishingPathsDoNotCollapse() {
  assert.deepEqual(classifyPage('/fishing/wa'), { kind: 'province', slug: 'wa' });
  assert.deepEqual(classifyPage('/fishing/wa/seattle-wa'), {
    kind: 'city',
    slug: 'wa/seattle-wa',
  });
  assert.deepEqual(classifyPage('/fishing/wa/seattle-wa/chinook'), {
    kind: 'city-species',
    slug: 'wa/seattle-wa/chinook',
  });
}

/** The ad frame is a rewrite of the same page and must not read as a new one. */
function testSpotAdFrameIsTheSpot() {
  assert.deepEqual(classifyPage('/explore/spot/point-robinson-e2e269'), {
    kind: 'spot',
    slug: 'point-robinson-e2e269',
  });
  assert.deepEqual(classifyPage('/explore/spot/point-robinson-e2e269/ad'), {
    kind: 'spot',
    slug: 'point-robinson-e2e269',
  });
}

/**
 * Both landing shapes count. `/lp/seattle/1` is the city-first one, and the
 * campaign counter's own LANDING_SHAPE currently rejects it — see the note in
 * the migration. Storing the tail means this file does not repeat that mistake.
 */
function testBothLandingShapes() {
  assert.deepEqual(classifyPage('/lp/6/seattle-wa'), { kind: 'lp', slug: '6/seattle-wa' });
  assert.deepEqual(classifyPage('/lp/seattle/1'), { kind: 'lp', slug: 'seattle/1' });
}

function testSingletonPages() {
  assert.deepEqual(classifyPage('/'), { kind: 'home', slug: '' });
  assert.deepEqual(classifyPage('/explore'), { kind: 'explore', slug: '' });
  assert.deepEqual(classifyPage('/fishing-licence/bc'), { kind: 'licence', slug: 'bc' });
  assert.deepEqual(classifyPage('/faq'), { kind: 'marketing', slug: 'faq' });
}

/** A trailing slash is the same page and must not open a second bucket. */
function testTrailingSlash() {
  assert.deepEqual(classifyPage('/fishing/wa/seattle-wa/'), {
    kind: 'city',
    slug: 'wa/seattle-wa',
  });
  assert.deepEqual(classifyPage('/'), { kind: 'home', slug: '' });
}

/**
 * Signed-in surfaces are not arrivals. Counting a dashboard reload would let a
 * few daily-active users out-vote every search reader in the table.
 */
function testSignedInSurfacesAreNotCounted() {
  for (const p of [
    '/dashboard',
    '/profile/custom-alerts',
    '/settings/units',
    '/billing/success',
    '/plans/checkout',
    '/login',
    '/signup',
    '/first',
    '/api/attribution/signup',
  ]) {
    assert.equal(classifyPage(p), null, `${p} should not be counted`);
  }
  // The guard is on the segment, not the substring.
  assert.ok(classifyPage('/fishing/bc/plans-inlet'));
}

// ── Sources ──────────────────────────────────────────────────────────────────

function testHostAliasesCollapse() {
  assert.equal(referrerHost('https://l.facebook.com/'), 'facebook.com');
  assert.equal(referrerHost('https://lm.facebook.com/l.php?u=x'), 'facebook.com');
  assert.equal(referrerHost('https://www.google.com/'), 'google.com');
}

/** Longest alias wins, or Google News disappears into Google. */
function testNewsGoogleKeepsItsOwnRow() {
  assert.equal(referrerHost('https://news.google.com/'), 'news.google.com');
}

function testSourceKinds() {
  const from = (referrer: string, isPaid = false) =>
    classifySource({ referrer, selfHost: HOST, isPaid });

  assert.deepEqual(from('https://www.google.com/'), { kind: 'search', host: 'google.com' });
  assert.deepEqual(from('https://chatgpt.com/'), { kind: 'ai', host: 'chatgpt.com' });
  assert.deepEqual(from('https://l.facebook.com/'), { kind: 'social', host: 'facebook.com' });
  assert.deepEqual(from('https://bloodydecks.com/threads/x'), {
    kind: 'referral',
    host: 'bloodydecks.com',
  });
  assert.deepEqual(from(''), { kind: 'direct', host: '' });
}

/**
 * The bucket that has to exist. A hard reload carries our own host, and folding
 * that into `direct` would make the biggest number in the report mean "somebody
 * pressed reload".
 */
function testOwnHostIsInternalNotDirect() {
  const r = classifySource({
    referrer: `https://${HOST}/explore`,
    selfHost: HOST,
    isPaid: false,
  });
  assert.deepEqual(r, { kind: 'internal', host: '' });
}

/**
 * An Instagram ad and an Instagram share arrive from the same host. The
 * parameters are the only thing that separates them, so paid has to win.
 */
function testPaidBeatsTheReferrer() {
  const r = classifySource({
    referrer: 'https://l.instagram.com/',
    selfHost: HOST,
    isPaid: true,
  });
  assert.equal(r.kind, 'paid');
  assert.equal(r.host, 'instagram.com');
}

/** gemini.google.com is an assistant, not the search engine it lives under. */
function testGeminiIsAiNotSearch() {
  const r = classifySource({
    referrer: 'https://gemini.google.com/app',
    selfHost: HOST,
    isPaid: false,
  });
  assert.equal(r.kind, 'ai');
}

function testUnparseableReferrerIsDirect() {
  assert.deepEqual(
    classifySource({ referrer: 'not a url', selfHost: HOST, isPaid: false }),
    { kind: 'direct', host: '' },
  );
}

const tests = [
  testFishingPathsDoNotCollapse,
  testSpotAdFrameIsTheSpot,
  testBothLandingShapes,
  testSingletonPages,
  testTrailingSlash,
  testSignedInSurfacesAreNotCounted,
  testHostAliasesCollapse,
  testNewsGoogleKeepsItsOwnRow,
  testSourceKinds,
  testOwnHostIsInternalNotDirect,
  testPaidBeatsTheReferrer,
  testGeminiIsAiNotSearch,
  testUnparseableReferrerIsDirect,
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
