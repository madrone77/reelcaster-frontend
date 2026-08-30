/**
 * Run with: npx tsx src/lib/alert-channels.test.ts
 *
 * The case worth guarding is the SMS-only heads-up. It read as a deliberate
 * quiet-hours rule and was actually a dropped message: three of the first four
 * heads-ups sent to SMS-only anglers were recorded as "No channel delivered",
 * which is a send that never happened wearing the clothes of a policy.
 */

import assert from 'node:assert/strict';
import { smsCarriesBeat } from './alert-channels';

// Email and SMS: the phone stays quiet until the day is real.
assert.equal(smsCarriesBeat('heads_up', ['email', 'sms']), false);
assert.equal(smsCarriesBeat('confirm', ['email', 'sms']), true);
assert.equal(smsCarriesBeat('stand_down', ['email', 'sms']), true);

// SMS only: every beat goes by text, because nothing else can carry it.
assert.equal(smsCarriesBeat('heads_up', ['sms']), true);
assert.equal(smsCarriesBeat('confirm', ['sms']), true);
assert.equal(smsCarriesBeat('stand_down', ['sms']), true);

// No SMS at all: never, whatever the beat.
assert.equal(smsCarriesBeat('heads_up', ['email']), false);
assert.equal(smsCarriesBeat('confirm', ['email']), false);
assert.equal(smsCarriesBeat('stand_down', []), false);

console.log('alert-channels: ok');
