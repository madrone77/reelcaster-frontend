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

// BlueCaster returns a spot's region as a full name ("British Columbia").
// Titles want the postal code, both because "Victoria, BC" is how anglers
// write it and because the full name pushed a third of our <title>s past the
// ~60 characters Google renders before truncating.
const PROVINCE_CODE_BY_NAME: Record<string, CoveredProvince> = {
  "british columbia": "BC",
  washington: "WA",
  oregon: "OR",
};

/**
 * Full region name → 2-letter code. Falls through to the input for anything
 * unmapped (a new region, or a value that already arrived as a code), so a
 * title degrades to the long form rather than losing its location entirely.
 */
export function provinceCodeFromName(region: string): string {
  const trimmed = region.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return PROVINCE_CODE_BY_NAME[trimmed.toLowerCase()] ?? trimmed;
}
