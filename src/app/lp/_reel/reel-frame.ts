/**
 * Where a spot lands on a baked Explore map, in the map image's own pixels.
 *
 * The reel in an /lp/<city>/<n> hero shows a still of the real Explore map with
 * its pin layer switched off, and the component draws the pins itself so the
 * one the reel is on can grow, colour and pulse. That only works if this
 * file's arithmetic and MapLibre's agree, because the pins have to sit exactly
 * where the product would have drawn them: a mark half a kilometre inland is
 * the one mistake a reader of a fishing map notices instantly.
 *
 * They do agree. `project()` below was checked against `map.project()` at each
 * capture frame and matched to fifteen decimal places on every test point, so
 * this is the same Web Mercator, not an approximation of it.
 *
 * ── The still is a SHEET, not a screen ───────────────────────────────────
 *
 * A frame's `width`/`height` describe the baked image, which is now larger
 * than the phone screen. The screen is `REEL_VIEW`, a window onto the sheet,
 * and the reel slides that window from mark to mark at a FIXED zoom -- the
 * map moves under the phone the way it does when a thumb drags it, rather
 * than the reader being asked to find the next lit pin somewhere on a static
 * picture of a whole inlet.
 *
 * That is what buys the zoom. One screen had to hold every stop at once, so
 * the frame could only be as tight as the spread of the marks allowed, which
 * for Seattle meant a scale where the seabed was a blue smear. A sheet only
 * has to hold every stop somewhere, so the zoom is now chosen for how the
 * WATER reads and the sheet grows to fit the marks instead.
 *
 * A city whose sheet happens to equal REEL_VIEW simply never pans: `panFor`
 * clamps to (0, 0) at every stop and the reel behaves exactly as it did
 * before this existed. Vancouver is that city today, and no code branches on
 * it.
 *
 * ── One file, every city ─────────────────────────────────────────────────
 *
 * The frame is a PARAMETER rather than a module constant, which is what makes
 * a second city cost a capture rather than a fork. It did not start that way:
 * Seattle's reel, its projection and its 289-line component were copied whole
 * to make a Vancouver twin, and the diff between the two copies was two
 * literals and some rewritten comments. Everything else in them was identical,
 * including the bugs they would eventually grow apart on.
 *
 * ── What must not drift ──────────────────────────────────────────────────
 *
 * A `ReelFrame`'s numbers describe a capture, not a preference. Re-frame the
 * image and every pin moves, so the numbers have to be re-read from the
 * capturing map in the same breath. That is why each city's frame sits in one
 * object with its asset named beside it rather than inline in a component.
 *
 * Both halves are scripted rather than eyeballed:
 * `scripts/solve-reel-frame.mjs` searches the frame and
 * `scripts/capture-reel.mjs` bakes it and prints the projection check.
 */

/** A capture: which still, and the map geometry that produced it. */
import { PUCK } from "@/app/explore/lib/score-puck";

export interface ReelFrame {
  /** The still the pins are drawn on. `width`x`height` at 2x. */
  src: string;
  centerLng: number;
  centerLat: number;
  zoom: number;
  /**
   * CSS pixels of the captured SHEET, which is at least REEL_VIEW and usually
   * larger; the asset is this at 2x.
   */
  width: number;
  height: number;
  /**
   * The region beside the city in the reel's location chip, as Explore's own
   * chip reads it ("King County", "Lower Mainland"). Writing anything else
   * here is the phone in the hero disagreeing with the app it is a picture of.
   */
  regionLabel: string;
}

/** The phone screen: the window the reel slides over the sheet. */
export const REEL_VIEW = { width: 375, height: 724 } as const;

/**
 * Where the active stop is parked inside that window.
 *
 * Horizontally centred; vertically in the middle of the band the chrome
 * leaves free (chip row ends at 130, preview card starts at 503), so the pin
 * the card is describing sits clear of both.
 */
export const REEL_FOCUS = { x: REEL_VIEW.width / 2, y: 316 } as const;

