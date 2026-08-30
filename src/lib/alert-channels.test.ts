/**
 * Run with: npx tsx src/lib/alert-channels.test.ts
 *
 * The case worth guarding is the SMS-only heads-up. It read as a deliberate
 * quiet-hours rule and was actually a dropped message: three of the first four
 * heads-ups sent to SMS-only anglers were recorded as "No channel delivered",
 * which is a send that never happened wearing the clothes of a policy.
 */

import assert from 'node:assert/strict';
import { smsCarriesDigest } from './alert-channels';

// Email and SMS: the phone stays quiet until a day is real. A digest counts as
// real if anything in it is a confirm, even when heads-ups ride along with it.
assert.equal(smsCarriesDigest(['heads_up'], ['email', 'sms']), false);
assert.equal(smsCarriesDigest(['confirm'], ['email', 'sms']), true);
assert.equal(smsCarriesDigest(['heads_up', 'confirm'], ['email', 'sms']), true);

// SMS only: everything goes by text, because nothing else can carry it.
assert.equal(smsCarriesDigest(['heads_up'], ['sms']), true);
assert.equal(smsCarriesDigest(['confirm'], ['sms']), true);

// No SMS at all: never, whatever the digest holds.
assert.equal(smsCarriesDigest(['heads_up'], ['email']), false);
assert.equal(smsCarriesDigest(['confirm'], ['email']), false);
assert.equal(smsCarriesDigest([], []), false);

console.log('alert-channels: ok');
