/**
 * The hero reel's map, as a baked picture, on the ad frames.
 *
 * On an `?ad=` city or spot page the reel's map screen is a still of the map
 * with no pins, and the pins are drawn over it as markup from today's scores.
 * The live map it replaces cost a paid visitor 350 kB of MapLibre and a 1.8 s
 * main-thread task (phone, 4x CPU) to draw a picture that takes no input
 * anyway (MarketingMap is `interactive={false}`).
 *
 * The frame, meaning the centre, zoom and size of a still, is computed here from
 * data that changes only when a city's roster does. The page and the capture
 * job (scripts/capture-reel-stills.mjs, via /api/reel-stills) therefore agree
 * on every frame without being told about each other. A still that has not been
 * captured yet 404s. The page then falls back to the live map, and the next
 * nightly run fills the gap.
 *
 * - A SPOT still is a SHEET too: SPOT_WALK_PAD of water around the spot plus
 *   a window's margin on every side, at the spot reel's zoom. The card opens
 *   on the spot and walks to its best-scoring neighbours inside that box.
 * - A CITY still is a SHEET: the roster's extent plus a window's margin on
 *   every side, at the city reel's zoom. The window pans over it to each
 *   featured mark, as the live map eased between them.
 *
 * Bump STILL_VERSION whenever the map's look changes (the relief style, the
 * clutter list, the tilesets). The paths move and the job recaptures every
 * still.
 */

export const STILL_VERSION = 1;

/** Public bucket in the app's Supabase project. */
export const STILL_BUCKET = "map-stills";
/** Overridable so a local build can serve stills from ./public while testing. */
const STILL_BASE =
  process.env.NEXT_PUBLIC_REEL_STILL_BASE ||
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${STILL_BUCKET}`;

/** Must match ad-reel.tsx's ZOOM and CITY_ZOOM. */
export const SPOT_STILL_ZOOM = 10.4;
export const CITY_STILL_ZOOM = 9.6;

/**
 * How far from the spot the spot reel's card may walk, in degrees. ad-reel.tsx
 * picks the neighbours it walks to inside this box, and the spot sheet is this
 * box plus a window, so every one of them can be centred.
 */
export const SPOT_WALK_PAD = { lng: 0.12, lat: 0.08 } as const;

/**
 * The reel phone's map box, in CSS px, plus a pixel of slack. The phone is
 * drawn at one design size (375 wide) and scaled as a whole, so its map box
 * measures 373x721 on every viewport. A spot still is exactly this; a city
 * sheet has it as margin, so the window can pan to any mark on it.
 */
export const STILL_WINDOW = { w: 376, h: 724 } as const;

/** A city sheet wider than this is clipped around its centre. San Diego's
 *  roster alone is 1086x774 at the city zoom. */
const MAX_SHEET = { w: 1500, h: 1500 } as const;

/** The pixel ratio the stills are captured at. */
export const STILL_DPR = 2;

export interface StillFrame {
  kind: "city" | "spot";
  slug: string;
  /** Rounded to 5 places, and the capture uses exactly these numbers. */
  lat: number;
  lng: number;
  zoom: number;
  /** CSS px. The image is this times STILL_DPR. */
  w: number;
  h: number;
  /** Path inside the bucket. */
  path: string;
  /** Public URL. */
  src: string;
}

const TILE = 512;
const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const lngOf = (x: number) => x * 360 - 180;
const latOf = (y: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** MapLibre's world size at a zoom (512 px tiles). */
const worldPx = (zoom: number) => TILE * 2 ** zoom;

/** Where a point sits on a still, in CSS px from its top left. */
export function projectOnStill(
  frame: Pick<StillFrame, "lat" | "lng" | "zoom" | "w" | "h">,
  lat: number,
  lng: number,
): { x: number; y: number } {
  const world = worldPx(frame.zoom);
  return {
    x: (mercX(lng) - mercX(frame.lng)) * world + frame.w / 2,
    y: (mercY(lat) - mercY(frame.lat)) * world + frame.h / 2,
  };
}

/** Small, stable, non-cryptographic: it only has to change when a frame does. */
function frameHash(parts: Array<string | number>): string {
  let h = 2166136261;
  for (const ch of parts.join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function finish(frame: Omit<StillFrame, "path" | "src">): StillFrame {
  const hash = frameHash([frame.lat, frame.lng, frame.zoom, frame.w, frame.h]);
  const path = `reel/v${STILL_VERSION}/${frame.kind}/${frame.slug}-${hash}.webp`;
  return { ...frame, path, src: `${STILL_BASE}/${path}` };
}

export function spotStillFrame(slug: string, lat: number, lng: number): StillFrame {
  const zoom = SPOT_STILL_ZOOM;
  const world = worldPx(zoom);
  const w = Math.ceil(((mercX(lng + SPOT_WALK_PAD.lng) - mercX(lng - SPOT_WALK_PAD.lng)) * world + STILL_WINDOW.w) / 2) * 2;
  const h = Math.ceil(((mercY(lat - SPOT_WALK_PAD.lat) - mercY(lat + SPOT_WALK_PAD.lat)) * world + STILL_WINDOW.h) / 2) * 2;
  return finish({
    kind: "spot",
    slug,
    lat: round5(lat),
    lng: round5(lng),
    zoom,
    w: Math.min(MAX_SHEET.w, w),
    h: Math.min(MAX_SHEET.h, h),
  });
}

/**
 * The sheet for a city: its published HOME roster (the hierarchy's list,
 * which moves only when a spot is added or retired, not the day's scored
 * subset) plus a window's margin all round.
 */
export function cityStillFrame(
  slug: string,
  roster: ReadonlyArray<{ lat: number; lng: number }>,
  fallback: { lat: number; lng: number },
): StillFrame {
  const zoom = CITY_STILL_ZOOM;
  const world = worldPx(zoom);
  const pts = roster.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length === 0) pts.push(fallback);
  const xs = pts.map((p) => mercX(p.lng));
  const ys = pts.map((p) => mercY(p.lat));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.min(MAX_SHEET.w, Math.ceil(((x1 - x0) * world + STILL_WINDOW.w) / 2) * 2);
  const h = Math.min(MAX_SHEET.h, Math.ceil(((y1 - y0) * world + STILL_WINDOW.h) / 2) * 2);
  return finish({
    kind: "city",
    slug,
    lat: round5(latOf((y0 + y1) / 2)),
    lng: round5(lngOf((x0 + x1) / 2)),
    zoom,
    w,
    h,
  });
}
