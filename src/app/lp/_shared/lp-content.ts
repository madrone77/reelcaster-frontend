import type { FeatureId } from "./lp-angles";
import type { Regulator } from "@/lib/regions";
import { ANNUAL_PRICE_CENTS, ANNUAL_PER_MONTH_CENTS, TRIAL_DAYS } from "@/lib/pricing";

/**
 * Shared, city-independent page content for /lp/2, /lp/3 and /lp/4.
 *
 * The score card is NOT here any more — it is resolved per city in lp-spot.ts
 * from the city's top-scoring published spot. What remains is copy that is true
 * regardless of which city the route carries.
 *
 * "City-independent" stops at the border. The two strings that name a
 * fisheries authority are built per region at the bottom of this file, because
 * these pages sell in two countries and the authority is the one fact a
 * regulations feature cannot be vague about.
 */

/** Price strings derived from the single source of truth, never retyped. */
export const PRICE = {
  year: `$${(ANNUAL_PRICE_CENTS / 100).toFixed(0)}/year`,
  perMonth: `$${(ANNUAL_PER_MONTH_CENTS / 100).toFixed(2)}/month`,
  trialDays: TRIAL_DAYS,
  /**
   * Stripe fires `customer.subscription.trial_will_end` three days before the
   * trial ends, and src/lib/email-templates/billing.ts sends off that event. On
   * a 7-day trial that is day 4 — the prototype's "Day 5" was a guess.
   */
  reminderDay: TRIAL_DAYS - 3,
} as const;

export interface Feature {
  id: FeatureId;
  title: string;
  /** Small mono tag beside the title, e.g. SMS. */
  tag: string | null;
  desc: string;
}

/**
 * Feature copy. Order is set per angle in lp-angles.ts; this is the library.
 *
 * Claims here are deliberately bounded by what the tier matrix actually ships:
 * 14 days (not "unlimited"), 10 alerts (never "unlimited alerts"), and custom
 * spots inside covered water only — the API returns 422 `outside_coverage`
 * past ~50 km of a live city, so "drop a pin anywhere" would be a promise the
 * product breaks on the customer's first try.
 */
export const FEATURES: Record<FeatureId, Feature> = {
  forecast14: {
    id: "forecast14",
    title: "Full 14-day forecast",
    tag: null,
    desc: "See two weeks ahead, hour by hour. Plan the weekend around the fish — not the other way.",
  },
  alerts: {
    id: "alerts",
    title: "Text alerts when it turns on",
    tag: "SMS",
    desc: "“Oak Bay just hit 82. Best window Saturday 6 AM.” Set your threshold on up to 10 spots and we watch the water.",
  },
  regulations: {
    id: "regulations",
    title: "Regulations, same screen",
    tag: null,
    // Rewritten per region by regulationsDesc() below. This generic
    // both-authorities line stays as the fallback.
    desc: "DFO and WDFW limits, sizes, and openings for your exact subarea — synced daily, next to the conditions.",
  },
  customSpots: {
    id: "customSpots",
    title: "Pin your own spots",
    tag: "PRO",
    desc: "Drop a pin on your own numbers anywhere we cover — your secret mark gets the full model, not just the spots we list.",
  },
  catchLog: {
    id: "catchLog",
    title: "Catch log that learns",
    tag: null,
    desc: "Log catches with the conditions attached. Over a season, see exactly what works for you.",
  },
};

/**
 * Proof band.
 *
 * ⚠️ Every value below is a placeholder. `showProof` is false in production
 * for exactly that reason; replace the figures before turning it back on. The testimonial in particular needs a real, permissioned quote with
 * a real attribution — a fabricated customer voice is not a copy problem, it is
 * a claim we cannot stand behind.
 */
export const PROOF: {
  showProof: boolean;
  stats: ReadonlyArray<{ num: string; label: string }>;
  quote: { text: string; attr: string };
} = {
  // OFF in production, deliberately. The two counts below are invented and the
  // quote is not from a real customer, so the band stayed hidden when these
  // pages shipped rather than putting unverifiable claims under the brand.
  // Flip to true once the numbers are real and the quote is permissioned.
  showProof: false,
  stats: [
    { num: "2,400+", label: "Catches logged" }, // TODO real count
    { num: "180+", label: "Spots scored" }, // TODO real count
    { num: "Hourly", label: "Refresh rate" },
  ],
  quote: {
    text: "Checked the score Saturday morning, saw the window closing at noon, launched at six instead of nine. Two chinook by ten.",
    attr: "PLACEHOLDER · REAL QUOTE REQUIRED",
  },
};

/**
 * The five signal layers behind the score, top row highlighted.
 *
 * Two of them name a fisheries authority, and which one is right depends on
 * the side of the border the city sits on. Tide predictions for a Washington
 * spot come from NOAA rather than DFO stations, and its openings are Marine
 * Areas under WDFW rather than PFMA subareas under DFO. These pages ran the
 * Canadian strings in both countries, which put a false sourcing claim on
 * every US page. The regulator itself comes from lib/regions, so there stays
 * one place that knows which authority governs which region.
 */
export function layersFor(regulator: Regulator) {
  const canadian = regulator.name === "DFO";
  return [
    { label: "Today · Chinook", src: "Fresh catches", top: true },
    { label: "Tide & current", src: canadian ? "DFO stations" : "NOAA stations", top: false },
    { label: "Wind & pressure", src: "ECMWF · GFS", top: false },
    { label: "Water temp & sky", src: "Buoys · NOAA", top: false },
    {
      label: "Season & regulations",
      src: `${regulator.areaLabel} · ${regulator.name}`,
      top: false,
    },
  ];
}

/**
 * The regulations feature, written for the region being sold rather than for
 * both at once. Naming both authorities is accurate and vague; naming theirs
 * is the claim that lands.
 */
export function regulationsDesc(regulator: Regulator): string {
  return `${regulator.name} limits, sizes, and openings for your exact ${regulator.areaLabel} — synced daily, next to the conditions.`;
}
