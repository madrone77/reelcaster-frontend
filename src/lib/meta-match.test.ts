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
import {
  hashEmailForMeta,
  metaUserDataHashes,
  normalizeEmailForMeta,
  normalizeNameForMeta,
  normalizePhoneForMeta,
  splitNameForMeta,
} from './meta-match';

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

  // Phone: digits only, country code kept, plus dropped.
  assert.equal(normalizePhoneForMeta('+1 (604) 555-1234'), '16045551234');
  assert.equal(normalizePhoneForMeta('+16045551234'), '16045551234');
  assert.equal(normalizePhoneForMeta('123'), null);

  // Names: lowercase, punctuation gone, any script kept.
  assert.equal(normalizeNameForMeta("  O'Brien-Smith "), 'obriensmith');
  assert.equal(normalizeNameForMeta('Ødegård'), 'ødegård');
  assert.deepEqual(splitNameForMeta('Casey J. Bolton'), { first: 'casey', last: 'bolton' });
  assert.deepEqual(splitNameForMeta('Casey'), { first: 'casey', last: null });
  assert.deepEqual(splitNameForMeta(null), { first: null, last: null });

  // The bundle: every field hashed its own way, absent ones left out.
  const sha = (v: string) => createHash('sha256').update(v).digest('hex');
  assert.deepEqual(
    await metaUserDataHashes({ email: 'Casey@Example.com', phone: '+16045551234', fullName: 'Casey Bolton' }),
    { em: sha('casey@example.com'), ph: sha('16045551234'), fn: sha('casey'), ln: sha('bolton') },
  );
  assert.deepEqual(await metaUserDataHashes({ email: null, phone: null, fullName: null }), {});
  console.log('meta-match: ok');
})();
