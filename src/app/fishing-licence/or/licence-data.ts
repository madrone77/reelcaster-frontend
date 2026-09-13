/**
 * Oregon sport fishing license facts, 2026.
 *
 * Same contract as the BC, WA and CA files: every figure on
 * /fishing-licence/or comes from here, and the annual refresh is one edit.
 * Update the facts, bump LICENSE_YEAR and VERIFIED_ON, re-check the linked
 * myodfw.com pages.
 *
 * What makes Oregon different, and what the page is built around:
 *
 *   1. From 1 January 2026 anyone fishing the ocean for finfish (rockfish,
 *      lingcod, halibut, tuna) needs an Ocean Endorsement on top of the
 *      license. It is not needed for salmon, steelhead or shellfish. Every
 *      published Oregon spot is ocean or bay water, so this is the add-on most
 *      of our readers need.
 *   2. Salmon, steelhead, sturgeon and Pacific halibut need the Combined
 *      Angling Tag, and a kept halibut is recorded on it right away, length in
 *      inches.
 *   3. The license year is the calendar year, 1 January to 31 December.
 *
 * Base license prices are deliberately NOT listed. ODFW raised recreational
 * fees an average of 12 to 14 percent for 2026 and publishes the price list
 * inside its licensing system rather than on a page we could cite, so the
 * page sends readers to ODFW for them. Only figures ODFW prints on myodfw.com
 * (the endorsement, the youth and pioneer licenses) are claimed here.
 *
 * American spelling in copy: ODFW writes "license". The URL keeps the
 * site-wide `/fishing-licence/` segment so every region shares one route.
 */

import type { FeeTable } from "../types";

/** The date the facts below were last checked against the primary sources. */
export const VERIFIED_ON = "13 September 2026";

export const LICENSE_YEAR = {
  label: "2026",
  validity: "1 January to 31 December",
} as const;

export const SOURCES = {
  licensing: "https://myodfw.com/fishing/licensing-info",
  howToBuy: "https://myodfw.com/articles/how-buy-oregon-fishing-license",
  whatsNew: "https://myodfw.com/articles/whats-new-2026",
  oceanEndorsement: "https://myodfw.com/articles/ocean-endorsement",
  combinedTag:
    "https://myodfw.com/combined-angling-tag-instructions-and-location-codes",
  columbiaEndorsement:
    "https://myodfw.com/articles/who-needs-columbia-river-basin-endorsement",
  shellfish: "https://myodfw.com/crabbing-clamming/licensing-info",
  bottomfish: "https://myodfw.com/sport-bottomfish-seasons",
  halibut: "https://myodfw.com/pacific-halibut-sport-regulations",
  marineZone: "https://myodfw.com/fishing/marine-zone",
  freeFishing: "https://myodfw.com/articles/2026-free-fishing-days-and-events",
} as const;

/**
 * The figures ODFW prints on myodfw.com. Adult license rows point at ODFW
 * because the 2026 price list is not published there as a page.
 */
export const LICENSE_FEES: FeeTable = {
  columns: ["Resident", "Non-resident"],
  rows: [
    { term: "Annual angling (18+)", prices: ["See ODFW", "See ODFW"] },
    { term: "Daily and multi-day angling", prices: ["See ODFW", "See ODFW"] },
    { term: "Youth license (12 to 17)", prices: ["$10", "$10"] },
    { term: "Pioneer license", prices: ["$10", "Not sold"] },
  ],
  notes: [
    "Children under 12 need no license to fish, crab or clam.",
    "An annual license runs 1 January to 31 December, whenever you buy it.",
    "The youth license covers fishing, hunting and shellfish, and includes the Ocean Endorsement. The pioneer license includes all major licenses plus the Ocean Endorsement. Resident disabled veterans get a free combination license that also includes it.",
    "ODFW raised recreational fees an average of 12 to 14 percent for 2026. Check ODFW for current fees before you buy.",
  ],
};

export interface AddOn {
  name: string;
  /** Figures shown on the card, label to value. */
  figures: Array<{ label: string; value: string }>;
  /** When it is required, and where it is and isn't valid. */
  detail: string;
}

/** Endorsements, tags and the shellfish license, in the order our water needs them. */
export const ADD_ONS: AddOn[] = [
  {
    name: "Ocean Endorsement",
    figures: [
      { label: "Annual", value: "$9" },
      { label: "Daily", value: "$4" },
    ],
    detail:
      "New for 2026. Required to fish the ocean from a beach, jetty or boat, or to spearfish, for finfish such as rockfish, lingcod, halibut and tuna. The ocean starts past the visible ends of the jetties, and past Buoy 10 on the Columbia. Not needed for salmon, steelhead, crab or clams. Same price for residents and visitors.",
  },
  {
    name: "Combined Angling Tag",
    figures: [{ label: "Price", value: "See ODFW" }],
    detail:
      "Required to fish for salmon, steelhead or sturgeon, catch and release included, and Pacific halibut are recorded on it too. Enter the codes the moment you keep a fish, on paper or in the MyODFW app, and write down the length in inches for halibut and sturgeon.",
  },
  {
    name: "Columbia River Basin Endorsement",
    figures: [{ label: "Price", value: "See ODFW" }],
    detail:
      "Needed on an Oregon license to fish for salmon, steelhead or sturgeon on the Columbia and the rivers that drain into it. Relevant around Astoria. Free on request with a youth, resident pioneer or resident disabled veteran license.",
  },
  {
    name: "Shellfish license",
    figures: [{ label: "Price", value: "See ODFW" }],
    detail:
      "Crabbing and clamming take a shellfish license from age 12, sold by the day or the year. It is separate from the angling license, and the youth license already includes it.",
  },
];

/** Free Fishing Days: no license, tag or endorsement; every other rule applies. */
export const FREE_FISHING_DAYS_2026 =
  "14 and 15 February, 6 and 7 June, and 27 and 28 November 2026";
