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
 * Logical size of the drawn square, in px. The layer scales this to match the
 * circle pins' diameter, so it only needs to be big enough to stay crisp —
 * SDF encodes distance, not pixels.
 */
export const SQUARE_PUCK_SIZE = 32;

/** Corner rounding — soft enough to sit beside round pins, square enough to read as a square. */
const RADIUS = 6;
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
  const size = SQUARE_PUCK_SIZE * RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);

  // Solid white shape. For an SDF icon the colour here is irrelevant — MapLibre
  // reads coverage from the alpha channel — but a fully opaque fill keeps the
  // distance field clean at the corners.
  ctx.fillStyle = "#ffffff";
  const s = SQUARE_PUCK_SIZE;
  const r = RADIUS;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(s - r, 0);
  ctx.quadraticCurveTo(s, 0, s, r);
  ctx.lineTo(s, s - r);
  ctx.quadraticCurveTo(s, s, s - r, s);
  ctx.lineTo(r, s);
  ctx.quadraticCurveTo(0, s, 0, s - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  const img = ctx.getImageData(0, 0, size, size);
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
