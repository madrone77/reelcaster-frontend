import type { FeatureId } from "./lp-angles";
import { ANNUAL_PRICE_CENTS, ANNUAL_PER_MONTH_CENTS, TRIAL_DAYS } from "@/lib/pricing";

/**
 * Shared page content for /lp/2 and /lp/3 that does not change with the angle.
 *
 * ⚠️ THE HERO CARD IS ILLUSTRATIVE, NOT LIVE.
 *
 * Everything in DEMO below is hardcoded so copy angles can be iterated without
 * waiting on a data fetch. `/lp/1/[city]` already does the live version: it
 * loads the city's top-scoring published spot and renders its real score, real
 * best window, and real fresh-catch count. Swapping this page onto live data is
 * a page.tsx change plus a prop spread — the shell reads these fields by name,
 * so nothing in the markup has to move.
 *
 * While it stays hardcoded, the numbers below are a sample day at a real spot,
 * not a claim about right now. That is why the card's freshness chip says
 * UPDATED HOURLY rather than the prototype's "LIVE · 5 MIN AGO": the scoring
 * fan-out is not a five-minute loop, and a static number under a live badge is
 * the one thing on this page a customer could catch us on.
 */
export const DEMO = {
  spotName: "Oak Bay Flats",
  // "NEAR YOU" was true only while this page was Victoria-only. The route now
  // carries a city, so a Nanaimo visitor would be told an Oak Bay spot is near
  // them. Labelled an example instead, which is also what it honestly is.
  meta: "EXAMPLE SPOT · CHINOOK · PEAK SEASON",
  score: 85,
  tagWord: "GOOD",
  windowTime: "06:00 – 13:00",
  windowNote: "Peaks at 87 · Tide flooding",
  freshCatches: 9,
  freshWindowDays: 14,
  /** 24 hourly score bars, midnight → midnight. `on` marks the best window. */
  hours: [
    18, 16, 15, 20, 24, 38, 78, 88, 92, 84, 76, 70, 64, 52, 48, 44, 50, 56, 46,
    34, 24, 18, 14, 12,
  ],
  bestFrom: 6,
  bestTo: 12,
} as const;

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
    desc: "“Oak Bay just hit 82 — best window Saturday 06:00.” Set your threshold on up to 10 spots and we watch the water.",
  },
  regulations: {
    id: "regulations",
    title: "Regulations, same screen",
    tag: null,
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

/** The five signal layers behind the score, top row highlighted. */
export const LAYERS = [
  { label: "Today · Chinook", src: "Fresh catches", top: true },
  { label: "Tide & current", src: "DFO stations", top: false },
  { label: "Wind & pressure", src: "ECMWF · GFS", top: false },
  { label: "Water temp & sky", src: "Buoys · NOAA", top: false },
  { label: "Season & regulations", src: "PFMA · DFO", top: false },
] as const;
