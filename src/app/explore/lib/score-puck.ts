/**
 * Score pucks for the Explore map: a pill with a tail that points at the spot.
 *
 * Replaces the circle + SDF-square + label trio. A `circle` layer can only draw
 * a flat disc — one fill, one stroke, no gradient, no shadow, and no way to
 * point at the coordinate it belongs to — so the puck is drawn to a canvas and
 * handed to MapLibre as a real image. Same register-on-`styleimagemissing`
 * contract as attachRcaHatch and the square puck it supersedes.
 *
 * Two things are baked into the sprite rather than layered on top:
 *
 *   - The score numeral. Canvas takes any system font at any weight; the glyph
 *     PBFs only ship "Open Sans Semibold", so a bold numeral was out of reach
 *     for a `text-field`. Baking also keeps the number locked to its pill
 *     instead of being placed independently by the symbol engine.
 *   - The score colour. The old square was SDF precisely so one image could be
 *     recoloured per feature, but an SDF carries a single alpha channel and so
 *     can hold neither the gradient nor the two-tone ring this needs.
 *
 * Sprites are rasterised on demand — only the combinations actually on screen
 * are ever drawn — but they are registered from the feature list rather than
 * from MapLibre's `styleimagemissing`, which fires too late to be relied on.
 * See ensureScorePucks.
 *
 * SHAPE still carries ownership, exactly as the old square did: curated spots
 * get a wide rounded pill, spots the viewer created get a square one. Colour is
 * spoken for by the score ramp and cobalt already means "selected".
 */

import { NO_DATA_COLOR, scoreColor } from "./spot-geojson";

/** Icon-id namespace. Every id looks like `rcp:84:fresh:1:rd`. */
const PREFIX = "rcp";

/** Ring treatments, in the order the map resolves them. */
export type PuckRing = "base" | "fresh" | "sel";
/** `rd` = curated (rounded), `sq` = the viewer's own spot (square corners). */
export type PuckShape = "rd" | "sq";

/** Label used for a spot with no score at the scrubbed hour. */
export const NO_DATA_LABEL = "·";

/** Tag worn by spots with catch reports in the intel window. */
export const HOT_TAG = "Hot";

// Geometry, in logical px. RATIO is the retina multiplier.
const RATIO = 2;
const PAD = 7; // room for the shadow and the outer collar
const PILL_H = 24;
const PILL_H_HOT = 35; // taller body, to seat the tag on its own line above the score
const PILL_MIN_W = 30;
const TAIL_W = 12;
const TAIL_H = 8;

/**
 * Ownership reads through the SILHOUETTE, not the corner radius.
 *
 * Rounding the corners of a pill and calling that "square" does not survive
 * contact with the map: a pill is already a wide rectangle, so at pin size the
 * two variants are indistinguishable. What made the old circle-vs-square pair
 * work was that the outlines had genuinely different proportions. So a custom
 * spot gets a puck that is as tall as it is wide, and grows taller rather than
 * wider when it has to hold a second line.
 */
const SQUARE_SIDE = 30;
const SQUARE_SIDE_HOT = 38;
/** Horizontal breathing room around the text: tighter on a square. */
const PILL_TEXT_PAD = 18;
const SQUARE_TEXT_PAD = 12;
const RADIUS_ROUND = 7;
/** Soft enough to sit beside the rounded pins, square enough to read as square. */
const RADIUS_SQUARE = 5;

const FONT = '700 13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TAG_FONT = '800 10px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
// Text positions as a FRACTION of body height, so the two-line layout holds at
// both the pill's 35px and the square's 38px.
const TAG_Y_FRAC = 0.3;
const SCORE_Y_FRAC = 0.686;

/**
 * Every puck gets the same white ring, and the flagged states add a colour
 * collar outside it. Colouring the ring itself would put emerald on an emerald
 * fill for a prime spot with reports, which is the one case that needs to read
 * loudest. White always separates the pill from the collar and the water.
 */
const RING_W = 2;
const COLLAR_W = 5.5; // stroked under the white ring, so ~1.75px shows outside it
const COLLAR: Record<PuckRing, string | null> = {
  base: null,
  fresh: "#10b981", // emerald: catch reports exist at this spot
  sel: "#1F40E0", // cobalt: the selected spot
};

/**
 * Distance from the sprite's bottom edge up to the tail tip. The layer pushes
 * the icon down by this much so the tip, not the shadow, lands on the spot.
 */
export const PUCK_TIP_OFFSET = PAD;

/**
 * Half-width of a typical puck, for the screen-space declutter test. Pucks are
 * a constant size at every zoom, so unlike the old circles this does not vary.
 */
