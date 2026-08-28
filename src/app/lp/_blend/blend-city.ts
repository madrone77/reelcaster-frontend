import { SEATTLE_FRAME, VANCOUVER_FRAME, type ReelFrame } from "../_reel/reel-frame";

/**
 * Everything the blend needs that changes with the city.
 *
 * Small on purpose. Almost nothing on this page is written down per city: the
 * headline, the marks, the strip, the chart, the map and the retention rules
 * all come out of `loadCityBySlug`, and the regulator, the tide authority and
 * the area badge come out of `lpRegionFor` on the spot's own province. What is
 * left here is the three facts nothing upstream can derive.
 *
 * `frame` is the big one, and it is why a city cannot simply be a route
 * parameter: the reel is drawn on a baked still of that city's water, and a
 * still is a capture somebody has to make. See ../_reel/reel-frame.ts.
 */
export interface BlendCity {
  /** The full slug, e.g. "seattle-wa". Also what the campaign counter files
   *  under, which is why it is never the path segment: this route's segment is
   *  `seattle`, and every row in the table carries `seattle-wa`. */
  slug: string;
  /** The capture the hero reel walks. */
  frame: ReelFrame;
  /**
   * The water in the footer line, in the words somebody here would use.
   *
   * Both cities are on the Salish Sea and neither angler calls it that first.
   * A Seattle reader says Puget Sound and a Vancouver reader says the Strait
   * of Georgia, and using the basin name for both would be technically true
   * and read as written by somebody who has not been.
   */
  water: string;
  /**
   * Billing region for the trial variant's checkout, e.g. "WA".
   *
   * Sent rather than inferred. /api/stripe/checkout prices the session with
   * currencyForRegion(), where BC bills CAD and WA bills USD, and left to
   * guess it falls back to geo and then to BC. On the American page that
   * means a reader could be quoted Canadian dollars under a WDFW page
   * whenever the geo lookup came up empty.
   */
  billingRegion: string;
}

export const SEATTLE: BlendCity = {
  slug: "seattle-wa",
  frame: SEATTLE_FRAME,
  water: "Puget Sound",
  billingRegion: "WA",
};

export const VANCOUVER: BlendCity = {
  slug: "vancouver-bc",
  frame: VANCOUVER_FRAME,
  water: "the Strait of Georgia",
  billingRegion: "BC",
};
