/**
 * Shared vocabulary for the in-page wallet purchase (Apple Pay / Google Pay).
 *
 * An express purchase never creates a Stripe Checkout Session — the SetupIntent
 * the wallet confirms is the only id the browser ever holds. Two routes have to
 * agree on how to recognise one of ours:
 *
 *   /api/stripe/express-checkout  stamps it,
 *   /api/stripe/claim             accepts it as proof of purchase in place of a
 *                                 `cs_` session id.
 */

/** Metadata key stamped on every SetupIntent this integration creates. */
export const EXPRESS_MARKER = 'reelcaster_express_checkout';

/** Ids the claim route will look at. Checkout Sessions are `cs_`. */
export function isExpressSetupIntentId(id: string): boolean {
  return id.startsWith('seti_');
}
