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
 * SHA-256 hex, lowercase, of the normalised value, which is the pre-hashed
 * form Meta accepts for `em`, `ph`, `fn` and `ln`. Phone and name arrived
 * later (2026-09-08, same day): Stripe holds the billing name by the time the
 * success page confirms a trial, and a verified SMS-alert number is on the
 * account by the time the day-7 purchase is uploaded. Hashed here rather than handing the
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

/** Lowercase hex SHA-256, or null when SubtleCrypto is unavailable. */
export async function sha256HexForMeta(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/** Null when there is nothing hashable: no `@`, or no SubtleCrypto. */
export async function hashEmailForMeta(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const normalized = normalizeEmailForMeta(email);
  if (!normalized.includes('@')) return null;
  return sha256HexForMeta(normalized);
}

/**
 * Meta's phone rule: digits only, with the country code and without the
 * leading `+` or any punctuation. Our numbers are stored E.164 (`+16045551234`)
 * so this is strip-the-plus; the digit filter is for anything typed by hand.
 * Null for anything too short to be a number.
 */
export function normalizePhoneForMeta(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

/**
 * Meta's name rule: lowercase, no punctuation, UTF-8. Letters in any script
 * are kept (so "Ødegård" survives), everything that is not a letter, digit or
 * space is dropped, and spaces are collapsed.
 */
export function normalizeNameForMeta(name: string): string | null {
  const out = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}

/**
 * Stripe holds one billing name ("Casey Bolton"); Meta wants `fn` and `ln`.
 * First word and last word; a single word is a first name with no last.
 */
export function splitNameForMeta(fullName: string | null | undefined): {
  first: string | null;
  last: string | null;
} {
  const normalized = fullName ? normalizeNameForMeta(fullName) : null;
  if (!normalized) return { first: null, last: null };
  const parts = normalized.split(' ');
  return { first: parts[0] ?? null, last: parts.length > 1 ? (parts[parts.length - 1] ?? null) : null };
}

/** The pre-hashed advanced-matching fields, keyed as Meta names them. */
export interface MetaUserDataHashes {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
}

/**
 * Everything we know about a person, hashed Meta's way, as the object that
 * goes to `fbq('init')` on the browser side or `user_data` on the server side.
 * Absent and unhashable inputs are simply left out.
 */
export async function metaUserDataHashes(input: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<MetaUserDataHashes> {
  const out: MetaUserDataHashes = {};
  const em = await hashEmailForMeta(input.email);
  if (em) out.em = em;
  const phone = input.phone ? normalizePhoneForMeta(input.phone) : null;
  if (phone) {
    const ph = await sha256HexForMeta(phone);
    if (ph) out.ph = ph;
  }
  const split = splitNameForMeta(input.fullName);
  const first = input.firstName ? normalizeNameForMeta(input.firstName) : split.first;
  const last = input.lastName ? normalizeNameForMeta(input.lastName) : split.last;
  if (first) {
    const fn = await sha256HexForMeta(first);
    if (fn) out.fn = fn;
  }
  if (last) {
    const ln = await sha256HexForMeta(last);
    if (ln) out.ln = ln;
  }
  return out;
}
