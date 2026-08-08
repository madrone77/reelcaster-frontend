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

// The spot payload carries no timezone, so it is derived from the region the
// same way the regulator is. Every covered region is Pacific time today, which
// is exactly why this was easy to get wrong: the spot page hardcoded
// "America/Vancouver", and because BC, WA and OR share an offset, a Seattle
// spot rendered the right *hour* under a Canadian timezone label — correct by
// coincidence, and wrong the moment a spot lands outside Pacific time.
const TIMEZONE_BY_PROVINCE: Record<CoveredProvince, string> = {
  BC: "America/Vancouver",
  WA: "America/Los_Angeles",
  OR: "America/Los_Angeles",
};

/** Fallback for an unmapped region — the pilot region, matching regulatorFor. */
const DEFAULT_TIMEZONE = TIMEZONE_BY_PROVINCE.BC;

/**
 * Region name or code → IANA timezone for that spot's local clock.
 *
 * Used for every "what hour is it there" decision on a spot page. Anything
 * unmapped falls back to the pilot region rather than the *viewer's* timezone:
 * a spot's clock is a property of the spot, not of who is looking at it, and
 * resolving it per-viewer would make server and client disagree on a cached
 * page.
 */
export function timezoneFor(region: string | null | undefined): string {
  if (!region) return DEFAULT_TIMEZONE;
  const code = provinceCodeFromName(region).toUpperCase();
  return TIMEZONE_BY_PROVINCE[code as CoveredProvince] ?? DEFAULT_TIMEZONE;
}

// BlueCaster stores the formal country name ("United States"). Breadcrumbs are
// a cramped 11px mono row, and nobody writes out "United States" in a trail —
// "USA" is both shorter and how the crumb actually reads.
const COUNTRY_DISPLAY_BY_NAME: Record<string, string> = {
  "united states": "USA",
  "united states of america": "USA",
};

/**
 * Formal country name → its breadcrumb label. Anything unmapped passes through
 * unchanged, so "Canada" stays "Canada" and a country we haven't covered yet
 * still renders its real name rather than disappearing.
 */
export function countryDisplayName(country: string): string {
  const trimmed = country.trim();
  return COUNTRY_DISPLAY_BY_NAME[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Who governs saltwater fishing in a region, and what that region calls its
 * management areas.
 *
 * The regs strip used to be hardcoded to "DFO · PFMA <n>" linking DFO's Pacific
 * recreational page — correct in BC, and actively wrong in Washington, where it
 * pointed an angler at another country's regulations. Both the label and the
 * link have to follow the spot's jurisdiction.
 *
 * `areaLabel` is the local term for the numbered area, not a translation of
 * PFMA: DFO numbers Pacific Fishery Management Areas, WDFW numbers Marine
 * Areas, and the same "10" means a different thing in each.
 */
export interface Regulator {
  /** Short name as anglers say it — "DFO", "WDFW". */
  name: string;
  /** Byline for the provenance line, where the agency is cited as a data
   *  source rather than addressed as an authority — "DFO/MPO", "WDFW". */
  sourceName: string;
  /** Local term for a numbered management area. */
  areaLabel: string;
  /** The authority's own recreational-regulations page. */
  url: string;
}

const REGULATOR_BY_PROVINCE: Record<CoveredProvince, Regulator> = {
  BC: {
    name: "DFO",
    sourceName: "DFO/MPO",
    areaLabel: "PFMA",
    url: "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html",
  },
  WA: {
    name: "WDFW",
    sourceName: "WDFW",
    areaLabel: "Marine Area",
    url: "https://wdfw.wa.gov/fishing/regulations",
  },
  OR: {
    name: "ODFW",
    sourceName: "ODFW",
    areaLabel: "Zone",
    url: "https://myodfw.com/recreation-report/fishing-report",
  },
};

/**
 * Region (code or full name) → its regulator. Falls back to DFO, which is the
 * jurisdiction every published city sat in when this strip was written; an
 * unmapped region is a coverage bug, not a reason to render no regs at all.
 */
export function regulatorFor(region: string | null | undefined): Regulator {
  if (!region) return REGULATOR_BY_PROVINCE.BC;
  const code = provinceCodeFromName(region).toUpperCase();
  return (
    REGULATOR_BY_PROVINCE[code as CoveredProvince] ?? REGULATOR_BY_PROVINCE.BC
  );
}
