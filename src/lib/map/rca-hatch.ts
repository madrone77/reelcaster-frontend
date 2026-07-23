/**
 * Diagonal-hatch fill pattern for Rockfish Conservation Area (RCA) zones.
 *
 * A translucent solid fill can't stay legible over the relief bathymetry
 * basemap: the water ramps from near-black deeps to pale shallows, and no
 * single fill colour/opacity reads on both. The nautical-chart convention for
 * regulated / closed areas is a hatched zone with a bold edge — the hatch lines
 * and the opaque outline carry the signal on any background while the
 * bathymetry stays legible through the gaps.
 *
 * MapLibre `fill-pattern` needs a runtime image, so we draw the tile to a canvas
 * and register it under a shared id. The Explore map calls `attachRcaHatch(map)`
 * once from its `onLoad`; it re-registers the image whenever a style (re)load
 * drops it (via `styleimagemissing`).
 *
 * Kept in sync with bluecaster's lib/bluecaster/map/rca-hatch.ts.
 */

/** Image id referenced by the RCA `fill-pattern` layer in relief-style.ts. */
export const RCA_HATCH_IMAGE_ID = "rca-hatch";

/** Bright, opaque edge colour for RCA zones — reads on deep navy and pale shallows alike. */
export const RCA_EDGE_COLOR = "#FF3B30";

type MapLike = {
  hasImage?: (id: string) => boolean;
  addImage: (
    id: string,
    image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
    options?: { pixelRatio?: number },
  ) => void;
  on: (type: "styleimagemissing", listener: (e: { id?: string }) => void) => void;
};

const TILE = 8; // logical px per tile
const RATIO = 2; // retina crispness
const WASH = "rgba(255,68,56,0.10)"; // faint tint so the zone still reads as filled
const LINE = "rgba(255,59,48,0.92)"; // #FF3B30 diagonal hatch strokes

function drawHatchTile(): { width: number; height: number; data: Uint8ClampedArray } | null {
  if (typeof document === "undefined") return null; // SSR — no canvas
  const size = TILE * RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);
  // Faint wash across the whole tile so the zone reads as filled, not just outlined.
  ctx.fillStyle = WASH;
  ctx.fillRect(0, 0, TILE, TILE);
  // 45° hatch. Spacing (4) divides TILE (8) so the tile repeats seamlessly.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = -TILE; x <= TILE * 2; x += 4) {
    ctx.moveTo(x, TILE);
    ctx.lineTo(x + TILE, 0);
  }
  ctx.stroke();
  const img = ctx.getImageData(0, 0, size, size);
  return { width: img.width, height: img.height, data: img.data };
}

/**
 * Idempotently register the RCA hatch pattern on a map, and re-register it
 * whenever a style (re)load drops it. Safe to call on every map load; no-ops
 * server-side or where a 2D canvas context is unavailable.
 */
export function attachRcaHatch(map: MapLike): void {
  const ensure = () => {
    if (map.hasImage?.(RCA_HATCH_IMAGE_ID)) return;
    const tile = drawHatchTile();
    if (tile) map.addImage(RCA_HATCH_IMAGE_ID, tile, { pixelRatio: RATIO });
  };
  ensure();
  map.on("styleimagemissing", (e) => {
    if (e.id === RCA_HATCH_IMAGE_ID) ensure();
  });
}
