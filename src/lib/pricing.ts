/**
 * ReelCaster Pro Intel pricing — Stripe Price IDs and seasonal price map.
 *
 * Monthly subscriptions are utility-priced by calendar month: peak fishing season
 * costs more, off-season costs less. Annual is a flat $79 (cheaper than 12×$15).
 *
 * To resolve the *current* monthly Price at checkout, call resolveMonthlyPriceId()
 * which uses the user's local month at the moment of upgrade.
 */

export type PricingPlan = 'monthly' | 'annual';

export const ANNUAL_PRICE_ID = 'price_1TQpJW2a2BXhmPNuF9igUK0H'; // $79/yr

// Index 0 = January, index 11 = December.
// Prices in USD cents matching the spec: $5 off-season, $10 shoulder, $15 peak.
export const MONTHLY_PRICE_TABLE: Array<{
  month: number; // 1-12
  label: string;
  amountCents: number;
  priceId: string;
}> = [
  { month: 1, label: 'Jan', amountCents: 500, priceId: 'price_1TQpJa2a2BXhmPNuiKaaurSJ' },
  { month: 2, label: 'Feb', amountCents: 500, priceId: 'price_1TQpJe2a2BXhmPNuYRTewOoU' },
  { month: 3, label: 'Mar', amountCents: 1000, priceId: 'price_1TQpJi2a2BXhmPNuNGLc4ZTM' },
  { month: 4, label: 'Apr', amountCents: 1500, priceId: 'price_1TQpJm2a2BXhmPNuTO1dtDX8' },
  { month: 5, label: 'May', amountCents: 1500, priceId: 'price_1TQpJq2a2BXhmPNuVgSKvMi5' },
  { month: 6, label: 'Jun', amountCents: 1500, priceId: 'price_1TQpJu2a2BXhmPNuF6z69gnV' },
  { month: 7, label: 'Jul', amountCents: 1500, priceId: 'price_1TQpJy2a2BXhmPNurqECaPFB' },
  { month: 8, label: 'Aug', amountCents: 1500, priceId: 'price_1TQpK22a2BXhmPNuBUMU0PSB' },
  { month: 9, label: 'Sep', amountCents: 1500, priceId: 'price_1TQpK62a2BXhmPNukXAY6OBH' },
  { month: 10, label: 'Oct', amountCents: 1000, priceId: 'price_1TQpKA2a2BXhmPNu9Umbapyn' },
  { month: 11, label: 'Nov', amountCents: 500, priceId: 'price_1TQpKE2a2BXhmPNuKUCfKFFp' },
  { month: 12, label: 'Dec', amountCents: 500, priceId: 'price_1TQpKI2a2BXhmPNu0tm9rngU' },
];

export function resolveMonthlyPriceId(date: Date = new Date()): string {
  const monthIndex = date.getMonth(); // 0-11
  return MONTHLY_PRICE_TABLE[monthIndex].priceId;
}

export function resolveMonthlyPriceCents(date: Date = new Date()): number {
  const monthIndex = date.getMonth();
  return MONTHLY_PRICE_TABLE[monthIndex].amountCents;
}

export function priceIdFor(plan: PricingPlan): string {
  return plan === 'annual' ? ANNUAL_PRICE_ID : resolveMonthlyPriceId();
}
