/**
 * Advanced matching for the Meta pixel: the hashed email that lets Meta tie an
 * event to a person when the click cookie has not survived.
 *
 * WHY. Events Manager on 2026-09-08 showed Start trial matching at 3.0/10
 * against 6.1 for everything else. StartTrial is the one event that fires
 * after a round trip through Stripe, and on the way back part of the traffic
 * has lost `_fbc`: in-app browsers, a magic-link bounce into another browser,
 * a tab closed and reopened. We sent nothing else to match on. A hashed email
 * is the identifier Meta weights highest, and it is in our hands at exactly
 * the two moments that matter: in the required field when Begin checkout is
 * tapped, and on the Stripe customer when the success page confirms the trial.
 *
 * META'S NORMALISATION, NOT OURS. src/lib/trial.ts has `normalizeEmail`, which
 * strips plus-tags and Gmail dots so that one person cannot take two trials.
 * That is the right rule for us and the wrong one here: Meta hashes what the
 * person typed on THEIR side (lowercased, trimmed) and compares hashes, so a
 * hash of our canonical form would never match theirs for `casey+ads@` or
 * `c.a.sey@gmail.com`. This file hashes what Meta hashes.
 *
 * SHA-256 hex, lowercase, of the trimmed lowercased address, which is the
 * pre-hashed form Meta accepts for `em`. Hashed here rather than handing the
 * pixel the raw address: the pixel would hash it anyway, and a hash on the
 * wire is one fewer place the address is.
 *
 * Isomorphic on purpose: `globalThis.crypto.subtle` exists in every browser
 * this app supports and in Node 20+, so the success-page route and the
 * checkout form call the same function and cannot drift.
 */

export function normalizeEmailForMeta(email: string): string {
  return email.trim().toLowerCase();
}

/** Null when there is nothing hashable: no `@`, or no SubtleCrypto. */
export async function hashEmailForMeta(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const normalized = normalizeEmailForMeta(email);
  if (!normalized.includes('@')) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}
