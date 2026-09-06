/**
 * Run with: npx tsx src/lib/alert-tier.test.ts
 *
 * The case worth guarding: a cancelled trial. Before this rule the engine read
 * is_active alone, so every alert a trial created went on firing, SMS included,
 * with the account already free in user_settings.
 */

import assert from 'node:assert/strict';
import { applyTierToProfiles, NOT_PRO_EXTRA_ALERT } from './alert-tier';
import type { AlertProfile } from './custom-alert-engine';

const profile = (
  id: string,
  user_id: string,
  created_at: string,
  delivery_channels: string[] | null = ['email'],
): AlertProfile =>
  ({ id, user_id, created_at, delivery_channels, name: id, is_active: true }) as AlertProfile;

// A Pro owner keeps everything, channels untouched.
{
  const pro = [
    profile('a', 'u1', '2026-08-01', ['email', 'sms']),
    profile('b', 'u1', '2026-08-02', ['sms']),
  ];
  const out = applyTierToProfiles(pro, new Map([['u1', true]]));
  assert.deepEqual(out.allowed, pro);
  assert.equal(out.held.length, 0);
}

// ⚠️ The regression that matters: a cancelled trial with three alerts keeps
// only the oldest, by email, and the other two are held with a reason.
{
  const lapsed = [
    profile('newest', 'u2', '2026-09-01', ['email', 'sms']),
    profile('oldest', 'u2', '2026-08-20', ['email', 'sms']),
    profile('middle', 'u2', '2026-08-25', ['sms']),
  ];
  const out = applyTierToProfiles(lapsed, new Map([['u2', false]]));
  assert.equal(out.allowed.length, 1);
  assert.equal(out.allowed[0].id, 'oldest');
  assert.deepEqual(out.allowed[0].delivery_channels, ['email']);
  assert.deepEqual(
    out.held.map((h) => h.profile.id).sort(),
    ['middle', 'newest'],
  );
  assert.ok(out.held.every((h) => h.reason === NOT_PRO_EXTRA_ALERT));
}

// No user_settings row at all resolves to free, same as the rest of the app.
{
  const out = applyTierToProfiles([profile('only', 'u3', '2026-08-01', ['sms'])], new Map());
  assert.equal(out.allowed.length, 1);
  assert.deepEqual(out.allowed[0].delivery_channels, ['email']);
}

// A free account's single alert that asked for texts alone is not silenced:
// it falls back to email rather than being dropped.
{
  const out = applyTierToProfiles(
    [profile('smsonly', 'u4', '2026-08-01', ['sms'])],
    new Map([['u4', false]]),
  );
  assert.deepEqual(out.allowed[0].delivery_channels, ['email']);
}

// Same created_at ties break on id so the pick is stable across runs.
{
  const out = applyTierToProfiles(
    [profile('b', 'u5', '2026-08-01'), profile('a', 'u5', '2026-08-01')],
    new Map([['u5', false]]),
  );
  assert.equal(out.allowed[0].id, 'a');
}

// Users are independent: one lapsed owner does not touch a Pro owner's alerts.
{
  const out = applyTierToProfiles(
    [profile('p1', 'pro', '2026-08-01', ['sms']), profile('f1', 'free', '2026-08-01'), profile('f2', 'free', '2026-08-02')],
    new Map([['pro', true], ['free', false]]),
  );
  assert.deepEqual(out.allowed.map((p) => p.id).sort(), ['f1', 'p1']);
  assert.deepEqual(out.allowed.find((p) => p.id === 'p1')!.delivery_channels, ['sms']);
}

console.log('alert-tier: all assertions passed');
