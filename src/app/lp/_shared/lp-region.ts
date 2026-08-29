import { regulatorFor, type Regulator } from "@/lib/regions";

/**
 * The facts on a landing page that change with the water it is selling.
 *
 * These pages carry a city in the route, so every one of them already knows
 * which jurisdiction it is talking to. Until now it did not use that: the
 * feature copy named a Victoria spot, the score breakdown cited "PFMA · DFO",
 * and the price anchor was priced in litres. All three were correct for the
 * pilot city and wrong for every Washington ad set pointed at the same
 * template, which is the worst possible place to be wrong. A Puget Sound
 * angler who reads a Canadian management area on a page bought with a Seattle
 * ad has learned the product is not about their water, and no amount of copy
 * below the fold wins that back.
 *
 * Everything here is derived from the province the card's spot actually sits
 * in, not from the city slug, so a spot that sits over a border still gets the
 * fisheries authority that governs it. That is the same rule the spot page
 * follows, and the same `regulatorFor` it calls.
 */
export interface LpRegion {
  /** Who governs this water, and what it calls its numbered areas. */
  regulator: Regulator;
  /**
   * The agency behind the tide predictions under this spot, which is NOT the
   * same as the fisheries regulator and does not follow it by coincidence.
   * Canadian predictions come from CHS, American ones from NOAA CO-OPS. The
   * old copy credited "DFO stations" everywhere, which named the wrong country
   * on half the pages and the wrong agency on all of them.
   */
  tideAuthority: string;
  /** Header chip. Names the data an angler on this coast would recognise. */
  trustChip: string;
  /**
   * The price anchor, in the fuel an angler here actually buys. At $2.75 a
   * month this is close to half a US gallon of marine gas, or a litre and a
   * bit at a BC fuel dock. Selling a US angler on "a litre" is a small tell
   * that reads as loudly as a wrong management area.
   */
  fuelAnchor: string;
  /**
   * The management area as a modifier in body copy, e.g. "WDFW Marine Area
   * limits". Singular, because it qualifies the noun after it.
   */
  areaModifier: string;
  /**
   * The same idea as a mono chip. Reads the way anglers write it: a BC angler
   * says PFMA, a Washington angler says Marine Area, and the two are not
   * translations of each other. The same "10" means different water in each.
   *
   * Deliberately unnumbered. We resolve the spot's province here, not its
   * area, so printing "Marine Area 10" would be a number we never looked up.
   */
  areaBadge: string;
  /**
   * Whether this water is American. Drives the market chrome on /lp/6 (the
   * flag) and the order of the coverage answer below. Kept as a country fact
   * rather than a per-state list so adding another US state is nothing.
   */
  isUS: boolean;
  /**
   * The "what waters do you cover" answer, with the reader's own side of the
   * border first. Same fact either way; a page bought with a Seattle ad should
   * not open its coverage answer with British Columbia.
   */
  coverageAnswer: string;
}

/** Canada vs the US, which is all the fuel anchor needs to know. */
function isMetricFuel(provinceCode: string): boolean {
  return provinceCode.toUpperCase() === "BC";
}

/**
 * Build the region facts for a card.
 *
 * Falls back the same way `regulatorFor` does, to the pilot region, so a spot
 * whose province did not resolve still renders a complete page rather than a
 * page with holes in it.
 */
export function lpRegionFor(provinceCode: string | null | undefined): LpRegion {
  const regulator = regulatorFor(provinceCode);
  const code = (provinceCode ?? "BC").toUpperCase();
  const metric = isMetricFuel(code);

  return {
    regulator,
    tideAuthority: metric ? "CHS" : "NOAA",
    trustChip: metric ? "DFO + CHS DATA" : "WDFW + NOAA DATA",
    fuelAnchor: metric
      ? "Less than a single litre of boat fuel per month."
      : "Less than half a gallon of boat fuel per month.",
    areaModifier: metric ? "DFO subarea" : "WDFW Marine Area",
    areaBadge: metric ? "DFO PFMA" : "WDFW MARINE AREA",
    isUS: !metric,
    coverageAnswer: metric
      ? "coastal British Columbia and Washington"
      : "Washington and coastal British Columbia",
  };
}
