import type { FeatureId } from "./lp-angles";
import type { LpCard } from "./lp-spot";
import type { LpRegion } from "./lp-region";
import { ANNUAL_PRICE_CENTS, ANNUAL_PER_MONTH_CENTS, TRIAL_DAYS } from "@/lib/pricing";

/**
 * Shared page content for /lp/2, /lp/3 and /lp/5.
 *
 * The score card is NOT here: it is resolved per city in lp-spot.ts from the
 * city's busiest published spot. Price and trial terms are, because they are
 * the same wherever the ad was bought. Everything that names a spot, an agency
 * or a management area is built from the card and its region, because those
 * are exactly the details a cold visitor uses to decide whether this product
 * knows their water.
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

/**
 * How the body of the page is dressed.
 *
 * `classic` is the signed-off treatment that /lp/2 and /lp/3 shipped with:
 * benefit-led copy and plain line icons on white. `instrument` is the /lp/5
 * treatment aimed at experienced Salish Sea and Puget Sound boaters, who read
 * a generic feature list as a beginner's app. It names the actual signals the
 * model carries, and draws its glyphs as instrument faces rather than as the
 * usual bell and calendar set.
 *
 * The two exist side by side so /lp/5 is a real test against /lp/3 rather than
 * a redesign that quietly replaces it. Everything outside this switch (price,
 * trial terms, the score card, and the region facts below) is deliberately
 * identical between them, so the test measures the treatment and nothing else.
 */
export type LpTreatment = "classic" | "instrument";

export interface Feature {
  id: FeatureId;
  title: string;
  /** Small mono tag beside the title, e.g. SMS. */
  tag: string | null;
  /**
   * Mono chip under the description naming the concrete thing you get.
   * Separate from `tag`, which marks the tier or channel ("PRO", "SMS"),
   * while this names the substance ("HOUR BY HOUR"). Only the instrument
   * treatment draws these; classic leaves them null.
   */
  badge: string | null;
  desc: string;
}

/**
 * Feature copy, built per city, per jurisdiction and per treatment.
 *
 * This used to be a static record, and the two things it hardcoded were the
 * two things a cold visitor checks first. The alert example named Oak Bay on
 * every page, so a Seattle ad set sold Puget Sound anglers a Victoria spot;
 * and the regulations line read "DFO and WDFW" at once, which names the wrong
 * country half the time and reads as a template the rest of it. Both are now
 * resolved, in BOTH treatments, because they are plain defects rather than a
 * matter of style. Only the wording around them varies by treatment.
 *
 * Claims stay bounded by what the tier matrix ships: 14 days (not
 * "unlimited"), 10 alerts (never "unlimited alerts"), and custom spots inside
 * covered water only. The API returns 422 `outside_coverage` past ~50 km of a
 * live city, so "drop a pin anywhere" would be a promise the product breaks on
 * the customer's first try.
 *
 * The instrument copy additionally leans on signals the model genuinely
 * carries: tidal current speed and slack, tide range, pressure trend, moon
 * phase and rigger depth are all real columns (ConditionsV1, migration 093),
 * which is why they are safe to name. Anything we do not actually compute
 * stays off this page no matter how well it would sell.
 */
