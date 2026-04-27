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

// Display order for the /fishing index — covered first, then alphabetical.
export const PROVINCE_DISPLAY_NAMES: Record<string, string> = {
  BC: "British Columbia",
  WA: "Washington",
  OR: "Oregon",
};

// Editorial copy for province landing pages. Kept inline to avoid the
// gray-matter / fs read just for three short paragraphs. Replace with markdown
// loader when copy gets longer.
export const PROVINCE_EDITORIAL: Record<
  string,
  { headline: string; intro: string }
> = {
  BC: {
    headline: "Fishing British Columbia",
    intro:
      "From the Strait of Juan de Fuca to Haida Gwaii, BC's coast is one of the most varied saltwater fisheries in North America. ReelCaster covers chinook and coho hot spots around Victoria, Sooke, and the Gulf Islands, with live conditions, DFO regulations, and per-spot 24-hour scoring.",
  },
  WA: {
    headline: "Fishing Washington",
    intro:
      "Washington's coastal and Puget Sound fisheries — coho, chinook, and lingcod — anchor our US coverage. Browse cities below for tide-aware forecasts, regulations, and local intel.",
  },
  OR: {
    headline: "Fishing Oregon",
    intro:
      "Oregon's coast and Columbia River system bring some of the most consistent salmon and bottomfish action on the West Coast. Pick a city below to see the live forecast.",
  },
};
