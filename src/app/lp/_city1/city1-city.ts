import {
  SEATTLE_FRAME,
  TACOMA_FRAME,
  VANCOUVER_FRAME,
  type ReelFrame,
} from "../_reel/reel-frame";
import type { AlertSmsParts } from "./alert-sms";

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

/**
 * The variants that render this page.
 *
 * 1 is the shipped city-first page. 4 is the same page with the WHERE / WHAT /
 * WHEN screenshot replaced by a live conditions phone -- one variable, so the
 * pair reads as an experiment rather than as two pages. 5 is 4 with the
 * conditions phone swapped for the screenshot's own subject, rendered: the top
 * of one named spot page drawn from the product's components, with the three
 * callouts measured onto it (where-what-when-phone.tsx). It keeps 4's alert
 * band and shows 4's day chart as a fourth band under it, so 5 carries every
 * screen the family has: the map, the spot, the text, and the day.
 */
export type City1Variant = 1 | 4 | 5;

/**
 * A named mark and the species to draw it for, when the roster's own ranking
 * would pick something else.
 *
 * `species` is matched as a substring against the SPOT's own species roster,
 * so "Chinook" finds "Chinook Salmon" without this file having to carry an id
 * or track how the name is spelled at display time.
 */
export interface City1Mark {
  /** The spot's slug, e.g. "the-bell-buoy-df74f1". Not its name. */
  slug: string;
  /** Species display name, or enough of it to match. */
  species: string;
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
   * The landing key each variant counts under.
   *
   * Written down rather than derived from the slug because these are names in
   * a database that already has rows under them, and a derivation that
   * produced "lpseattlewa" would silently start a second series for the same
   * page. Keyed by variant so the two arms cannot land in one bucket, which
   * would make the experiment unreadable in exactly the way that is hard to
   * notice: a healthy-looking row that is two pages added together.
   */
  landing: Record<City1Variant, string>;
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
   * The mark and species /lp/<city>/4's live phone draws, when the hero
   * ranking is not the answer.
   *
   * Optional, and the default is the hero mark, so the phone cannot quietly
   * draw one piece of water while the reel and the H1 are about another. Set
   * it when the section is about a specific mark -- which this section always
   * was: the still it replaces is a photograph of one named spot page, and
   * `shot.mark` above names it in the caption.
   *
   * Falls back on its own if the named species is not scored there today; see
   * load-conditions.ts. A slug that does not resolve costs the phone and
   * restores the still, not the page.
   */
  conditionsMark?: City1Mark;
  /**
   * The mark /lp/<city>/5's rendered where/what/when phone draws, and the
   * species its card opens on.
   *
   * REQUIRED, and typed by hand rather than derived from a ranking, at Casey's
   * call: when a city is set up, ASK HIM which spot this is. Neither ranking
   * answers it by itself. The score ranking (what the hero uses) can lead with
   * a mark nobody has heard of, and the report ranking (what the reel leads
   * with once it ranks on reports) can lead with the busiest mark on a poor
   * day. This is the page's second screen, so it is a choice, not a fallback.
   * Same shape as `conditionsMark`, and `species` is matched against the
   * spot's own roster the same way; see load-picture.ts.
   *
   * A slug that does not resolve, or a payload with no scored species, costs
   * the phone and restores the still (`shot`), not the page.
   */
  pictureMark: City1Mark;
  /**
   * The alert text the third phone on /lp/<city>/4 and /5 shows arriving.
   *
   * The format is the alert engine's own (see alert-sms.ts); these are the
   * parts it prints. Frozen at build rather than read live, because it is a
   * picture of a message and dressing that up as live is the dishonest
   * option. Two rules, both about not advertising something the product would
   * not say: the mark must be one we really score, and the hour must be one it
   * really peaks at.
   *
   * Unset drops the band. A city with no reviewed copy shows no phone rather
   * than a made-up one.
   */
  alertSms?: AlertSmsParts;
  /**
   * The clock on the bubble. Written down, not read: a mock that says it
   * arrived "now" on every page load is the detail that gives it away.
   */
  alertSmsTime?: string;
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
  landing: { 1: "lpseattle1", 4: "lpseattle4", 5: "lpseattle5" },
  frame: SEATTLE_FRAME,
  heroSpecies: "Halibut, Coho, Kings or Lings",
  colourVerb: "colored",
  shot: {
    src: "/marketing/where-what-when-seattle.png",
    width: 1453,
    height: 1820,
    mark: "Jefferson Head",
  },
  // Casey's pick (2026-09-03): the mark the /1 still pictures, so /5's picture
  // and /1's photograph are the same spot page. Coho is the one species
  // scored there, so the screen draws no card row and the "What?" callout
  // lands on the header pill instead; see where-what-when-phone.tsx.
  pictureMark: { slug: "jefferson-head-d0d536", species: "Coho" },
  // Jefferson Head is a real Seattle mark in WDFW Marine Area 10, and 7am is
  // really where it peaks -- Coho hits its high at hour 7 there.
  // ⚠ The species and the score are Casey's copy, not today's data: Seattle's
  // table is scoring Coho and Halibut, with no Chinook in it at all, and its
  // Jefferson Head peak is 84 rather than 95. Swap to
  // { species: "Coho Salmon", score: 84 } to make the whole line live-true.
  alertSms: { species: "King Salmon", spot: "Jefferson Head", score: 95, hour: 7 },
  alertSmsTime: "6:04",
  footerWater: "the Salish Sea",
};

