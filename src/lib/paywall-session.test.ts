/**
 * Run with: npx tsx src/lib/paywall-session.test.ts
 *
 * The cases that matter are the two expiries, because they are the whole of
 * the promise this cookie makes. A session that quietly outlives its absolute
 * cap is no longer a session id, it is a durable identifier for that browser,
 * and it would have become one silently.
 */

import assert from 'node:assert/strict';
import {
  SESSION_COOKIE,
  isExpired,
  parseSession,
  readSessionId,
  resolveSession,
  serializeSession,
} from './paywall-session';

const NOW = 1_800_000_000_000;
const HOUR = 1000 * 60 * 60;

// ── Round trip ────────────────────────────────────────────────────────
{
  const session = { id: 'a1b2c3d4-0000-4000-8000-000000000000', mintedAt: NOW };
  const parsed = parseSession(serializeSession(session));
  assert.deepEqual(parsed, session, 'a serialized session parses back to itself');
}

// ── Malformed values are no session, never a repaired one ─────────────
{
  assert.equal(parseSession(''), null);
  assert.equal(parseSession(undefined), null);
  assert.equal(parseSession('no-timestamp'), null);
  assert.equal(parseSession('.123'), null, 'empty id');
  assert.equal(parseSession('abc.notanumber'), null);
  assert.equal(parseSession('abc.0'), null, 'a zero mint time is not a time');
  assert.equal(
    parseSession('has spaces.123'),
    null,
    'an id outside the character set is refused rather than sanitized',
  );
}

// ── The absolute cap ──────────────────────────────────────────────────
{
  const fresh = { id: 'a1b2c3d4', mintedAt: NOW };
  assert.equal(isExpired(fresh, NOW + 5 * HOUR), false, 'five hours is inside the cap');
  assert.equal(isExpired(fresh, NOW + 7 * HOUR), true, 'seven hours is past it');

  // The one that would have gone unnoticed: a tab active all day keeps
  // refreshing the 30-minute window, so only this check ever ends the session.
  const rolled = resolveSession(serializeSession(fresh), NOW + 7 * HOUR);
  assert.notEqual(rolled.id, fresh.id, 'past the cap, a new id is minted');
  assert.equal(rolled.mintedAt, NOW + 7 * HOUR, 'and the clock starts over');
}

// ── Inside both windows, the id is kept ───────────────────────────────
{
  const existing = { id: 'a1b2c3d4', mintedAt: NOW };
  const same = resolveSession(serializeSession(existing), NOW + HOUR);
  assert.deepEqual(same, existing, 'an hour in, the same visit continues');
}

// ── No cookie at all mints one ────────────────────────────────────────
{
  const minted = resolveSession(null, NOW);
  assert.equal(minted.mintedAt, NOW);
  assert.ok(minted.id.length >= 8, 'a real id, not an empty string');
}

// ── Reading one out of a Cookie header ────────────────────────────────
{
  const header = `foo=bar; ${SESSION_COOKIE}=a1b2c3d4.${NOW}; baz=qux`;
  assert.equal(readSessionId(header), 'a1b2c3d4');
  assert.equal(readSessionId('foo=bar'), null, 'absent means null, not a new id');
  assert.equal(
    readSessionId(`${SESSION_COOKIE}=garbage`),
    null,
    'an unparseable cookie is no session rather than a session called "garbage"',
  );
}

console.log('paywall-session: ok');
