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

/**
 * The nesting cases. Each of these paths is a prefix of the one before it.
 *
 * These match on segment count, so adding the country segment moved every one
 * of them by one. Before this was updated, /fishing/us/wa read as a city and
 * /fishing/us/wa/seattle as a city-species: no error, just every row in the
 * wrong bucket.
 */
function testFishingPathsDoNotCollapse() {
  assert.deepEqual(classifyPage('/fishing/us'), {
    kind: 'province',
    slug: 'us',
  });
  assert.deepEqual(classifyPage('/fishing/us/wa'), {
    kind: 'province',
    slug: 'us/wa',
  });
  assert.deepEqual(classifyPage('/fishing/us/wa/seattle'), {
    kind: 'city',
    slug: 'us/wa/seattle',
  });
  assert.deepEqual(classifyPage('/fishing/us/wa/seattle/species/chinook-salmon'), {
    kind: 'city-species',
    slug: 'us/wa/seattle/chinook-salmon',
  });
  // A spot sits at the same depth as the guides' `species` segment, and only
  // that literal separates them.
  assert.deepEqual(classifyPage('/fishing/us/wa/seattle/point-robinson-e2e269'), {
    kind: 'spot',
    slug: 'point-robinson-e2e269',
  });
}

/**
 * The ad frame is a rewrite of the same page and must not read as a new one.
 *
 * The retired /explore/spot/<slug> is still counted, and counted as the SAME
 * slug as the canonical path. Published spots 308 off it, but private custom
 * spots never leave it, and keying on the slug rather than the whole path is
 * what keeps one spot's counts continuous across the move instead of splitting
 * them into a before and an after.
 */
function testSpotAdFrameIsTheSpot() {
  const expected = { kind: 'spot', slug: 'point-robinson-e2e269' };
  for (const path of [
    '/fishing/us/wa/seattle/point-robinson-e2e269',
    '/fishing/us/wa/seattle/point-robinson-e2e269/ad',
    '/explore/spot/point-robinson-e2e269',
    '/explore/spot/point-robinson-e2e269/ad',
  ]) {
    assert.deepEqual(classifyPage(path), expected, path);
  }
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
  assert.deepEqual(classifyPage('/fishing/us/wa/seattle/'), {
    kind: 'city',
    slug: 'us/wa/seattle',
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
  assert.ok(classifyPage('/fishing/ca/bc/plans-inlet'));
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

/**
 * Android in-app referrers name a PACKAGE, not a site, and land on the wrong
 * source kind entirely if left unmapped.
 *
 * The Google case is real: a live trial on 2026-08-28 arrived from the Google
 * app and would have counted as `referral` rather than `search`. The Meta cases
 * are the expensive ones -- Meta's Android in-app browser sends its package
 * where its iOS one sends nothing, and about half our Meta ads carry no URL
 * parameters, so on those visits this referrer is the only evidence of Meta at
 * all.
 */
function testAndroidAppReferrers() {
  const from = (referrer: string) =>
    classifySource({ referrer, selfHost: HOST, isPaid: false });

  assert.deepEqual(from('android-app://com.google.android.googlequicksearchbox/'), {
    kind: 'search',
    host: 'google.com',
  });
  assert.deepEqual(from('android-app://com.instagram.android/'), {
    kind: 'social',
    host: 'instagram.com',
  });
  assert.deepEqual(from('android-app://com.facebook.katana/'), {
    kind: 'social',
    host: 'facebook.com',
  });
  // An unmapped package degrades to a plain referral under its own name, which
  // is what "we have not seen this app before" should look like.
  assert.deepEqual(from('android-app://com.example.unknown/'), {
    kind: 'referral',
    host: 'com.example.unknown',
  });
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
  testAndroidAppReferrers,
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
