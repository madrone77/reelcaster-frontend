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
 * A `ReelFrame`'s four numbers describe a capture, not a preference. Re-frame
 * the image and every pin moves, so the numbers have to be re-read from the
 * capturing map in the same breath. That is why each city's frame sits in one
 * object with its asset named beside it rather than inline in a component.
 *
 * The frames themselves were solved rather than eyeballed, by searching centre
 * and zoom for the framing that leaves the most scored marks inside REEL_SAFE
 * after decluttering, tie-broken on how far the reel travels. See the reel
 * capture procedure in the notes for the Playwright half.
 */

/** A capture: which still, and the map geometry that produced it. */
export interface ReelFrame {
  /** The still the pins are drawn on. `width`x`height` at 2x. */
  src: string;
  centerLng: number;
  centerLat: number;
  zoom: number;
  /** CSS pixels of the captured canvas; the asset is this at 2x. */
  width: number;
  height: number;
  /**
   * The region beside the city in the reel's location chip, as Explore's own
   * chip reads it ("King County", "Lower Mainland"). Writing anything else
   * here is the phone in the hero disagreeing with the app it is a picture of.
   */
  regionLabel: string;
}

/**
 * Seattle.
 *
 * Explore opens the city on its centroid, which on a portrait phone fills two
 * thirds of the screen with inland King County and pushes the sound to a strip
 * down the left. This centre and zoom were searched for instead.
 *
 * ── Why z10.5 and not z8.7 ───────────────────────────────────────────────
 *
 * The first frame was solved for stops alone and landed at z8.7, which showed
 * the whole sound from Admiralty Inlet to Renton and seven marks on it. At
 * that scale the seabed is a blue smear: the relief raster is overzoomed and
 * `contour-line` does not draw at all below z10, so the one thing this phone
 * is meant to prove — that the water has shape, and the marks sit on it — was
 * the thing the reader could not see. The hero was a map of a coastline, which
 * every fishing app has.
 *
 * z10.5 crosses the contour threshold with room to spare. Possession Bar, the
 * Edmonds shelf and the drop into the main basin all read as structure, the
 * frame is mostly water rather than mostly Kitsap, and the style's own
 * "WDFW Marine Area 10" label lands mid-frame, which is the same jurisdiction
 * the page's eyebrow names in words.
 *
 * What it costs, and it is a real cost: five stops instead of seven. Half the
 * city's scored marks are now outside the frame. The five that remain
 * (Kingston Reef, Edmonds Oil Tanks, Jefferson Head, Shilshole, Meadow Point)
 * walk 131 to 458 down the safe box with no two closer than 38px, so the reel
 * still travels; it just travels over less water. The marks band further down
 * the page still lists every one of them, so nothing is hidden, only unpinned.
 *
 * Also lost, as before, is the "Seattle" place label. It was already behind
 * the preview card at z8.7 and is off-frame now. The chip row says Seattle in
 * words, which is the cheaper of the two to lose.
 *
 * ── Two things this frame is constrained by ──────────────────────────────
 *
 * `buoy-label` draws NDBC station names at this zoom and the reel does not
 * redraw them, so the centre also had to place Pt Wells and West Point with
 * their two-line labels either wholly inside the frame or wholly out of it. A
 * label sliced by the phone bezel is the one artefact a still cannot explain.
 * They are kept rather than switched off: they are real stations feeding real
 * readings, and the preview card quotes those readings.
 *
 * The asset is `-v2` rather than a new file at the old path on purpose. Next's
 * image optimizer keys its cache on the URL, so replacing bytes underneath
 * `seattle-explore-map.webp` would have served the old wide frame from the
 * edge for as long as that entry lived.
 */
export const SEATTLE_FRAME: ReelFrame = {
  src: "/marketing/seattle-explore-map-v2.webp",
  centerLng: -122.4415,
  centerLat: 47.7141,
  zoom: 10.5,
  width: 375,
  height: 724,
  regionLabel: "King County",
};

/**
 * Vancouver. Solved the same way: 8 stops over a 327x303 spread.
 *
 * What it costs: the "Vancouver" place label sits at y 495, right on the top
 * edge of the preview card. Frames that clear the label lose Howe Sound, which
 * is where most of this city's scored marks are. The chip row says Vancouver
 * in words, so the label was the cheaper of the two to lose.
 */
export const VANCOUVER_FRAME: ReelFrame = {
  src: "/marketing/vancouver-explore-map.webp",
  centerLng: -123.24,
  centerLat: 49.38,
  zoom: 9,
  width: 375,
  height: 724,
  regionLabel: "Lower Mainland",
};

/**
 * Chrome-free box, in map pixels. Shared by every city, and it has to be: the
 * box describes the reel's own chrome, which is the same markup at the same
 * sizes on every page that draws one.
 *
 * The chip row floats over the top of the map and the preview card over the
 * bottom, so a pin outside this box is a pin the reader cannot see. Spots that
 * fall outside are dropped rather than drawn under the furniture.
 *
 * y1 is measured from the card, not guessed: the card sits 74 screen-px off
 * the bottom and stands about 221 tall with its VIEW MORE row, which puts its
 * top edge at 503. A pin draws its badge some 28px above its own point, so
 * 462 is the last row whose badge clears the card.
 */
export const REEL_SAFE = { x0: 28, y0: 130, x1: 347, y1: 462 } as const;

const TILE = 512;

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) =>
  0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

/** Lng/lat to a pixel in the captured map, origin top-left. */
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

export function inSafeArea(x: number, y: number): boolean {
  return (
    x >= REEL_SAFE.x0 && x <= REEL_SAFE.x1 && y >= REEL_SAFE.y0 && y <= REEL_SAFE.y1
  );
}

/** Percentages, so the phone can be any width the layout gives it. */
export function placePin(frame: ReelFrame, lng: number, lat: number) {
  const { x, y } = project(frame, lng, lat);
  return {
    x,
    y,
    left: `${(x / frame.width) * 100}%`,
    top: `${(y / frame.height) * 100}%`,
  };
}
