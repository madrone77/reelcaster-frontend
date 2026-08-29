import {
  SEATTLE_FRAME,
  VANCOUVER_FRAME,
  type ReelFrame,
} from "../_reel/reel-frame";

/**
 * Everything the city-first landing page needs that changes with the city.
 *
 * Small on purpose, and it has to stay that way. Almost nothing on that page
 * is written down per city: the marks, the strip, the scoring ladder, the
 * hero score and the whole FAQ come out of `resolveLpCard` and `fetchMapSpots`
 * on the slug below, and the regulator, the tide authority and the area badge
 * come out of `lpRegionFor` on the spot's own province. Adding a field here
 * should feel like a defeat: it means a fact the data could have answered is
 * now typed in two places, free to disagree.
 *
 * Same shape and same reasoning as ../_blend/blend-city.ts, deliberately kept
 * separate because the two pages need different facts. The blend needs a
 * billing region because it can start a checkout; this page never asks for a
 * card, so it does not.
 */
/**
 * The where/what/when photograph, and what the caption may claim about it.
 *
 * `mark` is the spot's name EXACTLY as `fishing_spots.name` has it, because
 * the caption prints it and a landing page naming a mark the app does not is
 * the kind of error a local reader catches instantly. "The Bell Buoy" is a
 * real published Vancouver spot in DFO subarea 29-3; "Jefferson Head" is a
 * Seattle one in WDFW Marine Area 10.
 */
export interface City1Shot {
  src: string;
  /** Intrinsic pixels of the asset, for next/image. */
  width: number;
  height: number;
  /** The mark pictured, spelled as the app spells it. */
  mark: string;
}

export interface City1City {
  /**
   * The full slug, e.g. "seattle-wa". Never the path segment.
   *
   * The route's segment is `seattle` while every row in the campaign table
   * carries `seattle-wa`, and reading the segment would split one city across
   * two values of the column the report groups by.
   */
  slug: string;
  /**
   * The landing key this page counts under.
   *
   * Written down rather than derived from the slug because it is a name in a
   * database that already has rows under it, and a derivation that produced
   * "lpseattlewa" would silently start a second series for the same page.
   */
  landing: string;
  /** The capture the hero reel walks. See ../_reel/reel-frame.ts. */
  frame: ReelFrame;
  /**
   * The species named in the hero subhead, in the words an angler on this
   * water uses.
   *
   * These are checked against the city's own roster rather than picked: both
   * lists below are that city's four most widely present species. Naming a
   * fish nobody targets there is the same mistake as naming the wrong
   * regulator, just harder to spot.
   *
   * The slang is local and it matters. A Puget Sound angler says Kings, a
   * Strait of Georgia angler says Springs, and both mean Chinook. Writing
   * "Chinook" on both would be correct and would read as written by somebody
   * who has not been.
   */
  heroSpecies: string;
  /**
   * "colored" or "coloured".
   *
   * The one word in Casey's hero copy that changes with the market. Seattle's
   * page is American traffic and spells it American; a BC page that did the
   * same would be the only Canadian spelling error on a page otherwise
   * careful enough to name DFO and CHS correctly.
   */
  colourVerb: string;
  /**
   * The where/what/when render: a photograph of one real spot page on THIS
   * city's own water.
   *
   * It used to be one shared image of Jefferson Head, in WDFW Marine Area 10,
   * with a runtime test against the city's roster deciding whether to caption
   * it as the reader's water or as "an example from Washington". That test
   * existed only because one screenshot had to serve every city, and the
   * fallback caption was the honest way to stop a WDFW area label implying it
   * governs Canadian water.
   *
   * Giving each city its own shot removes the question rather than answering
   * it: every reader now sees a mark they could launch at, under the regulator
   * that actually governs it, and there is no branch left to get wrong. That
   * is why this is required rather than optional -- a city added without one
   * would otherwise silently fall back to another jurisdiction's screen.
   */
  shot: City1Shot;
  /**
   * The water in the footer line, in the words somebody here would use.
   *
   * Seattle says "the Salish Sea" because that is what shipped and this page
   * is mid-series; ../_blend/blend-city.ts makes the better argument for the
   * local basin name, and Vancouver follows it.
   */
  footerWater: string;
}

export const SEATTLE_1: City1City = {
  slug: "seattle-wa",
  landing: "lpseattle1",
  frame: SEATTLE_FRAME,
  heroSpecies: "Halibut, Coho, Kings or Lings",
  colourVerb: "colored",
  shot: {
    src: "/marketing/where-what-when-seattle.png",
    width: 1453,
    height: 1820,
    mark: "Jefferson Head",
  },
  footerWater: "the Salish Sea",
};

export const VANCOUVER_1: City1City = {
  slug: "vancouver-bc",
  landing: "lpvancouver1",
  frame: VANCOUVER_FRAME,
  heroSpecies: "Halibut, Coho, Springs or Lings",
  colourVerb: "coloured",
  shot: {
    src: "/marketing/where-what-when-vancouver.png",
    width: 1394,
    height: 1820,
    mark: "The Bell Buoy",
  },
  footerWater: "the Strait of Georgia",
};