export function buildFeatures(
  card: LpCard,
  region: LpRegion,
  treatment: LpTreatment = "classic",
): Record<FeatureId, Feature> {
  if (treatment === "instrument") {
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

  // Classic: the signed-off wording, with only the region defects corrected.
  return {
    forecast14: {
      id: "forecast14",
      title: "Full 14-day forecast",
      tag: null,
      badge: null,
      desc: "See two weeks ahead, hour by hour. Plan the weekend around the fish, not the other way.",
    },
    alerts: {
      id: "alerts",
      title: "Text alerts when it turns on",
      tag: "SMS",
      badge: null,
      // Names the spot this city's card is already built on, so the sample
      // message reads as local rather than as somebody else's water.
      desc: `“${card.spotName} just hit 82. Best window Saturday 6 AM.” Set your threshold on up to 10 spots and we watch the water.`,
    },
    regulations: {
      id: "regulations",
      title: "Regulations, same screen",
      tag: null,
      badge: null,
      desc: `${region.areaModifier} limits, sizes, and openings for your exact area, synced daily, next to the conditions.`,
    },
    customSpots: {
      id: "customSpots",
      title: "Pin your own spots",
      tag: "PRO",
      badge: null,
      desc: "Drop a pin on your own numbers anywhere we cover. Your secret mark gets the full model, not just the spots we list.",
    },
    catchLog: {
      id: "catchLog",
      title: "Catch log that learns",
      tag: null,
      badge: null,
      desc: "Log catches with the conditions attached. Over a season, see exactly what works for you.",
    },
  };
}

/**
 * The five signal layers behind the score, top row highlighted.
 *
 * Built per region because two of these rows name an agency, and the agency
 * changes at the border. Tide predictions in particular do NOT follow the
 * fisheries regulator: Canadian water is CHS, American water is NOAA CO-OPS,
 * and the old static row credited "DFO stations" for both.
 *
 * The instrument treatment additionally renames the tide row to say current
 * speed out loud, because that is the distinction an experienced angler is
 * listening for. Anyone can read a high tide off a table. Knowing the flow
 * across a bank, and when it goes slack, is the thing worth paying for, and
 * `tidal_current_speed_kt` is a real field rather than a line of ad copy.
 */
export function buildLayers(
  card: LpCard,
  region: LpRegion,
  treatment: LpTreatment = "classic",
) {
  const instrument = treatment === "instrument";
  return [
    { label: `Today · ${card.species}`, src: "Fresh catches", top: true },
    {
      label: instrument ? "Tide height & current speed" : "Tide & current",
      src: instrument
        ? `${region.tideAuthority} · SalishSeaCast`
        : `${region.tideAuthority} stations`,
      top: false,
    },
    { label: "Wind & pressure", src: "ECMWF · GFS", top: false },
    { label: "Water temp & sky", src: "Buoys · NOAA", top: false },
    {
      label: "Season & regulations",
      src: `${region.regulator.areaLabel} · ${region.regulator.name}`,
      top: false,
    },
  ] as const;
}

/**
 * Proof band.
 *
 * The quote is real, permissioned, and reproduced verbatim. It is a customer's
 * own words about his own experience, so it is not edited for length or
 * house style: trimming a testimonial to fit a layout is how a real quote
 * starts sounding like copy we wrote. In particular the em dash rule does not
 * apply to it, and neither does the plain-language rule. It is his sentence.
 *
 * Attributed by region rather than by city, at the customer's direction. He
 * fishes out of Victoria, which is Pacific Northwest, so this is accurate at a
 * coarser grain rather than relocated. That distinction is the whole point: a
 * broader true attribution travels to the Washington pages honestly, whereas
 * moving him to Seattle to suit the page he sits on would be a fabrication no
 * matter how true the sentence itself is.
 *
 * The stats are counted from the production database rather than estimated.
 * Each one below records what it counts and when it was checked, because a
 * number with no provenance is indistinguishable from a number someone made
 * up, which is exactly how the previous set got here.
 *
 * ⚠️ These are point-in-time counts, not live values. Re-check them before
 * quoting them anywhere else, and re-run the queries in the comments rather
 * than nudging the figures.
 */
export const PROOF: {
  showProof: boolean;
  stats: ReadonlyArray<{ num: string; label: string }>;
  quote: { text: string; attr: string };
} = {
  // ON. The quote is real and permissioned, and every figure below is counted
  // from production rather than estimated, which were the two conditions this
  // flag was waiting on.
  showProof: true,
  stats: [
    // select count(distinct spot_id) from session_scores  ->  184 (2026-08-19)
    { num: "180+", label: "Spots scored" },
    // select count(*) from cities where lifecycle='published'  ->  9 (2026-08-19)
    { num: "9", label: "Cities covered" },
    // Scoring is a per-city fan-out on an hourly cadence, which is the same
    // claim the score card's freshness chip makes.
    { num: "Hourly", label: "Refresh rate" },
  ],
  quote: {
    // Given by the customer 2026-08-19. Verbatim.
    text: "ReelCaster has completely changed how I plan my fishing trips. It brings together tides, currents, wind, swell, and water temperature in one place, then pinpoints the best times and locations to fish. It saves me time and gives me real confidence I\u2019m on the water when conditions are ideal.",
    attr: "Bob N., PNW Fisherman",
  },
};
