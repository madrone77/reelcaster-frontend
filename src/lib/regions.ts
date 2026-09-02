// Region gating for v1. The covered set is whatever has published cities in
// BlueCaster — we keep this list explicit so the frontend can render
// "covered" vs "coming soon" badges and gate Stripe checkout client-side
// without a polygon lookup. Sub-region tiers (T1/T2/T3) are deferred to v1.1.
//
// Oregon was in this list and shouldn't have been: it has no cities in
// BlueCaster at all — not published, not even building — so it generated an
// empty /fishing/or directory, listed itself in the sitemap, advertised itself
// in the Offer markup, and let someone pick "Oregon" at checkout and pay for
// water we don't forecast. Add a region back here the day it has a published
// city, not the day we intend to build one.

export const COVERED_PROVINCES = ["BC", "WA"] as const;
export type CoveredProvince = (typeof COVERED_PROVINCES)[number];

/**
 * Every region we can resolve FACTS about (timezone, regulator), which is a
 * wider set than the ones we sell. A spot can sit just over a border — see the
 * denormalized address on `places` — and still needs the right clock and the
 * right fisheries authority even though its region isn't for sale.
 */
type KnownProvince = "BC" | "WA" | "OR";

export function isCovered(provinceCode: string): boolean {
  return (COVERED_PROVINCES as readonly string[]).includes(
    provinceCode.toUpperCase(),
  );
}

// BlueCaster returns a spot's region as a full name ("British Columbia").
// Titles want the postal code, both because "Victoria, BC" is how anglers
// write it and because the full name pushed a third of our <title>s past the
// ~60 characters Google renders before truncating.
const PROVINCE_CODE_BY_NAME: Record<string, KnownProvince> = {
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
const TIMEZONE_BY_PROVINCE: Record<KnownProvince, string> = {
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
  return TIMEZONE_BY_PROVINCE[code as KnownProvince] ?? DEFAULT_TIMEZONE;
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
  /**
   * How that term is written in front of a number, where space is short and
   * anglers have their own shorthand: "MA 10", "Area 19-3". Shorter than
   * `areaLabel` on purpose -- nobody says "PFMA 19-3" out loud -- but it must
   * stay as jurisdiction-specific as `areaLabel` is, because the number alone
   * does not say who set it.
   */
  areaShort: string;
  /** The authority's own recreational-regulations page. */
  url: string;
}

const REGULATOR_BY_PROVINCE: Record<KnownProvince, Regulator> = {
  BC: {
    name: "DFO",
    sourceName: "DFO/MPO",
    areaLabel: "PFMA",
    areaShort: "Area",
    url: "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html",
  },
  WA: {
    name: "WDFW",
    sourceName: "WDFW",
    areaLabel: "Marine Area",
    areaShort: "MA",
    url: "https://wdfw.wa.gov/fishing/regulations",
  },
  OR: {
    name: "ODFW",
    sourceName: "ODFW",
    areaLabel: "Zone",
    areaShort: "Zone",
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
    REGULATOR_BY_PROVINCE[code as KnownProvince] ?? REGULATOR_BY_PROVINCE.BC
  );
}

/** Agency slug as the payload writes it ("DFO", "WDFW") → its regulator. */
function regulatorByAgency(agency: string): Regulator | undefined {
  return Object.values(REGULATOR_BY_PROVINCE).find(
    (r) => r.name.toUpperCase() === agency.toUpperCase(),
  );
}

/**
 * The authority governing a spot, from the best evidence available.
 *
 * ⚠ Resolve from the AGENCY the payload names, not from the spot's city. A
 * spot belongs to the nearest city and the nearest city can be across a
 * border: East Point (Saturna Island) is DFO subarea 18-11 sitting on
 * friday-harbor-wa's roster. Reading the authority off that city cites WDFW
 * over DFO's water — it links an angler at another country's regulations,
 * and prints "MA 18-11" for a number WDFW never issued.
 *
 * `region` is the fallback, for a payload old enough not to carry an agency;
 * `region` there must be the SPOT's province, not its city's, for the same
 * reason. Both absent falls through `regulatorFor` to the pilot region.
 */
export function regulatorFrom(from: {
  agency?: string | null;
  region?: string | null;
}): Regulator {
  return (
    (from.agency ? regulatorByAgency(from.agency) : undefined) ??
    regulatorFor(from.region)
  );
}

/**
 * A bare management-area number, labelled for the regulator that set it.
 *
 * "10" is not an area, it is half of one: DFO numbers from single digits and
 * so does WDFW, so there is a DFO Area 9 and a WDFW Area 9 and only the word
 * in front separates them. Every surface that prints an area number goes
 * through here, so a Seattle card can never carry BC's word over Washington's
 * number.
 *
 * Resolution and its caveats are `regulatorFrom`'s.
 *
 * Returns null for a missing area so a caller can collapse rather than
 * reserving space for a label it has nothing to put in.
 */
export function areaLabelFor(
  area: string | null | undefined,
  from: { agency?: string | null; region?: string | null },
): string | null {
  if (!area) return null;
  return `${regulatorFrom(from).areaShort} ${area}`;
}