/**
 * Seattle.
 *
 * Explore opens the city on its centroid, which on a portrait phone fills two
 * thirds of the screen with inland King County and pushes the sound to a strip
 * down the left. This centre and zoom were searched for instead.
 *
 * ── Why z11 ──────────────────────────────────────────────────────────────
 *
 * The first frame was solved for stops alone and landed at z8.7, which showed
 * the whole sound from Admiralty Inlet to Renton and seven marks on it. At
 * that scale the seabed is a blue smear: the relief raster is overzoomed and
 * `contour-line` does not draw at all below z10, so the one thing this phone
 * is meant to prove -- that the water has shape, and the marks sit on it --
 * was the thing the reader could not see. The hero was a map of a coastline,
 * which every fishing app has.
 *
 * z11 is well past the contour threshold. Every stop opens on banks, shelves
 * and the drop into the main basin drawn as contours, and the style's own
 * "WDFW Marine Area 10" label sits in the water the reel spends most of its
 * time over, naming in the picture the jurisdiction the page's eyebrow names
 * in words.
 *
 * ── What the sheet costs ─────────────────────────────────────────────────
 *
 * 605x1232 instead of 375x724, which is 149 KB of WebP instead of 94, and it
 * is still the hero's LCP element. That is the price of the zoom: at z11 a
 * single screen holds four marks, and this holds six while showing each of
 * them at a scale where the bottom is legible.
 *
 * Encoded at cwebp -q 75 rather than the -q 82 the earlier one-screen frames
 * used, which is 55 KB off a sheet 2.7x their area. Checked rather than
 * assumed, because the thing at risk is exactly what the zoom was for: the
 * contour lines are hairlines and they are the first thing a quantizer eats.
 * They come through whole. What 75 costs is a little banding in the flat deep
 * water, in a picture that renders about 500 CSS px wide.
 *
 * Six is not all of them. Seattle scores fifteen marks and they run from
 * Point Robinson to Admiralty Inlet, which at this zoom is a sheet four
 * thousand pixels tall and megabytes of image. The reel takes the central
 * corridor -- Apple Tree Point down to Meadow Point -- and the marks band
 * further down the page still lists every one of the fifteen, so nothing is
 * hidden, only unpinned.
 *
 * ── Two things this frame is constrained by ──────────────────────────────
 *
 * `buoy-label` draws NDBC station names from z9.5 up and the reel does not
 * redraw them, so a frame has to place Pt Wells and West Point with their
 * two-line labels either wholly inside the sheet or wholly out of it. A label
 * sliced by the sheet edge is the one artefact a still cannot explain. They
 * are kept rather than switched off: they are real stations feeding real
 * readings, and the preview card quotes those readings.
 *
 * The asset carries a version in its name on purpose. Next's image optimizer
 * keys its cache on the URL, so replacing the bytes underneath a path already
 * in use serves the OLD frame from the edge for as long as that entry lives.
 */
export const SEATTLE_FRAME: ReelFrame = {
  src: "/marketing/seattle-explore-map-v3.webp",
  centerLng: -122.44947,
  centerLat: 47.74149,
  zoom: 11,
  width: 605,
  height: 1232,
  regionLabel: "King County",
};

/**
 * Vancouver, on a panning sheet at z11.
 *
 * ── This reverses #443, on purpose ───────────────────────────────────────
 *
 * #443 framed this city at z9.85 on one still screen, solved off a screenshot
 * of Explore on Casey's own phone, and argued the case against exactly this
 * frame: that three earlier attempts had chased zoom and traded away the thing
 * that makes the screen legible, which is a dozen scored marks on one piece of
 * recognisable water.
 *
 * That argument was made about a SCREEN and this is a SHEET, which is the part
 * that changed. A single screen has to hold every mark at once, so its zoom is
 * capped by how far the marks are spread; a sheet only has to hold each mark
 * somewhere, so the window can sit at the zoom the seabed reads at and travel
 * between them. Seattle took that trade in #440 and this is the same trade.
 *
 * Casey chose it knowing what it costs, so do not "fix" it back on the
 * strength of #443's comment alone. What would justify reverting is the thing
 * #443 was actually protecting: if a reader stops recognising the water.
 *
 * ── What it costs ────────────────────────────────────────────────────────
 *
 * 218 KB against 37, and this is the hero's LCP element. The bytes track the
 * area almost exactly (the first z11 sheet was 971x934 for 190 KB; this one
 * is 1136x965 for 218) so there is no encoding win hiding here: q65 only
 * saves a tenth and spends the contour hairlines, which are the whole reason
 * for the zoom.
 *
 * You also stop seeing all eight marks at once. They are still all there, one
 * stop at a time, and the marks band further down the page lists the roster
 * either way.
 *
 * ── The frame ────────────────────────────────────────────────────────────
 *
 * Moved south on 2026-09-03 so the reel reaches the marks with catch reports.
 * The first z11 sheet was Howe Sound proper, Pam Rocks down to Plumper Cove,
 * and held ONE mark that ever wears the map's "Hot" tag: Bowen Island. The
 * other seventeen Vancouver marks with reports sit south of it, on the water
 * between Bowen's south shore and First Narrows. So the sheet now runs from
 * Queen Charlotte Channel across English Bay to the harbour mouth, and on the
 * day it was solved every one of its eight stops was hot: Bowen Island, Roger
 * Curtis, Worlcombe, Cowan Point, Point Atkinson, West Vancouver, Capilano,
 * First Narrows.
 *
 * Solved by scripts/solve-reel-frame.mjs at z11 (1072x965: the run sized to
 * the safe box rather than a whole window each side, and reaching far enough
 * south of First Narrows for the window to centre the harbour stops instead
 * of parking them against the card under a screen of North Shore), then
 * widened 64 px to the east by hand: the 1072 sheet cut the word "Vancouver"
 * in half at its right edge, which is not a thing to do to a city on its own
 * landing page.
 * The centre is the solve's centre plus 32 px, unrounded, because the
 * capture was made at that value and the projection check is against it.
 * Captured by scripts/capture-reel.mjs, whose check put project() against
 * map.project() at 1.1e-10 px across all eight stops.
 *
 * The closures across Howe Sound stay: they are real, the product draws them,
 * and quietly deleting a regulatory layer from a marketing still of a fishing
 * app is the wrong kind of edit.
 *
 * The asset is `-v4` because Next's image optimizer keys its cache on the URL,
 * so new bytes at the old path would serve the old frame from the edge.
 */
