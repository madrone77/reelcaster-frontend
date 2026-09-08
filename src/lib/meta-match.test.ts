/**
 * Run with: npx tsx src/lib/meta-match.test.ts
 *
 * The hash has to be the one Meta computes on its side, or advanced matching
 * silently matches nobody. So the normalisation is pinned to Meta's rule
 * (trim, lowercase, nothing else) and the digest is checked against a known
 * SHA-256 rather than against itself.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashEmailForMeta, normalizeEmailForMeta } from './meta-match';

assert.equal(normalizeEmailForMeta('  Casey@Example.COM '), 'casey@example.com');
// Plus-tags and dots stay: Meta hashes what the person typed.
assert.equal(normalizeEmailForMeta('casey+ads@gmail.com'), 'casey+ads@gmail.com');
assert.equal(normalizeEmailForMeta('c.a.sey@gmail.com'), 'c.a.sey@gmail.com');

(async () => {
  const expected = createHash('sha256').update('casey@example.com').digest('hex');
  assert.equal(await hashEmailForMeta('  Casey@Example.COM '), expected);
  assert.equal(await hashEmailForMeta(''), null);
  assert.equal(await hashEmailForMeta(null), null);
  assert.equal(await hashEmailForMeta('not an email'), null);
  console.log('meta-match: ok');
})();
