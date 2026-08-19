/**
 * /lp/2 — angle definitions for the card-first trial landing page.
 *
 * One page, several pitches. Meta ad sets point at the same URL and select an
 * angle with `?a=<id>` (or `utm_content=<id>`, so the angle rides along in the
 * UTM you are already tagging). An unknown or absent value falls back to the
 * control, which is the signed-off prototype copy verbatim.
 *
 * An angle owns everything a cold reader meets before they scroll: the H1, the
 * subhead, the eyebrow chip, the order of the feature stack, and the closing
 * line. Everything else on the page is shared, so a test measures the pitch
 * rather than a whole redesign.
 *
 * The angle id is also passed to checkout as `from=lp2-<id>`, which is what
 * lands in the attribution columns — so "which pitch earned the card" is
 * answerable in the bluecaster admin without a separate analytics tool.
 */

/** Feature blocks available to the stack, ordered per angle. */
export type FeatureId =
  | "forecast14"
  | "alerts"
  | "regulations"
  | "customSpots"
  | "catchLog";

export interface Angle {
  id: string;
  /** Internal note — why this pitch exists. Never rendered. */
  rationale: string;
  /** Small chip above the H1. Null hides it. */
  eyebrow: string | null;
  /**
   * Replacement eyebrow for American water, applied only by the US-market
   * variant (/lp/6) through localizeAngle below. Only one angle needs this:
   * the local-knowledge pitch names the coverage area out loud, and "Built for
   * BC and Washington" leads with another country on a Seattle page.
   *
   * Left undefined on region-neutral angles, which is most of them.
   */
  eyebrowUs?: string;
  /**
   * Replacement subhead for American water, applied only by /lp/6.
   *
   * The shared subheads were written to work on either side of the border, so
   * they reach for neutral phrasing like "your local waters". These say the
   * mechanism out loud instead: exchange, slack, the two-week span. That is
   * what an experienced Puget Sound boater is actually listening for, and it
   * is the same argument the instrument treatment makes further down the page.
   *
   * Deliberately free of place names. /lp/6 serves Bellingham and Friday
   * Harbor as well as Seattle, and those are Salish Sea and San Juans rather
   * than Puget Sound proper, so a hardcoded basin here would be wrong on two
   * of its three cities. Locality is carried by the line under the subhead,
   * which is built from the resolved city.
   */
  subheadUs?: string;
  /** Split so the second half can carry the accent colour. */
  headline: { lead: string; accent: string };
  subhead: string;
  /** Order of the feature stack, most persuasive first for this pitch. */
  features: FeatureId[];
  /** Closing band headline, above the final CTA. */
  closer: string;
  /** Button label. Kept per-angle: "Start free trial" is not always the sharpest verb. */
  cta: string;
  /** <title> for this variant. */
  title: string;
}

export const ANGLES: Angle[] = [
  {
    id: "window",
    rationale:
      "Control. The product's actual promise, stated plainly: timing, not luck.",
    eyebrow: null,
    headline: { lead: "Know the exact hours", accent: "to fish." },
    subhead:
      "Tide, current, wind and pressure, combined into one 0-100 score for your local water and updated through the day.",
    subheadUs:
      "Tide exchange, current slack, wind and pressure on one 0-100 score. Every spot on your water, every hour, two weeks out.",
    features: [
      "forecast14",
      "alerts",
      "regulations",
      "customSpots",
      "catchLog",
    ],
    closer: "The next great window is coming. Know when.",
    cta: "Start 7-day free trial",
    title: "Know the exact hours to fish",
  },
  {
    id: "wasted",
    rationale:
      "Loss framing. Cold anglers feel wasted Saturdays more sharply than they feel an upside they have never had.",
    eyebrow: "Stop guessing",
    headline: { lead: "Stop burning Saturdays", accent: "on a dead tide." },
    subhead:
      "Most trips fail before the boat leaves the ramp. One score tells you whether today is worth the fuel, and which day this week actually is.",
    subheadUs:
      "A dead tide burns the same fuel as a good one. One score tells you whether today is worth the run, and which day this week actually is.",
    features: [
      "alerts",
      "forecast14",
      "catchLog",
      "regulations",
      "customSpots",
    ],
    closer: "Your next day off is too expensive to guess with.",
    cta: "Start 7-day free trial",
    title: "Stop burning Saturdays on a dead tide",
  },
  {
    id: "local",
    rationale:
      "Local-knowledge framing. Sells the decades of pattern reading that a newcomer or transplant does not have.",
    eyebrow: "Built for BC and Washington",
    eyebrowUs: "Built for Puget Sound",
    headline: { lead: "Twenty years of local knowledge,", accent: "on your phone." },
    subhead:
      "The guys who always limit out are reading tide, current, and season. ReelCaster reads all of it for every spot near you, every hour.",
    subheadUs:
      "The guys who always limit out are reading the exchange, the current and the season. ReelCaster reads all of it, for every spot near you, every hour.",
    features: [
      "customSpots",
      "regulations",
      "forecast14",
      "alerts",
      "catchLog",
    ],
    closer: "Fish like you have been here thirty years.",
    cta: "Start 7-day free trial",
    title: "Twenty years of local knowledge, on your phone",
  },
  {
    id: "alerts",
    rationale:
      "Single-feature pitch. Sells the text message alone, the one thing that needs no explaining in a Meta feed.",
    eyebrow: "Text alerts",
    headline: { lead: "Get a text", accent: "when the bite turns on." },
    subhead:
      "Set your spot and your threshold. We watch tide, weather, and water around the clock and message you when your window opens.",
    subheadUs:
      "Set your spot and your number. We watch tide, current and weather around the clock and text you the moment your window opens.",
    features: [
      "alerts",
      "customSpots",
      "forecast14",
      "regulations",
      "catchLog",
    ],
    closer: "The water will turn on this week. Be the one who knows.",
    cta: "Start 7-day free trial",
    title: "Get a text when the bite turns on",
  },
];

export const CONTROL_ANGLE = ANGLES[0];

/**
 * Resolve an angle from the query string.
 *
 * Accepts `a` first, then `utm_content` — so an ad set can carry the angle in
 * the UTM it already sets rather than needing a second parameter. Unknown ids
 * fall back to the control rather than 404ing: a mistyped ad URL should still
 * sell something.
 */
export function angleFrom(
  params: Record<string, string | string[] | undefined>,
): Angle {
  const raw = params.a ?? params.utm_content;
  const id = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase().trim();
  if (!id) return CONTROL_ANGLE;
  return ANGLES.find((a) => a.id === id) ?? CONTROL_ANGLE;
}

/**
 * Swap in the American eyebrow where an angle has one.
 *
 * Only /lp/6 calls this. The other variants serve both sides of the border
 * from one URL and keep the neutral wording, so applying it globally would
 * change signed-off copy on pages that are not running this test.
 */
export function localizeAngle(angle: Angle, region: { isUS: boolean }): Angle {
  if (!region.isUS) return angle;
  return {
    ...angle,
    eyebrow: angle.eyebrowUs ?? angle.eyebrow,
    subhead: angle.subheadUs ?? angle.subhead,
  };
}
