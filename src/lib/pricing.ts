/**
 * ReelCaster Pro pricing — one flat plan, billed monthly or yearly.
 *
 *   $5 / month   ·   $33 / year
 *
 * Yearly is a 45% discount: twelve monthly payments would be $60, so the
 * annual plan saves $27 (45% off). See annualDiscount() for the derived math
 * the pricing UI renders.
 *
 * Price IDs come from Stripe. The monthly $5 price already exists; the annual
 * $33 price must be created in Stripe and supplied via STRIPE_ANNUAL_PRICE_ID
 * (until then, annual checkout is disabled and only monthly can be purchased).
 */

export type PricingPlan = 'monthly' | 'annual';

export const MONTHLY_PRICE_CENTS = 500; // $5 / month
export const ANNUAL_PRICE_CENTS = 3300; // $33 / year

// Stripe Price IDs. Monthly is the existing $5 price; annual needs a new $33
// price wired through the env (see the file header).
export const MONTHLY_PRICE_ID =
  process.env.STRIPE_MONTHLY_PRICE_ID ?? 'price_1TQpJa2a2BXhmPNuiKaaurSJ';
export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? '';

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

export function priceCentsFor(plan: PricingPlan): number {
  return plan === 'annual' ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS;
}

export function priceIdFor(plan: PricingPlan): string {
  return plan === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
}

// Back-compat shims for the checkout + webhook routes, which resolve the
// monthly price without knowing the model is now flat.
export function resolveMonthlyPriceId(): string {
  return MONTHLY_PRICE_ID;
}

export function resolveMonthlyPriceCents(): number {
  return MONTHLY_PRICE_CENTS;
}
