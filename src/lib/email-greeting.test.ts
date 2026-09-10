/**
 * Run with: npx tsx src/lib/email-greeting.test.ts
 *
 * Every email that opens by name, checked for the same three things: the
 * greeting is there when we hold a name, the line is ABSENT rather than
 * generic when we do not, and the name is escaped on the way in.
 *
 * The absent case is the one worth a test. 13 of 83 accounts have given us no
 * name by any route, and the failure mode is not a crash: it is a perfectly
 * well-formed email that opens "Hi ," or "Hi Angler," to a sixth of the list.
 */

import assert from 'node:assert/strict';
import { welcomeEmail } from './email-templates/welcome';
import { trialEndingEmail, proLapsedEmail } from './email-templates/billing';

const TRIAL_END = '2026-09-17T15:04:00.000Z';

/** Every send that carries a greeting, as a name-in / html-out function. */
const EMAILS: Array<[string, (firstName?: string | null) => string]> = [
  [
    'welcome (trial)',
    (firstName) =>
      welcomeEmail({
        variant: 'trial',
        firstName,
        trialEndsAt: TRIAL_END,
        amountLabel: '$33',
      }).html,
  ],
  ['welcome (free)', (firstName) => welcomeEmail({ variant: 'free', firstName }).html],
  [
    'trial reminder',
    (firstName) =>
      trialEndingEmail({
        trialEndsAt: TRIAL_END,
        amountLabel: '$33',
        firstName,
        setup: { savedSpots: 0, activeAlerts: 0 },
      }).html,
  ],
  [
    'lapse notice',
    (firstName) => proLapsedEmail({ amountLabel: '$33', canResume: true, firstName }).html,
  ],
];

for (const [name, render] of EMAILS) {
  const greeted = render('Nick');
  assert.ok(greeted.includes('Hi Nick,'), `${name}: greets by name`);

  // Above the heading, not buried mid-body.
  assert.ok(
    greeted.indexOf('Hi Nick,') < greeted.indexOf('<h1'),
    `${name}: greeting comes before the heading`,
  );

  // No name: no line. Not "Hi ," and not "Hi Angler,".
  const cold = render(null);
  assert.ok(!/Hi\s*,/.test(cold), `${name}: no empty greeting`);
  assert.ok(!cold.includes('Angler'), `${name}: no generic greeting`);
  // The email without a greeting is a whole email, not a truncated one: the
  // heading it now opens with has to be there.
  assert.ok(cold.includes('<h1'), `${name}: still renders its heading`);

  // Whitespace is not a name either.
  assert.ok(!/Hi\s*,/.test(render('   ')), `${name}: whitespace is not a name`);

  // The only text in these templates typed by somebody outside the company.
  const injected = render('<b>x"y');
  assert.ok(
    injected.includes('Hi &lt;b&gt;x&quot;y,'),
    `${name}: escapes the name`,
  );
  assert.ok(!injected.includes('<b>x'), `${name}: no raw markup from a name`);
}

console.log(`email greeting: ${EMAILS.length} templates, all cases pass`);
