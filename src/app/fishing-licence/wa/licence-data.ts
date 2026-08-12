/**
 * Washington recreational fishing licence facts, 2026–27.
 *
 * Same contract as the BC file: every figure on /fishing-licence/wa comes from
 * here, fees change on April 1, and the annual refresh is one edit — update the
 * numbers, bump LICENCE_YEAR and VERIFIED_ON, re-check the linked WDFW pages.
 *
 * Washington reads as the simpler jurisdiction because one agency runs it, and
 * it isn't. BC sells a single tidal licence covering finfish AND shellfish;
 * Washington sells FOUR separate products and makes you work out which
 * combination you need, then layers endorsements and catch record cards on top.
 * The page is organised around that, not around a BC-shaped narrative.
 *
 * American spelling throughout the copy — WDFW writes "license", and so does
 * everyone searching for one in Washington. The URL keeps the site-wide
 * `/fishing-licence/` segment so both regions share a route and a layout.
 *
 * Fees are the published amounts. WDFW does not state a transaction or dealer
 * fee on the fees page, so none is claimed here.
 */

import type { FeeTable } from "../types";

/** The date the figures below were last checked against the primary sources. */
export const VERIFIED_ON = "10 August 2026";

/**
 * Washington runs the same April–March licence year as BC, which is genuinely
 * useful for anglers who fish both sides of the border: the two licences
 * expire on the same night.
 */
export const LICENCE_YEAR = {
  label: "2026–27",
  start: "1 April 2026",
  end: "31 March 2027",
} as const;

export const SOURCES = {
  fees: "https://wdfw.wa.gov/licenses/fishing/types-fees",
  licenses: "https://wdfw.wa.gov/licenses/fishing",
  buy: "https://fishhunt.dfw.wa.gov/",
  catchRecordCard: "https://wdfw.wa.gov/licenses/fishing/catch-record-card",
  crabCard: "https://wdfw.wa.gov/licenses/fishing/catch-record-card/dungeness",
  endorsements: "https://wdfw.wa.gov/licenses/fishing/endorsements",
  twoPole: "https://wdfw.wa.gov/licenses/fishing/two-pole",
  parking: "https://wdfw.wa.gov/licenses/parking",
  freeFishing: "https://wdfw.wa.gov/fishing/free",
  regulations: "https://wdfw.wa.gov/fishing/regulations",
  shellfishSafety: "https://doh.wa.gov/community-and-environment/shellfish/recreational-shellfish",
} as const;

/**
 * Annual licences.
 *
 * Note what the columns do NOT contain: there is no non-resident senior or
 * non-resident youth rate. A visiting 72-year-old pays the full non-resident
 * price, which surprises people who assume the senior break travels.
 *
 * "Fish Washington" is a resident-only bundle — combination licence plus the
 * three endorsements at a discount. It is the cheapest way to end up fully
 * covered, and it is easy to miss because it sits below the individual
 * products on WDFW's page.
 */
export const ANNUAL_FEES: FeeTable = {
  columns: ["Resident 16–69", "Non-resident", "Senior 70+", "Disabled"],
  rows: [
    { term: "Combination", prices: ["$74.37", "$170.00", "$28.83", "$12.89"] },
    { term: "Freshwater", prices: ["$39.95", "$115.85", "$9.59", "—"] },
    { term: "Saltwater", prices: ["$40.71", "$81.70", "$10.35", "—"] },
    { term: "Shellfish/Seaweed", prices: ["$21.58", "$47.39", "$13.99", "—"] },
    { term: "Razor clam", prices: ["$17.44", "$28.07", "$17.44", "—"] },
    { term: "Fish Washington", prices: ["$101.88", "—", "$49.85", "$47.98"] },
  ],
  notes: [
    "Anglers 15 and younger need no license at all — but they still need a catch record card for the species that require one.",
    "Combination covers freshwater, saltwater and shellfish/seaweed together. Bought separately those three come to $102.24, so the combination saves a resident $27.87.",
    "There is no non-resident senior or youth rate; visitors pay the full non-resident price at every age over 15.",
  ],
};

