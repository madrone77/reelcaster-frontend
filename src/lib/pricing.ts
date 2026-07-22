/**
 * ReelCaster Pro pricing — flat and simple: $5/month or $33/year.
 *
 * Previously this was a per-calendar-month seasonal table plus a $79 "Season
 * Pass". That was more complexity than it earned, so pricing is now two flat
 * plans. The `resolveMonthly*` helpers are kept (returning the flat values) so
 * the Stripe routes and marketing copy don't need to change shape.
 *
 * ⚠ Stripe: monthly reuses the existing $5 Price. There is NO $33/yr Price yet —
 * create one in Stripe and set STRIPE_ANNUAL_PRICE_ID. Until then ANNUAL_PRICE_ID
 * is empty and annual checkout fails cleanly (Stripe rejects it) rather than
 * charging the wrong amount.
 */

export type PricingPlan = 'monthly' | 'annual';

export const MONTHLY_PRICE_CENTS = 500; // $5 / month
export const ANNUAL_PRICE_CENTS = 3300; // $33 / year

// Monthly reuses the existing $5 Stripe Price; overridable via env.
export const MONTHLY_PRICE_ID =
  process.env.STRIPE_MONTHLY_PRICE_ID ?? 'price_1TQpJa2a2BXhmPNuiKaaurSJ';
// Annual ($33) has no Stripe Price yet — set STRIPE_ANNUAL_PRICE_ID once created.
// Empty until then so annual checkout errors instead of mischarging.
export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? '';

export function resolveMonthlyPriceId(): string {
  return MONTHLY_PRICE_ID;
}

export function resolveMonthlyPriceCents(): number {
  return MONTHLY_PRICE_CENTS;
}

export function priceCentsFor(plan: PricingPlan): number {
  return plan === 'annual' ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS;
}

export function priceIdFor(plan: PricingPlan): string {
  return plan === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
}
