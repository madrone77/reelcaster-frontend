/**
 * ReelCaster Pro pricing — one flat plan, billed monthly or yearly, in the
 * buyer's currency:
 *
 *   CAD: $5 / month · $33 / year        USD: $5 / month · $33 / year
 *
 * Every subscription starts with a free trial (TRIAL_DAYS): the card is
 * collected at checkout, $0 is charged today, and the first invoice lands when
 * the trial ends. The trial is granted per-session by the checkout route
 * (subscription_data.trial_period_days) and only to first-time subscribers —
 * it is not baked into the Stripe Price objects.
 *
 * Yearly is a 45% discount: twelve monthly payments would be $60, so the
 * annual plan saves $27 (45% off). See annualDiscount() for the derived math
 * the pricing UI renders.
 *
 * Stripe-side model: ONE product with TWO multi-currency Prices (CAD base +
 * a USD currency_option at the same amounts), so each price ID covers both
 * currencies. Checkout picks the presentment currency via the session-level
 * `currency` param. Price IDs come from STRIPE_MONTHLY_PRICE_ID /
 * STRIPE_ANNUAL_PRICE_ID; a plan whose ID is unset is refused by the
 * checkout route (503 plan_unavailable) rather than sent to Stripe.
 */

export type PricingPlan = 'monthly' | 'annual';
export type BillingCurrency = 'cad' | 'usd';

export const MONTHLY_PRICE_CENTS = 500; // $5 / month (CAD and USD alike)
export const ANNUAL_PRICE_CENTS = 3300; // $33 / year (CAD and USD alike)

/** Free-trial length, in days. Shared by checkout and every piece of UI copy. */
export const TRIAL_DAYS = 7;

export const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID ?? '';
export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? '';

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

/**
 * The savings story for the yearly plan, derived from the two prices above so
 * the copy can never drift from what a customer is actually charged.
 */
export function annualDiscount() {
  const fullCents = MONTHLY_PRICE_CENTS * 12; // $60 — twelve months at monthly
  const saveCents = fullCents - ANNUAL_PRICE_CENTS; // $27 saved
  const pct = Math.round((saveCents / fullCents) * 100); // 45% off
  const perMonthCents = Math.round(ANNUAL_PRICE_CENTS / 12); // ~$2.75 / month
  return { fullCents, saveCents, pct, perMonthCents };
}

export function priceIdFor(plan: PricingPlan): string {
  return plan === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
}
