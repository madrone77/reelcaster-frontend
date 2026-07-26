/**
 * Square puck image for spots the viewer created.
 *
 * Custom spots read as ordinary scored pins — same score colour, same numeral,
 * same white stroke — differing only in SHAPE: a rounded square instead of a
 * circle. Shape carries the distinction because colour is already spoken for
 * (score ramp) and cobalt means "selected" elsewhere on this map.
 *
 * MapLibre has no square equivalent of `circle`, so this registers an **SDF**
 * icon: a solid rounded square drawn to a canvas. SDF is what makes the single
 * image reusable — the layer recolours it per feature with `icon-color` (the
 * score ramp) and strokes it with `icon-halo-color`, so one image covers every
 * score instead of one baked image per colour.
 *
 * Follows the same register-and-re-register contract as attachRcaHatch: a style
 * (re)load drops runtime images, so we re-add on `styleimagemissing`.
 */

/** Image id referenced by the custom-spot symbol layer's `icon-image`. */
export const SQUARE_PUCK_IMAGE_ID = "rc-square-puck";

/**
 * Side of the drawn SQUARE, in px — the number `icon-size` is a ratio of, so
 * rendered side = SQUARE_PUCK_SIZE × icon-size. Big enough to stay crisp; SDF
 * encodes distance, not pixels.
 */
export const SQUARE_PUCK_SIZE = 32;

/**
 * Transparent margin around the square inside the image.
 *
 * Required, not cosmetic: `icon-halo-width` draws the stroke OUTWARD into the
 * image's own bounds. A square that fills the canvas edge-to-edge has nowhere
 * to put a halo, so it renders with no white outline at all while the circle
 * pins beside it have one — which is exactly what happened the first time.
 */
const PAD = 5;

/** Corner rounding — soft enough to sit beside round pins, square enough to read as a square. */
const RADIUS = 5;
const RATIO = 2; // retina crispness

type MapLike = {
  hasImage?: (id: string) => boolean;
  addImage: (
    id: string,
    image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
    options?: { pixelRatio?: number; sdf?: boolean },
  ) => void;
  on: (type: "styleimagemissing", listener: (e: { id?: string }) => void) => void;
};

function drawSquare(): { width: number; height: number; data: Uint8ClampedArray } | null {
  if (typeof document === "undefined") return null; // SSR — no canvas
  const logical = SQUARE_PUCK_SIZE + PAD * 2;
  const px = logical * RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);

  // Solid white shape inset by PAD. For an SDF icon the colour is irrelevant —
  // MapLibre reads coverage from the alpha channel — but an opaque fill keeps
  // the distance field clean at the corners.
  ctx.fillStyle = "#ffffff";
  const s = SQUARE_PUCK_SIZE;
  const r = RADIUS;
  const x0 = PAD;
  const y0 = PAD;
  const x1 = PAD + s;
  const y1 = PAD + s;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
  ctx.lineTo(x1, y1 - r);
  ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.lineTo(x0 + r, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
  ctx.lineTo(x0, y0 + r);
  ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
  ctx.fill();

  const img = ctx.getImageData(0, 0, px, px);
  return { width: img.width, height: img.height, data: img.data };
}

/**
 * Idempotently register the square puck on a map, re-registering it whenever a
 * style (re)load drops it. Safe to call on every map load; no-ops server-side
 * or where a 2D canvas context is unavailable.
 */
export function attachSquarePuck(map: MapLike): void {
  const ensure = () => {
    if (map.hasImage?.(SQUARE_PUCK_IMAGE_ID)) return;
    const img = drawSquare();
    if (img) map.addImage(SQUARE_PUCK_IMAGE_ID, img, { pixelRatio: RATIO, sdf: true });
  };
  ensure();
  map.on("styleimagemissing", (e) => {
    if (e.id === SQUARE_PUCK_IMAGE_ID) ensure();
  });
}
