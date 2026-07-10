// Region gating for v1. The covered set is whatever has published cities in
// BlueCaster — we keep this list explicit so the frontend can render
// "covered" vs "coming soon" badges and gate Stripe checkout client-side
// without a polygon lookup. Sub-region tiers (T1/T2/T3) are deferred to v1.1.

export const COVERED_PROVINCES = ["BC", "WA", "OR"] as const;
export type CoveredProvince = (typeof COVERED_PROVINCES)[number];

export function isCovered(provinceCode: string): boolean {
  return (COVERED_PROVINCES as readonly string[]).includes(
    provinceCode.toUpperCase(),
  );
}
