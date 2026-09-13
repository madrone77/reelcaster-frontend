/**
 * California sport fishing license facts, 2026.
 *
 * Same contract as the BC and WA files: every figure on /fishing-licence/ca
 * comes from here, and the annual refresh is one edit. Update the numbers,
 * bump LICENSE_YEAR and VERIFIED_ON, re-check the linked CDFW pages.
 *
 * Two things make California different from the other two, and the page is
 * built around them rather than around a BC-shaped narrative:
 *
 *   1. A license is valid for 365 days from the day you buy it. Not April to
 *      March like BC and Washington, and not the calendar year it used to be.
 *   2. You need NO license at all to fish from a public pier in the ocean.
 *      That is the single most useful fact on the page for somebody starting
 *      out, and CDFW states it in so many words.
 *
 * On top of the base license CDFW sells validations and report cards. The one
 * that matters for our water is the Ocean Enhancement Validation: required to
 * fish the ocean south of Point Arguello, which is every published California
 * spot today.
 *
 * CDFW fees move each year (the state indexes them). The figures here were
 * read off wildlife.ca.gov on VERIFIED_ON; anything not on that page is not
 * claimed here.
 *
 * American spelling in copy: CDFW writes "license". The URL keeps the
 * site-wide `/fishing-licence/` segment so every region shares one route.
 */

import type { FeeTable } from "../types";

/** The date the figures below were last checked against the primary sources. */
export const VERIFIED_ON = "12 September 2026";

/**
 * California has no fixed license year: an annual license runs 365 days from
 * the date of purchase. `label` is the fee year the figures belong to.
 */
export const LICENSE_YEAR = {
  label: "2026",
  validity: "365 days from the date of purchase",
} as const;

export const SOURCES = {
  fees: "https://wildlife.ca.gov/Licensing/Fishing",
  buy: "https://wildlife.ca.gov/Licensing/Online-Sales",
  regulations: "https://wildlife.ca.gov/Fishing/Ocean",
  freeFishing: "https://wildlife.ca.gov/Licensing/Fishing/Free-Fishing-Days",
} as const;

/**
 * Annual licenses.
 *
 * California has no senior rate as such. The low-income senior license is a
 * means-tested reduced fee, not an age break, so a 70-year-old on a normal
 * income pays the full resident price.
 */
export const ANNUAL_FEES: FeeTable = {
  columns: ["Resident", "Non-resident"],
  rows: [
    { term: "Annual sport fishing", prices: ["$64.54", "$174.14"] },
    { term: "Reduced fee (disabled veteran, recovering service member)", prices: ["$10.04", "$10.04"] },
    { term: "Low-income senior, 65+", prices: ["$10.04", "—"] },
  ],
  notes: [
    "Anglers 15 and younger need no license.",
    "Valid for 365 days from the date you buy it, so a license bought in June runs to the following June.",
    "The reduced-fee licenses cost $10.54 through a license agent instead of a CDFW office. Free licenses exist for anglers who are blind, mobility impaired or developmentally disabled, and for low-income Native American residents.",
  ],
};

/** Short-term licenses. */
export const SHORT_TERM_FEES: FeeTable = {
  columns: ["Resident", "Non-resident"],
  rows: [
    { term: "One-day", prices: ["$21.09", "$21.09"] },
    { term: "Two-day", prices: ["$32.40", "$32.40"] },
    { term: "Ten-day", prices: ["—", "$64.54"] },
  ],
  notes: [
    "Short-term licenses cost the same for residents and visitors. The ten-day license is sold to non-residents only, and it costs exactly what a resident pays for a full year.",
    "A one-day or two-day license does not need the Ocean Enhancement Validation. An annual license does.",
  ],
};

export interface AddOn {
  name: string;
  /** Figures shown on the card, label to value. */
  figures: Array<{ label: string; value: string }>;
  /** When it is required, and where it is and isn't valid. */
  detail: string;
}

/**
 * Validations and report cards, the add-ons that make an otherwise valid
 * license insufficient. The Ocean Enhancement Validation is the one that
 * bites on our water: every published California spot is south of Point
 * Arguello.
 */
export const ADD_ONS: AddOn[] = [
  {
    name: "Ocean Enhancement Validation",
    figures: [{ label: "Annual", value: "$7.30" }],
    detail:
      "Required on an annual license to fish in ocean waters south of Point Arguello in Santa Barbara County, which covers all of Southern California from Santa Barbara to the Mexican border. Not needed with a one-day or two-day license.",
  },
  {
    name: "Spiny lobster report card",
    figures: [{ label: "Per season", value: "$12.70" }],
    detail:
      "Required for anyone taking spiny lobster, at any age and even from a public pier where no license is needed. Record each lobster before you carry on fishing and report the card at the end of the season.",
  },
  {
    name: "Second-rod validation",
    figures: [{ label: "Annual", value: "$20.26" }],
    detail:
      "Inland waters only. CDFW states that a second-rod validation is not required when fishing in ocean waters, so leave it off unless you also fish lakes and rivers.",
  },
];

/** Free fishing days: no license, everything else still applies. */
export const FREE_FISHING_DAYS_2026 = "Saturday 4 July and Saturday 5 September 2026";
