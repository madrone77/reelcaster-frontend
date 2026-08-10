/**
 * BC recreational fishing licence facts, 2026–27.
 *
 * Every figure on /fishing-licence/bc comes from this file so the annual
 * refresh is one edit rather than a hunt through JSX. Fees change on April 1;
 * when they do, update the numbers, bump LICENCE_YEAR and VERIFIED_ON, and
 * re-check the two source pages linked on each block below.
 *
 * Two separate governments issue these licences and they are not
 * interchangeable — tidal (saltwater) is federal (DFO), freshwater is
 * provincial. Keeping them as two clearly-labelled blocks here is deliberate:
 * conflating them is the single most common mistake this page exists to fix.
 *
 * All fees are quoted BEFORE tax, which is how both regulators publish them.
 * Do not "helpfully" gross them up — an angler comparing our number to the
 * checkout screen should see the same figure the government does.
 */

/** The date the figures below were last checked against the primary sources. */
export const VERIFIED_ON = "10 August 2026";

/**
 * Both licences run on the same April–March year, which is the one thing about
 * them that IS aligned. A licence bought in March expires weeks later.
 */
export const LICENCE_YEAR = {
  label: "2026–27",
  start: "1 April 2026",
  end: "31 March 2027",
} as const;

export const SOURCES = {
  dfoLicence:
    "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/licence-permis/index-eng.html",
  nrls:
    "https://recfish-pechesportive.dfo-mpo.gc.ca/nrls-sndpp/index-eng.cfm",
  dfoReport: "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/report-declarez-eng.html",
  dfoRec: "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html",
  freshwaterLicence:
    "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/fishing/recreational-freshwater-fishing-licence",
  surcharges:
    "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/fishing/recreational-freshwater-fishing-licence/conservation-surcharges",
  wild: "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/wild-system",
  wildLogin:
    "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/wild-system/wild-login",
  irec: "https://www.irecreport.ca/",
} as const;

export interface FeeRow {
  /** Left-hand label — the licence term, not the buyer. */
  term: string;
  /** One cell per column in the table's header, same order. */
  prices: string[];
}

export interface FeeTable {
  /** Column headers after the term column. */
  columns: string[];
  rows: FeeRow[];
  /** Rendered under the table for the caveats a cell can't hold. */
  notes: string[];
}

/**
 * Tidal (saltwater) — DFO.
 *
 * Note the shape difference from freshwater: seniors get a break as residents
 * only, and non-residents pay one flat annual rate regardless of age.
 */
export const TIDAL_FEES: FeeTable = {
  columns: ["Canadian resident", "Non-resident"],
  rows: [
    { term: "Annual (16–64)", prices: ["$25.86", "$124.41"] },
    { term: "Annual (65+)", prices: ["$13.54", "$124.41"] },
    { term: "Annual (under 16)", prices: ["Free", "Free"] },
    { term: "5-day", prices: ["$19.70", "$38.18"] },
    { term: "3-day", prices: ["$13.54", "$23.40"] },
    { term: "1-day", prices: ["$6.46", "$8.62"] },
  ],
  notes: [
    "Prices exclude GST.",
    "Add the Salmon Conservation Stamp ($7.39) if you intend to keep salmon — the licence alone does not let you retain any.",
  ],
};

/** Required to RETAIN salmon in tidal waters. Releasing does not need it. */
export const SALMON_STAMP_FEE = "$7.39";

/**
 * Freshwater — Province of BC.
 *
 * "Non-resident" here means a Canadian who lives outside BC; "non-resident
 * alien" is the province's own term for everyone else. DFO uses a flat
 * resident/non-resident split instead, which is exactly why the two fee tables
 * cannot share a component.
 */
export const FRESHWATER_FEES: FeeTable = {
  columns: ["BC resident", "Canadian, outside BC", "Outside Canada"],
  rows: [
    { term: "Annual (16–64)", prices: ["$41.15", "$62.87", "$91.44"] },
    { term: "Annual (65+)", prices: ["$5.71", "$62.87", "$91.44"] },
    { term: "8-day", prices: ["$22.86", "$41.15", "$57.14"] },
    { term: "1-day", prices: ["$11.43", "$22.86", "$22.86"] },
  ],
  notes: [
    "Prices exclude tax.",
    "BC residents registered in the disability fee reduction program pay $1.14 for an annual licence.",
    "A basic licence covers common species only. Steelhead, non-tidal salmon and some trophy trout and char need a conservation surcharge on top — see below.",
  ],
};

export interface Surcharge {
  name: string;
  resident: string;
  nonResident: string;
  /** When it is required — the release/retain distinction matters on most. */
  requiredFor: string;
}

/**
 * Freshwater conservation surcharges.
 *
 * Steelhead is the trap: it is the only one required whether you keep the fish
 * or release it, so an angler who "only catch-and-releases" still needs to buy
 * it. Every other surcharge here is retention-only.
 */
export const SURCHARGES: Surcharge[] = [
  {
    name: "Steelhead",
    resident: "$28.57",
    nonResident: "$68.57",
    requiredFor:
      "Fishing for steelhead anywhere in BC — required whether you keep or release. All wild steelhead must be released; the province-wide hatchery quota is 10.",
  },
  {
    name: "Non-tidal salmon",
    resident: "$17.14",
    nonResident: "$34.29",
    requiredFor: "Keeping salmon from fresh water. Not needed if you release.",
  },
  {
    name: "Kootenay Lake rainbow trout",
    resident: "$11.43",
    nonResident: "$22.86",
    requiredFor:
      "Keeping rainbow trout over 50 cm from the main lake. Not needed if you release.",
  },
  {
    name: "Shuswap Lake rainbow trout",
    resident: "$11.43",
    nonResident: "$22.86",
    requiredFor:
      "Keeping rainbow trout over 50 cm. Not needed if you release.",
  },
  {
    name: "Shuswap Lake char",
    resident: "$11.43",
    nonResident: "$22.86",
    requiredFor: "Keeping char over 60 cm. Not needed if you release.",
  },
  {
    name: "White sturgeon conservation licence",
    resident: "$28.57",
    nonResident: "$68.58",
    requiredFor:
      "Fishing for white sturgeon. Catch-and-release only — there is no retention. Short-term versions are sold at $9.14/$17.14 (1-day) and $17.14/$34.29 (8-day).",
  },
];

export interface CatchRecordRule {
  species: string;
  scope: string;
  annualQuota: string;
}

/**
 * Species that must be written down the moment you keep one, in tidal waters.
 *
 * This is the obligation anglers most often discover only when a Fishery
 * Officer asks, because it lives in the licence conditions rather than the
 * regulations everyone reads. "Immediately and permanently" is the legal
 * standard — after the trip is too late.
 */
export const TIDAL_CATCH_RECORDS: CatchRecordRule[] = [
  {
    species: "Chinook salmon",
    scope: "Any management area. Record head-on length.",
    annualQuota: "10 coastwide",
  },
  {
    species: "Halibut",
    scope: "Any management area. Record head-on length.",
    annualQuota: "10 coastwide",
  },
  {
    species: "Lingcod",
    scope:
      "Inside waters only — Areas 12–19 (except Sub-area 12-14), Sub-areas 20-5 to 20-7, and 29-5.",
    annualQuota: "10 inside waters",
  },
];