export const VANCOUVER_1: City1City = {
  slug: "vancouver-bc",
  landing: { 1: "lpvancouver1", 4: "lpvancouver4", 5: "lpvancouver5" },
  frame: VANCOUVER_FRAME,
  heroSpecies: "Halibut, Coho, Springs or Lings",
  colourVerb: "coloured",
  shot: {
    src: "/marketing/where-what-when-vancouver.png",
    width: 1394,
    height: 1820,
    mark: "The Bell Buoy",
  },
  // The same mark the shot above pictures, so /4's phone and /1's screenshot
  // are the same spot page. Chinook because that is what the Bell Buoy is
  // fished for; it is scored there, and the loader falls through rather than
  // drawing an empty chart on a day it is not.
  conditionsMark: { slug: "the-bell-buoy-df74f1", species: "Chinook" },
  // Casey's pick (2026-09-03): the same mark again, for the same reason as
  // conditionsMark, so /1, /4 and /5 all picture one spot page.
  pictureMark: { slug: "the-bell-buoy-df74f1", species: "Chinook" },
  // The same mark the phone above draws, and its real peak: Chinook scores at
  // The Bell Buoy and hour 6 is where it peaks.
  alertSms: { species: "Chinook", spot: "The Bell Buoy", score: 82, hour: 6 },
  alertSmsTime: "5:58",
  footerWater: "the Strait of Georgia",
};

/**
 * Tacoma. Only /lp/tacoma/5 renders today; the 1 and 4 keys exist because
 * the type asks for every variant, so a /1 or /4 route added later counts
 * under its own name from the first hit rather than under a placeholder.
 */
export const TACOMA_1: City1City = {
  slug: "tacoma-wa",
  landing: { 1: "lptacoma1", 4: "lptacoma4", 5: "lptacoma5" },
  frame: TACOMA_FRAME,
  // Tacoma's roster: Chinook and Coho are present at every one of its twelve
  // marks, Lingcod and Rockfish at the Narrows, Point Defiance and Colvos.
  // No Halibut here (south Sound), so it is not named. Puget Sound says Kings.
  heroSpecies: "Kings, Coho, Lings or Rockfish",
  colourVerb: "colored",
  shot: {
    src: "/marketing/where-what-when-tacoma.png",
    width: 1414,
    height: 1848,
    mark: "Point Defiance (Clay Banks)",
  },
  // Casey's pick (2026-09-03): "use point defiance or clay banks as the
  // spots". One published mark carries both names, and it is the mark the
  // shot above pictures, so /5's picture and its still are the same spot
  // page. Chinook because that is what Clay Banks is fished for, and it is
  // scored there; the loader falls through to the homepage's pick on a day
  // it is not.
  conditionsMark: { slug: "point-defiance-clay-banks--ebea31", species: "Chinook" },
  pictureMark: { slug: "point-defiance-clay-banks--ebea31", species: "Chinook" },
  // The same mark, and its real peak on the day this was written: Chinook
  // scored 85 at Point Defiance with its high at hour 7, WDFW Marine Area 11.
  alertSms: { species: "King Salmon", spot: "Point Defiance (Clay Banks)", score: 85, hour: 7 },
  alertSmsTime: "6:04",
  footerWater: "the South Sound",
};
