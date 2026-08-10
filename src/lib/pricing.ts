/**
 * ReelCaster Pro pricing — ONE plan, billed yearly, in the buyer's currency:
 *
 *   CAD: $33 / year        USD: $33 / year
 *
 * There is no monthly plan to choose any more. $33 is low enough that a
 * cadence toggle was asking people to do arithmetic before they could buy, so
 * the copy does the division for them instead: $33 a year IS $2.75 a month
 * (`ANNUAL_PER_MONTH_CENTS`), which is the number every surface leads with.
 * Nothing sells monthly, so nothing has to explain a discount.
 *
 * Every subscription starts with a free trial (TRIAL_DAYS): a payment method is
 * collected at checkout, $0 is charged today, and the first invoice lands when
 * the trial ends. The trial is granted per-session by the checkout route
 * (subscription_data.trial_period_days) and only to first-time subscribers —
 * it is not baked into the Stripe Price object.
 *
 * Stripe-side model: ONE product with ONE multi-currency Price (CAD base + a
 * USD currency_option at the same amount), so the single price ID covers both
 * currencies. Checkout picks the presentment currency via the session-level
 * `currency` param. The price ID comes from STRIPE_ANNUAL_PRICE_ID; with it
 * unset the checkout route refuses (503 plan_unavailable) rather than sending
 * an empty price to Stripe.
 */

export type BillingCurrency = 'cad' | 'usd';

export const ANNUAL_PRICE_CENTS = 3300; // $33 / year (CAD and USD alike)

/**
 * $33 ÷ 12, the way the price is actually pitched. Derived rather than typed
 * out so the "that's $2.75 a month" line can never drift from what a customer
 * is charged — change ANNUAL_PRICE_CENTS and every surface follows.
 */
export const ANNUAL_PER_MONTH_CENTS = Math.round(ANNUAL_PRICE_CENTS / 12);

/** Free-trial length, in days. Shared by checkout and every piece of UI copy. */
export const TRIAL_DAYS = 7;

export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? '';

/**
 * LEGACY. The old $5/month plan, which is no longer sold anywhere.
 *
 * Customers who subscribed monthly before the switch are still on it and still
 * billing, so the webhook needs this to label their renewal and payment-failure
 * emails with the amount they actually pay. Nothing customer-facing may use it
 * to *sell* — the only reader is `amountLabelForTier` in the Stripe webhook.
 */
export const LEGACY_MONTHLY_PRICE_CENTS = 500;

/** "$33", "$2.75" — trailing cents only when there are any. */
export function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

/**
 * Region → billing currency. BC buys in CAD; WA/OR in USD. When no region is
 * known (paywall CTAs post region '') the caller may pass the request's
 * x-vercel-ip-country header; a Canadian IP gets CAD, any other known country
 * USD, and with no signal at all we default to CAD (the account's home
 * currency).
 */
export function currencyForRegion(
  region: string | null | undefined,
  ipCountry?: string | null,
): BillingCurrency {
  const r = (region ?? '').trim().toUpperCase();
  if (r === 'BC') return 'cad';
  if (r === 'WA' || r === 'OR') return 'usd';
  const c = (ipCountry ?? '').trim().toUpperCase();
  if (c === 'CA') return 'cad';
  if (c) return 'usd';
  return 'cad';
}

/** Uppercase label for UI copy ("Billed in CAD"). */
export function currencyLabelForRegion(
  region: string | null | undefined,
): 'CAD' | 'USD' {
  return currencyForRegion(region) === 'cad' ? 'CAD' : 'USD';
}
