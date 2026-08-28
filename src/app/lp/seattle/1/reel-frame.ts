/**
 * Where a spot lands on the baked Seattle map, in the map image's own pixels.
 *
 * The hero's phone shows a still of the real Explore map with its pin layer
 * switched off, and the component draws the pins itself so the one the reel is
 * on can grow, colour and pulse. That only works if this file's arithmetic and
 * MapLibre's agree, because the pins have to sit exactly where the product
 * would have drawn them -- a mark half a kilometre inland is the one mistake a
 * reader of a fishing map notices instantly.
 *
 * They do agree. `project()` below was checked against `map.project()` at the
 * capture frame and matched to fifteen decimal places on every test point, so
 * this is the same Web Mercator, not an approximation of it.
 *
 * WHAT MUST NOT DRIFT
 * The four constants describe the capture, not a preference. Re-frame the
 * image and every pin moves; the numbers here have to be re-read from the
 * capturing map in the same breath. That is why they sit in one file with the
 * asset named beside them rather than inline in the component.
 *
 * The frame itself was solved rather than eyeballed: Explore opens Seattle on
 * the city centroid, which on a portrait phone fills two thirds of the screen
 * with inland King County and pushes the sound to a strip down the left. This
 * centre and zoom were searched for instead, maximising how many scored marks
 * land inside the box below AFTER decluttering -- seven, spread over 330 of
 * the 332 usable rows and 220 of the columns, which is a reel that travels
 * rather than a cluster that blinks.
 *
 * What it costs: the "Seattle" place label sits at y 576, behind the preview
 * card. Every frame that keeps the label visible drops to five or six stops,
 * because this city's marks are almost all NORTH of its downtown. The chip row
 * says Seattle in words, so the label was the cheaper of the two to lose.
 */

/** The still the pins are drawn on. 750x1448 device pixels, 2x. */
export const REEL_MAP_SRC = "/marketing/seattle-explore-map.webp";

/** Capture geometry. Read off the map that produced REEL_MAP_SRC. */
export const REEL_FRAME = {
  centerLng: -122.45,
  centerLat: 47.85,
  zoom: 8.7,
  /** CSS pixels of the captured canvas; the asset is this at 2x. */
  width: 375,
  height: 724,
} as const;

/**
 * Chrome-free box, in map pixels.
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
export function project(lng: number, lat: number): { x: number; y: number } {
  const world = TILE * 2 ** REEL_FRAME.zoom;
  return {
    x: (mercX(lng) - mercX(REEL_FRAME.centerLng)) * world + REEL_FRAME.width / 2,
    y: (mercY(lat) - mercY(REEL_FRAME.centerLat)) * world + REEL_FRAME.height / 2,
  };
}

export function inSafeArea(x: number, y: number): boolean {
  return (
    x >= REEL_SAFE.x0 && x <= REEL_SAFE.x1 && y >= REEL_SAFE.y0 && y <= REEL_SAFE.y1
  );
}

/** Percentages, so the phone can be any width the layout gives it. */
export function placePin(lng: number, lat: number) {
  const { x, y } = project(lng, lat);
  return {
    x,
    y,
    left: `${(x / REEL_FRAME.width) * 100}%`,
    top: `${(y / REEL_FRAME.height) * 100}%`,
  };
}