export const PUCK_HALF_W = 19;

/** Mix a #rrggbb toward white by `t` (0..1). */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const up = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${up(r)}, ${up(g)}, ${up(b)})`;
}

/** Outline of the pill plus its downward tail, as one continuous path. */
function puckPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const midX = x + w / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  // Down the right of the tail, out to the tip, back up the left.
  ctx.lineTo(midX + TAIL_W / 2, y + h);
  ctx.lineTo(midX, y + h + TAIL_H);
  ctx.lineTo(midX - TAIL_W / 2, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

type PuckImage = { width: number; height: number; data: Uint8ClampedArray };

/** Render one puck. Returns null server-side or without a 2D context. */
function drawPuck(label: string, ring: PuckRing, hot: boolean, shape: PuckShape): PuckImage | null {
  if (typeof document === "undefined") return null;

  const noData = label === NO_DATA_LABEL;
  const score = Number(label);
  const base = noData || !Number.isFinite(score) ? NO_DATA_COLOR : scoreColor(score);
  const ink = noData ? "#374151" : "#ffffff";
  const collar = COLLAR[ring];
  const square = shape === "sq";
  const corner = square ? RADIUS_SQUARE : RADIUS_ROUND;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = FONT;
  const scoreW = measure.measureText(label).width;
  measure.font = TAG_FONT;
  const tagW = hot ? measure.measureText(HOT_TAG).width : 0;
  // Stacked, so the body only has to be as wide as the wider of the two lines.
  const textW = Math.max(scoreW, tagW);

  const pillH = square ? (hot ? SQUARE_SIDE_HOT : SQUARE_SIDE) : hot ? PILL_H_HOT : PILL_H;
  // Width the text alone demands. Even, so the tail centres on a whole pixel.
  const textMinW = Math.ceil((textW + (square ? SQUARE_TEXT_PAD : PILL_TEXT_PAD)) / 2) * 2;
  // A square matches its height, and only breaks square if a wide label (say a
  // three-digit 100) genuinely will not fit inside it.
  const pillW = square ? Math.max(pillH, textMinW) : Math.max(PILL_MIN_W, textMinW);

  const w = pillW + PAD * 2;
  const h = PAD + pillH + TAIL_H + PAD;
  const canvas = document.createElement("canvas");
  canvas.width = w * RATIO;
  canvas.height = h * RATIO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);

  const grad = ctx.createLinearGradient(0, PAD, 0, PAD + pillH);
  grad.addColorStop(0, lighten(base, 0.2));
  grad.addColorStop(1, base);
  ctx.lineJoin = "round";

  // Body, with the drop shadow attached to this fill only.
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.45)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = grad;
  puckPath(ctx, PAD, PAD, pillW, pillH, corner);
  ctx.fill();
  ctx.restore();

  // Collar, then the body again over it. A centred stroke bleeds inside the
  // path as well as outside; the re-fill trims the inside half away so the
  // colour only ever shows as an outer band.
  if (collar) {
    ctx.lineWidth = COLLAR_W;
    ctx.strokeStyle = collar;
    puckPath(ctx, PAD, PAD, pillW, pillH, corner);
    ctx.stroke();
    ctx.fillStyle = grad;
    puckPath(ctx, PAD, PAD, pillW, pillH, corner);
    ctx.fill();
  }

  // Sheen across the top of the pill, clipped to the body.
  ctx.save();
  puckPath(ctx, PAD, PAD, pillW, pillH, corner);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, PAD, 0, PAD + pillH * 0.62);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(PAD, PAD, pillW, pillH * 0.62);
  ctx.restore();

  // White ring last, over the fill, the sheen and the collar's inner half.
  ctx.lineWidth = RING_W;
  ctx.strokeStyle = "#ffffff";
  puckPath(ctx, PAD, PAD, pillW, pillH, corner);
  ctx.stroke();

  // Text. "Hot" sits on its own line above the score, smaller and heavier, so
  // the score stays the thing you read first and the tag reads as a label on it.
  const midX = PAD + pillW / 2;
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  if (hot) {
    ctx.font = TAG_FONT;
    ctx.fillText(HOT_TAG, midX, PAD + pillH * TAG_Y_FRAC);
    ctx.font = FONT;
    ctx.fillText(label, midX, PAD + pillH * SCORE_Y_FRAC);
  } else {
    ctx.font = FONT;
    ctx.fillText(label, midX, PAD + pillH / 2 + 0.5);
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: img.width, height: img.height, data: img.data };
}

type MapLike = {
  hasImage?: (id: string) => boolean;
  addImage: (id: string, image: PuckImage, options?: { pixelRatio?: number }) => void;
  on: (type: "styleimagemissing", listener: (e: { id?: string }) => void) => void;
};

/** Draw + register one `rcp:...` id, unless the map already carries it. */
function registerPuck(map: MapLike, id: string | undefined): void {
  if (!id || !id.startsWith(`${PREFIX}:`)) return; // not ours (e.g. the RCA hatch)
  if (map.hasImage?.(id)) return;
  const parts = id.split(":");
  if (parts.length !== 5) return;
  const [, label, ring, hot, shape] = parts;
  if (!(ring in COLLAR)) return;
  if (shape !== "rd" && shape !== "sq") return;
  const img = drawPuck(label, ring as PuckRing, hot === "1", shape);
  if (img) map.addImage(id, img, { pixelRatio: RATIO });
}

/**
 * Draw score pucks on demand for a map. Safe to call more than once — the
 * listener is idempotent per map — and it also covers style reloads, which
 * drop every registered image.
 *
 * ⚠ This is a FALLBACK, not the main path. `styleimagemissing` is fired while
 * a symbol tile is being laid out, and a listener attached after that moment
 * arrives too late: the tile is laid out with no icon and stays that way until
 * something makes it reload. Register the ids you know you need with
 * `ensureScorePucks` instead, and keep this for ids you could not predict.
 */
export function attachScorePucks(map: MapLike): void {
  map.on("styleimagemissing", (e) => registerPuck(map, e.id));
}

/**
 * Register specific puck ids up front, rather than waiting to be asked.
 *
 * This is the path that actually keeps pins on the map, for two reasons:
 *
 *  - **It runs before the layout.** The icon for a feature is requested when
 *    its tile is laid out in the worker, which happens as soon as the source
 *    has data — long before `load` fires on a cold visit, since `load` waits
 *    on every source in the relief style. A `styleimagemissing` listener
 *    attached in `onLoad` misses that first request entirely, and the pucks
 *    are then absent until a zoom retiles the source. That was the Explore
 *    bug: the map opened with no pins and a wiggle brought them back.
 *  - **It repairs a layout that already missed.** `map.addImage` marks the
 *    image changed, and MapLibre reloads any tile that asked for it, so
 *    registering late still puts the pins back without the angler touching
 *    anything.
 *
 * Ids already on the map are skipped, so calling this on every spot change is
 * cheap: only genuinely new pucks are rasterised.
 */
export function ensureScorePucks(map: MapLike, ids: Iterable<string>): void {
  for (const id of ids) registerPuck(map, id);
}

/** Register one puck id. Thin wrapper over {@link ensureScorePucks}. */
export function ensureScorePuck(map: MapLike, id: string): void {
  registerPuck(map, id);
}

/** The feature properties the icon id is built from. */
export interface PuckFeatureProps {
  label: string;
  slug: string;
  fresh: number;
  hot: number;
  isCustom: number;
}

/**
 * The icon id one feature asks for.
 *
 * ⚠ This and {@link puckIconImageExpr} are the same rule written twice — once
 * in JS so we can register the sprites ahead of time, once as a MapLibre
 * expression because that is the only thing the symbol layer can read. They
 * live side by side so a change to one is a visible change to the other; if
 * they drift, the layer asks for an id nothing ever draws and the pins vanish.
 */
export function puckIconId(
  p: PuckFeatureProps,
  selectedSlug: string | null,
): string {
  const ring: PuckRing =
    p.slug === selectedSlug ? "sel" : p.fresh === 1 ? "fresh" : "base";
  const shape: PuckShape = p.isCustom === 1 ? "sq" : "rd";
  return `${PREFIX}:${p.label}:${ring}:${p.hot}:${shape}`;
}

/**
 * `icon-image` for the spot layer: the same id {@link puckIconId} builds,
 * evaluated per feature by the symbol engine.
 *
 * Hover is deliberately absent. `icon-image` is a LAYOUT property, so swapping
 * it on every mouse move would relayout the whole symbol layer; the rail card
 * and the cursor carry the hover feedback instead.
 */
export function puckIconImageExpr(selectedSlug: string | null): unknown[] {
  return [
    "concat",
    `${PREFIX}:`, ["get", "label"], ":",
    [
      "case",
      ["==", ["get", "slug"], selectedSlug ?? "__none__"], "sel",
      ["==", ["get", "fresh"], 1], "fresh",
      "base",
    ],
    ":", ["to-string", ["get", "hot"]],
    ":", ["case", ["==", ["get", "isCustom"], 1], "sq", "rd"],
  ];
}
