import assert from 'node:assert/strict';
import { safeReturnPath } from './trial-return';

// The page a reader goes back to from Stripe's arrow: ours, and nothing else.
assert.equal(safeReturnPath('/fishing/us/wa/seattle?ad=today'), '/fishing/us/wa/seattle?ad=today');
assert.equal(safeReturnPath('/explore?loc=seattle-wa&ad=today'), '/explore?loc=seattle-wa&ad=today');

// Never another origin, however it is spelled.
for (const bad of [
  'https://evil.example/',
  '//evil.example/',
  '/\\evil.example',
  'evil.example',
  'javascript:alert(1)',
  '',
  null,
  undefined,
  42,
  '/' + 'a'.repeat(600),
]) {
  assert.equal(safeReturnPath(bad), null, String(bad).slice(0, 40));
}

// Never back into the billing hop itself or an API route.
assert.equal(safeReturnPath('/billing/cancel?back=/x'), null);
assert.equal(safeReturnPath('/api/stripe/checkout'), null);

console.log('trial-return: ok');
