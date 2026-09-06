/**
 * Give a month, get a month: the browser-safe half.
 *
 * A referral link is reelcaster.com/r/<code>. Landing on it drops the code in
 * a cookie; the account created afterwards is stamped with it when it first
 * authenticates, by /api/attribution/signup, and that is where the two months
 * are granted (see ./referrals-server.ts, which is the half that needs the
 * service role and Stripe and must never reach a bundle).
 *
 * The cookie is the carrier for the same reason offer claims and attribution
 * use one: the boundary to survive is the navigation to /signup and, with
 * email confirmation on, a round trip through the inbox. See src/lib/offers.ts.
 */

import { readJsonCookie, writeJsonCookie } from './cookies';

export const REFERRAL_COOKIE = 'rc_ref';

/** 30 days, matching the offer cookie and for the same reasons. */
const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;

/** What each side of a referral is worth. The customer-facing promise. */
export const REFERRAL_DAYS = 30;

/**
 * How many months one account can earn in a rolling year. Twelve is the whole
 * plan, so a sponsor can never be owed more Pro than Pro costs, and it puts a
 * ceiling on what a farmed link is worth.
 */
export const REFERRAL_CAP_PER_YEAR = 12;

/**
 * Codes are 8 characters from an alphabet with no 0/O or 1/I, so one read
 * aloud at the dock survives the trip into a phone. Validated on every read
 * because the cookie is client-writable and the code lands in a lookup.
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/** Normalise a code the way a person typed it, then say whether it is one. */
export function parseReferralCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * Lower case in the URL. Production redirects any upper-case path to its
 * lower-case twin with a 308, and a shared link should not take that hop.
 * The code itself is case-insensitive on read (parseReferralCode upper-cases).
 */
export function referralPath(code: string): string {
  return `/r/${code.toLowerCase()}`;
}

interface ReferralClaim {
  code: string;
  ts: string;
}

/**
 * Remember that this visitor came in on `code`. Overwrites: the link you are
 * standing on is the friend who sent you. Write-once lives on the database
 * column, where it matters.
 */
export function captureReferral(referralCode: string): void {
  if (typeof window === 'undefined') return;
  // Distinct parameter and key names on purpose; see captureOffer for the
  // minifier bug that a shorthand `{ code }` tripped in production.
  writeJsonCookie(
    REFERRAL_COOKIE,
    { code: referralCode, ts: new Date().toISOString() },
    REFERRAL_MAX_AGE,
  );
}

/** The referral code this browser arrived on, or null. Pass a Cookie header server-side. */
export function readReferral(cookieHeader?: string): string | null {
  const claim = readJsonCookie<ReferralClaim>(REFERRAL_COOKIE, cookieHeader);
  return claim ? parseReferralCode(claim.code) : null;
}

/** The share copy, in one place so the card, the share sheet and the email agree. */
export function referralShareText(url: string): string {
  return `Here is a month of ReelCaster Pro on me: 14-day fishing forecasts for our water. ${url}`;
}
