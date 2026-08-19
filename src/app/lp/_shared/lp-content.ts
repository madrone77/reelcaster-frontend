import type { FeatureId } from "./lp-angles";
import type { LpCard } from "./lp-spot";
import type { LpRegion } from "./lp-region";
import { ANNUAL_PRICE_CENTS, ANNUAL_PER_MONTH_CENTS, TRIAL_DAYS } from "@/lib/pricing";

/**
 * Shared page content for /lp/2 and /lp/3.
 *
 * The score card is NOT here: it is resolved per city in lp-spot.ts from the
 * city's busiest published spot. Neither is the feature copy any more. What
 * stays a constant here is price and trial terms, which are the same wherever
 * the ad was bought; everything that names a spot, an agency or a management
 * area is built from the card and the region, because those are exactly the
 * details a cold visitor uses to decide whether this product knows their
 * water.
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
  /**
   * Mono chip under the description, naming the concrete thing the feature
   * gives you. Separate from `tag` because `tag` marks the tier or channel
   * ("PRO", "SMS") while this names the substance ("HOUR BY HOUR"). On a phone
   * this is the line a skimming reader actually stops on.
   */
  badge: string | null;
  desc: string;
}

/**
 * Feature copy, built per city and per jurisdiction.
 *
 * This used to be a static record, and the two things it hardcoded were the
 * two things a cold visitor checks first. The alert example named Oak Bay on
 * every page, so a Seattle ad set sold Puget Sound anglers a Victoria spot;
 * and the regulations line read "DFO and WDFW" at once, which names the wrong
 * country half the time and reads as a template the rest of it. Both now come
 * from the card and the region the card resolved, so the page talks about the
 * water the ad was bought for.
 *
 * The copy leans on the signals the model genuinely carries. Tidal current
 * speed, tide range, pressure trend, moon phase and rigger depth are all real
 * columns (ConditionsV1, migration 093), which is why they are safe to name.
 * Anything we do not actually compute stays off this page no matter how well
 * it would sell.
 *
 * Claims stay bounded by what the tier matrix ships: 14 days (not
 * "unlimited"), 10 alerts (never "unlimited alerts"), and custom spots inside
 * covered water only. The API returns 422 `outside_coverage` past ~50 km of a
 * live city, so "drop a pin anywhere" would be a promise the product breaks on
 * the customer's first try.
 */
export function buildFeatures(
  card: LpCard,
  region: LpRegion,
): Record<FeatureId, Feature> {
  return {
    forecast14: {
      id: "forecast14",
      title: "Fourteen days of tides and windows",
      tag: null,
      badge: "HOUR BY HOUR",
      desc: "Every hour for two weeks: tide exchange, current slack, pressure trend and moon phase. Pick the day off that is actually worth taking.",
    },
    alerts: {
      id: "alerts",
      title: "A text when it turns on",
      tag: "SMS",
      badge: "UP TO 10 SPOTS",
      // The example names the spot this city's card is already built on, so
      // the sample message reads as local instead of as someone else's water.
      desc: `“${card.spotName} hit 84 for ${card.species}. Best window Saturday 6-9am.” Set the score you care about and we watch the water around the clock.`,
    },
    regulations: {
      id: "regulations",
      title: "Limits and openings on the same screen",
      tag: null,
      badge: region.areaBadge,
      desc: `${region.areaModifier} limits, sizes and openings for the exact water you are looking at, checked daily and shown beside the score.`,
    },
    customSpots: {
      id: "customSpots",
      title: "Your own numbers, scored",
      tag: "PRO",
      badge: "PRIVATE TO YOU",
      desc: "Drop a pin on the ledge or the rip you found yourself, anywhere inside the water we cover. It runs the same model as the spots we list, and the position never leaves your account.",
    },
    catchLog: {
      id: "catchLog",
      title: "A catch log that reads the water back",
      tag: null,
      badge: "CONDITIONS SAVED",
      desc: "Log a fish and the tide height, current, pressure and rigger depth are saved with it. Over a season it shows you the pattern you have been fishing without knowing it.",
    },
  };
}

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
 * Built per region because two of these rows name an agency, and the agency
 * changes at the border. Tide predictions in particular do NOT follow the
 * fisheries regulator: Canadian water is CHS, American water is NOAA CO-OPS,
 * and the old static row credited "DFO stations" for both.
 *
 * The tide row also names current speed rather than just tide, because that is
 * the distinction an experienced angler is listening for. Anyone can read a
 * high tide off a table. Knowing the flow across a bank, and when it goes
 * slack, is the thing worth paying for, and `tidal_current_speed_kt` is a real
 * field rather than a line of ad copy.
 */
export function buildLayers(card: LpCard, region: LpRegion) {
  return [
    { label: `Today \u00B7 ${card.species}`, src: "Fresh catches", top: true },
    {
      label: "Tide height & current speed",
      src: `${region.tideAuthority} \u00B7 SalishSeaCast`,
      top: false,
    },
    { label: "Wind & pressure", src: "ECMWF \u00B7 GFS", top: false },
    { label: "Water temp & sky", src: "Buoys \u00B7 NOAA", top: false },
    {
      label: "Season & regulations",
      src: `${region.regulator.areaLabel} \u00B7 ${region.regulator.name}`,
      top: false,
    },
  ] as const;
}
