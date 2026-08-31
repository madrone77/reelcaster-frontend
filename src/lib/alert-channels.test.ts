/**
 * Run with: npx tsx src/lib/alert-channels.test.ts
 *
 * The case worth guarding is the SMS-only heads-up. It read as a deliberate
 * quiet-hours rule and was actually a dropped message: three of the first four
 * heads-ups sent to SMS-only anglers were recorded as "No channel delivered",
 * which is a send that never happened wearing the clothes of a policy.
 */

import assert from 'node:assert/strict';
import { smsCarriesDigest, type DigestItemChannels } from './alert-channels';

const headsUp = (channels: string[]): DigestItemChannels => ({ beat: 'heads_up', channels });
const confirm = (channels: string[]): DigestItemChannels => ({ beat: 'confirm', channels });

// Email and SMS on the same alert: the phone stays quiet until a day is real.
assert.equal(smsCarriesDigest([headsUp(['email', 'sms'])]), false);
assert.equal(smsCarriesDigest([confirm(['email', 'sms'])]), true);

// A confirm anywhere in the digest earns the text, even riding with heads-ups.
assert.equal(
  smsCarriesDigest([headsUp(['email', 'sms']), confirm(['email', 'sms'])]),
  true,
);

// An alert that asked for texts and nothing else: the text is the only way to
// reach them, so it carries the heads-up.
assert.equal(smsCarriesDigest([headsUp(['sms'])]), true);

// ⚠️ The regression that matters. One email-only alert and one SMS-only alert
// in the same digest. Judged on the union of channels this reads as "they have
// email, so hold the heads-up" while the email is built only from the
// email-only alert and never mentions the SMS-only spot. That item would fall
// through both channels and be lost.
assert.equal(
  smsCarriesDigest([headsUp(['email']), headsUp(['sms'])]),
  true,
  'an SMS-only alert must still be texted when another alert happens to use email',
);

// The email-only item alone earns no text, even next to an email+sms heads-up.
assert.equal(
  smsCarriesDigest([headsUp(['email']), headsUp(['email', 'sms'])]),
  false,
);

// No SMS anywhere: never.
assert.equal(smsCarriesDigest([headsUp(['email']), confirm(['email'])]), false);
assert.equal(smsCarriesDigest([]), false);

console.log('alert-channels: ok');
