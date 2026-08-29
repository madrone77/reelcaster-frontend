/**
 * A free account is a conversion. This file is the contract that says so.
 *
 * Everything about a signup is reported twice, from two machines that never
 * talk to each other: the browser fires Plausible and the Meta pixel the moment
 * the account first authenticates, and the server writes a `marketing_conversions`
 * row that the hourly drain posts to the Conversions API. The two halves have to
 * agree on the event id and on the value or Meta counts one signup as two and
 * bids on a number twice the truth. Both halves import from here so there is one
 * place to change and no way for them to drift.
 *
 * WHY A FREE SIGNUP IS WORTH REPORTING AT ALL. A trial start is the event that
 * matters, and there are not enough of them: Meta needs roughly 30 conversions a
 * month before its bidding learns anything, and at this volume the trial event
 * never gets there. Signups do. Reporting them gives the optimiser something to
 * learn from now, at the cost of teaching it to find people who sign up rather
 * than people who pay. That trade is only worth taking while the trial count is
 * below the learning threshold; once it is above, bid on trials instead.
 */

/**
 * What one free account is worth, in cents, for reporting only.
 *
 * Not money. Nothing in billing or revenue reads this, and no Stripe amount is
 * ever derived from it. It exists so the ad networks can see a free signup as
 * something other than zero, and so the admin can put a number on a week of
 * free forecasts.
 *
 * The figure is a placeholder standing for roughly a 3% signup-to-paid rate
 * against a CA$33 subscription. It is a guess and should be replaced the moment
 * the funnel can answer it: divide purchases by signups over a window longer
 * than the trial, multiply by average first-year revenue, and change this line.
 * Recomputing it is a one-line pull request on purpose. An env var would have
 * to be set twice, once public for the browser and once for the server, and the
 * day those two disagree is the day the dedupe silently stops working.
 */
export const SIGNUP_MODELED_VALUE_CENTS = 100;

/**
 * The currency the modeled value is quoted in. Fixed, unlike a real purchase:
 * a modeled figure is not a charge, so there is nothing to convert and nothing
 * that varies by buyer. Real money reads `subscription.currency` instead, and
 * the one multi-currency Price always reports `cad` regardless of the buyer.
 */
export const SIGNUP_VALUE_CURRENCY = 'cad';

/**
 * The id both halves of the signup event carry.
 *
 * Meta deduplicates a browser event against a server event when the event name
 * and this id both match, so the shape has to be derived from something both
 * sides know without asking each other. The Stripe events key theirs on the
 * subscription id (see conversion-upload.ts); a signup has no subscription, so
 * it keys on the account instead.
 */
export function signupEventId(userId: string): string {
  return `user:${userId}:signup`;
}

/**
 * The Meta standard event a signup reports as.
 *
 * A standard name rather than a custom one, for the same reason as StartTrial:
 * Meta's models are pre-trained on these, and a custom event starts cold and
 * needs volume we do not have.
 */
export const META_SIGNUP_EVENT = 'CompleteRegistration' as const;
