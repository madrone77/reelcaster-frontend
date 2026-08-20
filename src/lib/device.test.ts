/**
 * Run with: npx tsx src/lib/device.test.ts
 *
 * Every case here is a real User-Agent string, because the whole file is a
 * pile of substring tests and the only way one can be wrong is against a
 * string somebody actually sends. The ones that matter are the nested pairs:
 * Android inside Linux, ChromeOS inside Linux, and iPad inside Macintosh. Each
 * would silently file a whole platform under the wrong row.
 */

import assert from 'node:assert/strict';
import { classifyUserAgent, isBotUserAgent } from './device';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_LEGACY =
  'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 Mobile/15E148';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CHROMEOS =
  'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FB_IN_APP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.44.107]';
const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function testPlatforms() {
  assert.deepEqual(classifyUserAgent(IPHONE), { device: 'mobile', os: 'ios' });
  assert.deepEqual(classifyUserAgent(IPAD_LEGACY), { device: 'tablet', os: 'ios' });
  assert.deepEqual(classifyUserAgent(MAC), { device: 'desktop', os: 'macos' });
  assert.deepEqual(classifyUserAgent(WINDOWS), { device: 'desktop', os: 'windows' });
  assert.deepEqual(classifyUserAgent(LINUX), { device: 'desktop', os: 'linux' });
}

/**
 * The three nested strings. Every one of these fails by folding a platform
 * into a bigger one, which is invisible in the report: the row still has
 * traffic in it, it is just the wrong row.
 */
function testNestedStrings() {
  // "Linux; Android" must not read as Linux.
  assert.deepEqual(classifyUserAgent(ANDROID_PHONE), { device: 'mobile', os: 'android' });
  // Android tablets are told apart from phones only by the missing "Mobile".
  assert.deepEqual(classifyUserAgent(ANDROID_TABLET), { device: 'tablet', os: 'android' });
  // "X11; CrOS" must not read as Linux.
  assert.deepEqual(classifyUserAgent(CHROMEOS), { device: 'desktop', os: 'chromeos' });
  // An iPad in desktop mode sends a Macintosh UA; only "Mobile" gives it away.
  assert.deepEqual(classifyUserAgent(IPAD_DESKTOP_MODE), { device: 'tablet', os: 'ios' });
}

/**
 * Facebook's in-app browser is where a large share of paid social traffic
 * arrives, and its UA is an iPhone UA with a vendor tag bolted on. It has to
 * classify as an iPhone, not as an unknown.
 */
function testInAppBrowser() {
  assert.deepEqual(classifyUserAgent(FB_IN_APP), { device: 'mobile', os: 'ios' });
}

/**
 * Unknown is a real answer and must never be quietly promoted to desktop: a
 * desktop row that is secretly unknowns is worse than an unknown row.
 */
function testUnknowns() {
  assert.deepEqual(classifyUserAgent(''), { device: 'unknown', os: 'unknown' });
  assert.deepEqual(classifyUserAgent(null), { device: 'unknown', os: 'unknown' });
  assert.deepEqual(classifyUserAgent('Some Future Browser/1.0'), {
    device: 'unknown',
    os: 'unknown',
  });
}

/**
 * Bots are dropped rather than counted. A crawler can never press a button, so
 * counting it deflates the CTR of whichever variant happens to be crawled most.
 */
function testBots() {
  assert.equal(isBotUserAgent(GOOGLEBOT), true);
  assert.equal(isBotUserAgent('facebookexternalhit/1.1'), true);
  assert.equal(isBotUserAgent('curl/8.4.0'), true);
  assert.equal(isBotUserAgent(''), true, 'no header at all is not a browser');
  assert.equal(isBotUserAgent(IPHONE), false);
  assert.equal(isBotUserAgent(FB_IN_APP), false, 'the in-app browser is a person');
}

testPlatforms();
testNestedStrings();
testInAppBrowser();
testUnknowns();
testBots();
console.log('device.test.ts: all passed');