export const VANCOUVER_FRAME: ReelFrame = {
  src: "/marketing/vancouver-explore-map-v4.webp",
  centerLng: -123.291043671875,
  centerLat: 49.32738,
  zoom: 11,
  width: 1136,
  height: 965,
  regionLabel: "Lower Mainland",
};

/**
 * Chrome-free box, in the WINDOW's pixels. Shared by every city, and it has to
 * be: the box describes the reel's own chrome, which is the same markup at the
 * same sizes on every page that draws one.
 *
 * The chip row floats over the top of the screen and the preview card over the
 * bottom, so a stop whose pin lands outside this box once the window has
 * slid to it is a stop the reader cannot see. Those are dropped rather than
 * drawn under the furniture -- which only happens at the sheet's own edges,
 * where the window runs out of room to centre the pin.
 *
 * y1 is measured from the card, not guessed: the card sits 74 screen-px off
 * the bottom and its top edge lands 221 up from the window's, at 503. A pin
 * is the map's own puck, whose badge stands tail plus body above its point
 * (43px when it wears the Hot tag), so the last row whose badge clears the
 * card is that far above 503, less the ring.
 */
const CARD_TOP = 503;
export const REEL_SAFE = {
  x0: 28,
  y0: 130,
  x1: 347,
  y1: CARD_TOP - (PUCK.PILL_H_HOT + PUCK.TAIL_H) - PUCK.RING_W,
} as const;

const TILE = 512;

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) =>
  0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

/** Lng/lat to a pixel in the captured sheet, origin top-left. */
export function project(
  frame: ReelFrame,
  lng: number,
  lat: number,
): { x: number; y: number } {
  const world = TILE * 2 ** frame.zoom;
  return {
    x: (mercX(lng) - mercX(frame.centerLng)) * world + frame.width / 2,
    y: (mercY(lat) - mercY(frame.centerLat)) * world + frame.height / 2,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * How far to slide the sheet to put a sheet pixel under REEL_FOCUS.
 *
 * Clamped to the sheet, so the window never overhangs an edge and shows a
 * gutter. That clamp is why a stop near the top or the bottom of the sheet
 * does not sit dead centre, and why eligibility is tested AFTER panning
 * rather than before.
 */
export function panFor(frame: ReelFrame, x: number, y: number) {
  return {
    tx: clamp(x - REEL_FOCUS.x, 0, Math.max(0, frame.width - REEL_VIEW.width)),
    ty: clamp(y - REEL_FOCUS.y, 0, Math.max(0, frame.height - REEL_VIEW.height)),
  };
}

/** Is a pixel of the WINDOW clear of the reel's own chrome? */
export function inSafeArea(x: number, y: number): boolean {
  return (
    x >= REEL_SAFE.x0 && x <= REEL_SAFE.x1 && y >= REEL_SAFE.y0 && y <= REEL_SAFE.y1
  );
}

/** Percentages, so the sheet can be any width the layout gives it. */
export function placePin(frame: ReelFrame, lng: number, lat: number) {
  const { x, y } = project(frame, lng, lat);
  return {
    x,
    y,
    left: `${(x / frame.width) * 100}%`,
    top: `${(y / frame.height) * 100}%`,
  };
}
