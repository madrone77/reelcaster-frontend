/**
 * Run with: npx tsx src/lib/attribution-wire.test.ts
 *
 * The one join this design cannot afford to get wrong.
 *
 * Middleware writes rc_entry with NextResponse.cookies.set. The browser writes
 * the same cookie with document.cookie in src/lib/cookies.ts. The checkout
 * route reads whichever one is there, off a raw Cookie header, with
 * readJsonCookie. If the two writers encode differently, every server-written
 * record decodes to null at exactly the moment it matters, and the failure is
 * silent: an unattributed sale looks the same as an organic one.
 */

import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';
import { ENTRY_COOKIE, ENTRY_MAX_AGE, buildEntry, readEntry } from './attribution';

const entry = buildEntry({
  pathname: '/explore/spot/point-robinson-e2e269',
  search: '?ad=today&utm_source=ig&utm_medium=paid&utm_campaign=120247627380030452&fbclid=IwY2xjawTx2y',
  referrer: 'https://l.instagram.com/',
  host: 'www.reelcaster.com',
});
assert.ok(entry);

const res = NextResponse.next();
res.cookies.set(ENTRY_COOKIE, JSON.stringify(entry), {
  path: '/',
  sameSite: 'lax',
  secure: true,
  maxAge: ENTRY_MAX_AGE,
});

const setCookie = res.headers.get('set-cookie');
assert.ok(setCookie, 'middleware must emit a Set-Cookie');

// What the browser sends back on the next request: the name=value pair only.
const jar = setCookie.split(';')[0];
const roundTripped = readEntry(jar);

assert.ok(roundTripped, 'the checkout route must be able to read what middleware wrote');
assert.equal(roundTripped.click_id, 'IwY2xjawTx2y');
assert.equal(roundTripped.click_type, 'fbclid');
assert.equal(roundTripped.utm_campaign, '120247627380030452');
assert.equal(roundTripped.entry_path, '/explore/spot/point-robinson-e2e269');
assert.equal(roundTripped.referrer, 'https://l.instagram.com/');

console.log('set-cookie:', setCookie.slice(0, 120), '...');
console.log('ok   middleware and the checkout route agree on the wire format');
