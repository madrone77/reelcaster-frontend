/**
 * Run with: npx tsx src/lib/display-name.test.ts
 *
 * Two names with two different standards, which is the whole point of the file:
 * a first name somebody typed into our signup form is used as given, and a
 * cardholder name is checked first because nobody offered it as a display name.
 * The cases below are the shapes a payment form's name field really comes back
 * in.
 */

import assert from 'node:assert/strict';
import type { User } from '@supabase/supabase-js';
import {
  cardholderFirstName,
  greetingFirstName,
  resolveFirstName,
  storedFirstName,
  NAME_FALLBACK,
} from './display-name';

function user(metadata: Record<string, unknown>): User {
  return { id: 'u1', user_metadata: metadata } as unknown as User;
}

// ── The name they gave us, used as given ──────────────────────────
{
  assert.equal(storedFirstName(user({ first_name: 'Nick' })), 'Nick');
  assert.equal(storedFirstName(user({ full_name: 'Christopher Manning' })), 'Christopher');
  assert.equal(storedFirstName(user({ given_name: 'Pete', name: 'Pete Soos' })), 'Pete');
  assert.equal(storedFirstName(user({})), null);
  // Not touched, even where a cardholder name would be refused. They typed it.
  assert.equal(storedFirstName(user({ first_name: 'JT' })), 'JT');
}

// ── The name on the card, checked before it is used ───────────────
{
  assert.equal(cardholderFirstName('Christopher Manning'), 'Christopher');
  assert.equal(cardholderFirstName('  Nick  '), 'Nick');
  assert.equal(cardholderFirstName(null), null);
  assert.equal(cardholderFirstName('   '), null);
}

// A card is printed in capitals and people type it that way. "Hi NICK," is
// shouting at somebody who is not.
{
  assert.equal(cardholderFirstName('NICK SEVORES'), 'Nick');
  assert.equal(cardholderFirstName('MCDONALD'), 'Mcdonald');
  // A single letter cannot be shouting, and lowering it would be wrong.
  assert.equal(cardholderFirstName('K'), 'K');
  // A normal name is left exactly alone, including one that is legitimately
  // mixed case.
  assert.equal(cardholderFirstName('McTavish'), 'McTavish');
}

// The payment form's name field collects things that are not names.
{
  assert.equal(cardholderFirstName('nick@gmail.com'), null, 'an email is not a name');
  assert.equal(cardholderFirstName('Order 44821'), null, 'a digit means it is a reference');
  assert.equal(
    cardholderFirstName('Averylongstringsomebodypastedintothefield'),
    null,
    'past 24 characters it is a paste',
  );
}

// ── The order, and the absence of a fallback ──────────────────────
{
  // Theirs wins over the card's, even when the card is fuller.
  assert.equal(
    greetingFirstName(user({ first_name: 'Chris' }), 'Christopher Manning'),
    'Chris',
  );
  assert.equal(greetingFirstName(user({}), 'Christopher Manning'), 'Christopher');
  // Null, NOT "Angler". A greeting is optional; an email opening "Hi Angler,"
  // is worse than one that opens with its heading.
  assert.equal(greetingFirstName(user({}), null), null);
  assert.equal(greetingFirstName(user({}), 'nick@gmail.com'), null);
  // The UI slot still gets its literal fallback, from the other function.
  assert.equal(resolveFirstName(user({})), NAME_FALLBACK);
}

console.log('display-name: all cases pass');
