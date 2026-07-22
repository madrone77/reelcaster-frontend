/**
 * ReelCaster Pro Intel pricing — flat and simple: $5/month or $33/year.
 *
 * Stripe Price IDs come from env so test/live mode can be swapped without a
 * code change:
 *   STRIPE_PRICE_MONTHLY — $5/mo recurring Price
 *   STRIPE_PRICE_ANNUAL  — $33/yr recurring Price
 *
 * The ID accessors are server-only (checkout + webhook). The *_CENTS constants
 * are safe to import from client components for display copy.
 */

export type PricingPlan = 'monthly' | 'annual';

export const MONTHLY_PRICE_CENTS = 500;
export const ANNUAL_PRICE_CENTS = 3300;

export function priceIdFor(plan: PricingPlan): string {
  const envName = plan === 'annual' ? 'STRIPE_PRICE_ANNUAL' : 'STRIPE_PRICE_MONTHLY';
  const id = process.env[envName];
  if (!id) throw new Error(`${envName} is not set`);
  return id;
}

// Non-throwing: the webhook must keep processing events even if env is
// misconfigured, defaulting unknown prices to the monthly tier.
export function isAnnualPriceId(priceId: string | null | undefined): boolean {
  return !!priceId && priceId === process.env.STRIPE_PRICE_ANNUAL;
}
