/**
 * Offer links: a shareable URL that marks the account created after it as
 * having asked for a deal.
 *
 * What this is NOT: entitlement. Claiming an offer writes one string onto
 * `user_settings` and nothing else. The free year itself is granted by hand
 * from the bluecaster admin, which is the whole point — a URL that granted Pro
 * on its own would be a paywall bypass the moment someone forwarded it.
 *
 * The claim rides a cookie for the same reason attribution does: the boundary
 * it has to survive is the navigation to /signup and, when email confirmation
 * is on, a round trip through the inbox. Props and sessionStorage survive
 * neither. See src/lib/attribution.ts for the longer version of that argument.
 */

import { readJsonCookie, writeJsonCookie } from './cookies';

export const OFFER_COOKIE = 'rc_offer';

/**
 * 30 days. Long enough to cover "signed up on my phone at the dock, confirmed
 * the email on Sunday", short enough that a laptop which once visited an offer
 * page doesn't attach the claim to an unrelated account months later.
 */
const OFFER_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Every offer that exists. The claim is validated against this list server-side
 * before it is written, because a cookie is client-writable and the admin queue
 * groups on this column — an unchecked value would let anyone invent an offer
 * and appear in it.
 */
export const OFFER_CODES = ['first'] as const;

export type OfferCode = (typeof OFFER_CODES)[number];

/** Days of comped Pro each offer is worth, for the admin that approves it. */
export const OFFER_DAYS: Record<OfferCode, number> = {
  first: 365,
};

export function isOfferCode(value: unknown): value is OfferCode {
  return typeof value === 'string' && (OFFER_CODES as readonly string[]).includes(value);
}

interface OfferClaim {
  code: string;
  ts: string;
}

/**
 * Record that this visitor is here for `code`. Overwrites any existing cookie:
 * the offer page you are standing on is the one you are asking for. The
 * write-once rule that matters lives on the database column, not here — once a
 * claim is attached to an account, a later visit cannot move it out from under
 * an admin who is about to action it.
 */
export function captureOffer(code: OfferCode): void {
  if (typeof window === 'undefined') return;
  writeJsonCookie(OFFER_COOKIE, { code, ts: new Date().toISOString() }, OFFER_MAX_AGE);
}

/** The claimed offer, or null. Pass a Cookie header to read it server-side. */
export function readOffer(cookieHeader?: string): OfferCode | null {
  const claim = readJsonCookie<OfferClaim>(OFFER_COOKIE, cookieHeader);
  return claim && isOfferCode(claim.code) ? claim.code : null;
}
