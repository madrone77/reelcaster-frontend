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
 * 190 KB against 37, and this is the hero's LCP element. The bytes track the
 * area almost exactly (971x934 is 1.22x Seattle's sheet, 190 KB is 1.24x its
 * 153) so there is no encoding win hiding here: q65 only reaches 166 KB and
 * spends the contour hairlines, which are the whole reason for the zoom.
 *
 * You also stop seeing all eight marks at once. They are still all there, one
 * stop at a time, and the marks band further down the page lists the roster
 * either way.
 *
 * ── The frame ────────────────────────────────────────────────────────────
 *
 * Solved by scripts/solve-reel-frame.mjs at z11: eight stops from Pam Rocks
 * down Queen Charlotte Channel to Plumper Cove, the best contiguous run the
 * 1000k-px budget holds. Captured by scripts/capture-reel.mjs, whose
 * projection check put project() against map.project() at 1.1e-10 px across
 * all eight.
 *
 * The closures across Howe Sound stay: they are real, the product draws them,
 * and quietly deleting a regulatory layer from a marketing still of a fishing
 * app is the wrong kind of edit.
 *
 * The asset is `-v3` because Next's image optimizer keys its cache on the URL,
 * so new bytes at the old path would serve the old frame from the edge.
 */
export const VANCOUVER_FRAME: ReelFrame = {
  src: "/marketing/vancouver-explore-map-v3.webp",
  centerLng: -123.3757,
  centerLat: 49.42989,
  zoom: 11,
  width: 971,
  height: 934,
  regionLabel: "Lower Mainland",
};

/**
 * Victoria, on a panning sheet at z11.
 *
 * The densest of the five and the most expensive, and both facts have the
 * same cause. Solved by scripts/solve-reel-frame.mjs at z11 into eight stops
 * -- the most any city has -- running Esquimalt Harbour Entrance to Trial
 * Islands along the whole Victoria waterfront, with Oak Bay Flats and Trial
 * Islands, the two best-scoring marks in the roster, both on it.
 *
 * 353 KB against Vancouver's 190 on a sheet of almost exactly the same area
 * (905k px against 907k). That is not slack in the encode: q65 only reaches
 * 314 KB, an 11% saving that comes straight out of the contour hairlines the
 * zoom exists to show. The bytes are the picture. Juan de Fuca and Haro
 * Strait carry far more NONNA detail than Howe Sound, and this is the hero's
 * LCP element, so it is the one frame here worth re-checking if the paid
 * numbers ever look slow.
 *
 * The sheet cannot usefully be smaller. The eight stops span 667x144 px; the
 * rest of the 1043x868 is the room the 375x724 window needs to centre on the
 * outer two, which is also why the Saanich Peninsula fills the top third
 * carrying no marks. A 743k-px alternative exists at six stops and drops both
 * Oak Bay Flats and Discovery Island, which is the wrong trade.
 *
 * The Race Rocks and Trial Islands closures stay, for the reason they stay
 * everywhere: they are real, the product draws them, and deleting a
 * regulatory layer from a marketing still of a fishing app is the wrong kind
 * of edit.
 */
export const VICTORIA_FRAME: ReelFrame = {
  src: "/marketing/victoria-explore-map-v1.webp",
  centerLng: -123.32895,
  centerLat: 48.41124,
  zoom: 11,
  width: 1043,
  height: 868,
  regionLabel: "South Vancouver Island",
};

/**
 * Nanaimo, on a panning sheet at z11.
 *
 * Six stops from Neck Point down past Hudson Rocks, Five Finger Island and
 * Snake Island Reef to Entrance Island and the Gabriola Bluffs: the run an
 * angler out of Nanaimo actually works, north to south, in that order.
 *
 * The cheapest sheet of the five at 171 KB, because the top third is the open
 * Strait of Georgia, which is deep, flat and nearly featureless. That is
 * honest rather than lucky -- the strait IS flat there, and the contrast with
 * the banks and passes the stops sit on is most of what the picture argues.
 */
export const NANAIMO_FRAME: ReelFrame = {
  src: "/marketing/nanaimo-explore-map-v1.webp",
  centerLng: -123.88128,
  centerLat: 49.21484,
  zoom: 11,
  width: 846,
  height: 944,
  regionLabel: "Mid Vancouver Island",
};

/**
 * Friday Harbor, on a panning sheet at z11.
 *
 * Four stops -- Eagle Point, Cattle Point, Mackaye Harbor and Iceberg Point --
 * which is the fewest of the five and is the roster's doing, not the solver's:
 * at z11 the San Juans spread their scored marks across more water than one
 * affordable sheet holds, and the contiguous run that fits is the south end of
 * San Juan Island and Lopez. The marks band further down the page still lists
 * every one of the twenty, so nothing is hidden, only unpinned.
 *
 * The picture earns the zoom more than any other city's. Cattle Point, Salmon
 * Bank and San Juan Channel are drawn as banks, shelves and a tide-scoured
 * trench, with the style's own "WDFW Marine Area 7" label sitting in the water
 * the reel spends most of its time over -- naming in the picture the
 * jurisdiction the page's eyebrow names in words.
 *
 * There is a visible horizontal seam in the deep water on the left, where the
 * bathymetry source changes. It is in the product too. Left alone on the same
 * principle as the closures: a marketing still of this map should be this map.
 */
export const FRIDAY_HARBOR_FRAME: ReelFrame = {
  src: "/marketing/friday-harbor-explore-map-v1.webp",
  centerLng: -122.96555,
  centerLat: 48.4371,
  zoom: 11,
  width: 803,
  height: 885,
  regionLabel: "San Juan County",
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
 * the bottom and stands about 221 tall with its FULL REPORT row, which puts its
 * top edge at 503. A pin draws its badge some 28px above its own point, so
 * 462 is the last row whose badge clears the card.
 */
export const REEL_SAFE = { x0: 28, y0: 130, x1: 347, y1: 462 } as const;

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