/** Short-term licenses, all sold as combinations. */
export const SHORT_TERM_FEES: FeeTable = {
  columns: ["Resident", "Non-resident"],
  rows: [
    { term: "1-day combination", prices: ["$14.90", "$27.05"] },
    { term: "2-day combination", prices: ["$20.98", "$39.19"] },
    { term: "3-day combination", prices: ["$25.53", "$48.30"] },
    { term: "3-day razor clam", prices: ["$11.79", "$11.79"] },
  ],
  notes: [
    "Short-term licenses are combinations, so a visitor fishing one weekend does not have to guess between freshwater and saltwater.",
    "For a non-resident, three separate 3-day licenses ($144.90) cost nearly as much as the annual combination ($170.00) — worth doing the arithmetic if you visit more than twice a year.",
  ],
};

export interface Endorsement {
  name: string;
  /** Figures shown on the card, label → value. */
  figures: Array<{ label: string; value: string }>;
  /** When it is required, and where it is and isn't valid. */
  detail: string;
}

/**
 * Endorsements — the add-ons that make an otherwise valid licence insufficient.
 *
 * These are the Washington equivalent of BC's conservation surcharges, and the
 * Puget Sound crab one is the single most commonly missed item in this whole
 * page: a shellfish licence alone does not let you drop a pot in Puget Sound.
 */
export const ENDORSEMENTS: Endorsement[] = [
  {
    name: "Puget Sound Dungeness crab",
    figures: [
      { label: "Annual", value: "$11.89" },
      { label: "Temporary", value: "$5.05" },
    ],
    detail:
      "Required on top of a shellfish/seaweed or combination license to crab anywhere in Puget Sound. Same price for residents and non-residents. You also need a Puget Sound Dungeness crab catch record card, which is a separate document from the fish card.",
  },
  {
    name: "Two-pole",
    figures: [
      { label: "Standard", value: "$20.23" },
      { label: "Senior 70+", value: "$8.09" },
    ],
    detail:
      "Required from age 16 to fish two poles at once. Valid on most freshwater lakes and ponds and a handful of river sections and marine areas — but NOT in saltwater generally, and not in rivers, streams or beaver ponds unless that water is specifically listed. Check the regulations for the water you are on before rigging a second rod.",
  },
  {
    name: "Columbia River salmon & steelhead",
    figures: [
      { label: "Standard", value: "$8.75" },
      { label: "Youth / senior", value: "$7.10" },
    ],
    detail:
      "Required to fish for salmon or steelhead in the Columbia River and its Washington tributaries. Reinstated from 1 January 2026, so a license bought before that date may predate the requirement.",
  },
];

export interface CatchCardRule {
  species: string;
  /** The reporting deadline for that card. */
  deadline: string;
  detail: string;
}

/**
 * Catch record cards.
 *
 * Two things make these bite harder than BC's catch records. First, they are
 * required of EVERYONE including the under-16s who need no licence. Second,
 * you must return the card even if you caught nothing and even if you never
 * went — a nil return is still mandatory.
 */
export const CATCH_CARDS: CatchCardRule[] = [
  {
    species: "Salmon, steelhead, sturgeon, halibut",
    deadline: "Return by 30 April",
    detail:
      "One fish card covers all four. Record each retained fish before you carry on fishing. A card endorsed for halibut costs $7.59; without halibut it is free.",
  },
  {
    species: "Puget Sound Dungeness crab — summer",
    deadline: "Return by 1 October",
    detail:
      "A separate card from the fish card, and it needs the crab endorsement alongside it. Record each crab before you redeploy your gear.",
  },
  {
    species: "Puget Sound Dungeness crab — winter",
    deadline: "Return by 1 February",
    detail:
      "The winter season carries its own card and its own deadline. Missing a crab report attracts a $10 penalty on your next license purchase.",
  },
];
