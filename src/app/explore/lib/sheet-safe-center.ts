"use client";

/**
 * Centring a pin in the map is not the same as centring it in the water the
 * angler can see.
 *
 * On mobile the map is one full-screen pane and two panels float over it: the
 * location header along the top and the pull-up spot sheet along the bottom.
 * A camera centred on a spot puts its pin in the geometric middle of the pane,
 * which sits low in the visible band and, once the sheet is dragged up past its
 * resting height, behind the sheet outright. So the return trip from a spot page
 * aimed the camera correctly and still made the angler hunt for the pin.
 *
 * The fix is to nudge the camera south by however far the two panels push the
 * visible middle up, so the pin lands in the middle of the water instead. It is
 * done here, at the moment the frame is remembered, rather than as a camera move
 * after the map loads. The whole point of the remembered view is to open already
 * framed, and a pan that arrives after the first paint would undo that.
 *
 * Both halves need the DOM: the panels are measured rather than assumed, since
 * their heights come from CSS (safe-area insets, the sheet's own detents) and a
 * hardcoded guess would drift the first time either changed.
 */

/** Marks a panel that floats over the map and hides part of it. */
export const MAP_INSET_ATTR = "data-rc-map-inset";

/**
 * A resizable panel's height in CSS pixels when it is at rest, for panels whose
 * live height is not the one that will be on screen next time.
 *
 * The spot sheet is the case: it can be dragged up to browse the list, but it
 * always mounts back at its resting detent. Framing for the dragged height would
 * aim the camera at water the sheet is no longer covering, so a panel that
 * declares a resting height is measured at that height instead of its own.
 */
export const MAP_INSET_RESTING_ATTR = "data-rc-map-inset-resting";

/** MapLibre's zoom is the 512px-tile convention: the world is 512·2^z px wide. */
const WORLD_PX_AT_Z0 = 512;

/**
 * How far above the map pane's centre the visible water's centre sits, in CSS
 * pixels. 0 when there is nothing to correct for (desktop, no panels on screen,
 * or so little water left that shifting would be arbitrary).
 */
export function mapInsetOffsetY(): number {
  if (typeof document === "undefined") return 0;
  const pane = document.querySelector(".maplibregl-map");
  if (!pane) return 0;
  const r = pane.getBoundingClientRect();
  if (r.height <= 0) return 0;

  let top = r.top;
  let bottom = r.bottom;
  for (const el of document.querySelectorAll(`[${MAP_INSET_ATTR}]`)) {
    const o = el.getBoundingClientRect();
    // Ignore a panel that is hidden or scrolled clear of the pane. Desktop
    // hides both with `lg:hidden`, which zeroes the rect.
    if (o.height <= 0 || o.bottom <= r.top || o.top >= r.bottom) continue;
    if (el.getAttribute(MAP_INSET_ATTR) === "top") {
      const resting = Number(el.getAttribute(MAP_INSET_RESTING_ATTR));
      top = Math.max(top, resting > 0 ? o.top + resting : o.bottom);
    } else {
      // A bottom panel is pinned by its bottom edge and grows upward, so its
      // resting top is measured back from there.
      const resting = Number(el.getAttribute(MAP_INSET_RESTING_ATTR));
      bottom = Math.min(bottom, resting > 0 ? o.bottom - resting : o.top);
    }
  }

  // Panels covering all but a sliver: there is no sensible middle to aim at,
  // and a large shift would throw the pin off the pane entirely.
  if (bottom - top < 120) return 0;

  return (r.top + r.bottom) / 2 - (top + bottom) / 2;
}

/**
 * How far the floating bottom panels cover the map pane at their resting
 * height, in CSS pixels. 0 when nothing covers it (desktop, or a map with no
 * sheet over it).
 *
 * Chrome pinned to the map's bottom edge, the zoom control and the ⓘ, renders
 * underneath the spot sheet without this, which is exactly what happened on
 * phone width: correctly placed inside a band nothing can see.
 * Desktop has the same problem with the forecast strip and solves it with a
 * fixed `--rc-map-inset`, but the sheet's height comes from its own measured
 * header, so this one has to be read off the DOM.
 *
 * Resting height, not live height, for the same reason the camera uses it: the
 * sheet can be dragged up to browse and always comes back to peek, and chrome
 * that chased the drag would slide around under a panel that already covers it.
 */
export function mapBottomPanelInset(pane: Element | null): number {
  if (typeof document === "undefined" || !pane) return 0;
  const r = pane.getBoundingClientRect();
  if (r.height <= 0) return 0;

  let bottom = r.bottom;
  for (const el of document.querySelectorAll(`[${MAP_INSET_ATTR}="bottom"]`)) {
    const o = el.getBoundingClientRect();
    if (o.height <= 0 || o.bottom <= r.top || o.top >= r.bottom) continue;
    // Pinned by its bottom edge and grown upward, so the resting top is
    // measured back from there.
    const resting = Number(el.getAttribute(MAP_INSET_RESTING_ATTR));
    bottom = Math.min(bottom, resting > 0 ? o.bottom - resting : o.top);
  }

  // A panel covering all but a sliver would push the chrome off the top of the
  // pane, which is worse than leaving it under the panel. Keep it on the map.
  return Math.max(0, Math.min(Math.round(r.bottom - bottom), Math.round(r.height - 120)));
}

/**
 * The camera centre that renders `lat`/`lng` in the middle of the visible water
 * rather than the middle of the map pane.
 *
 * `offsetY` is how far up the pin should move, in CSS pixels, from
 * `mapInsetOffsetY()`. Moving the pin up means moving the camera down, so the
 * centre comes back south of the point by that many pixels, converted through
 * Web Mercator at the zoom it will be viewed at.
 */
export function sheetSafeCenter(
  lat: number,
  lng: number,
  zoom: number,
  offsetY: number,
): { lat: number; lng: number } {
  if (!Number.isFinite(offsetY) || offsetY === 0) return { lat, lng };
  // Mercator breaks down at the poles and these are fishing spots, but a NaN
  // centre would blank the map, so refuse the arithmetic rather than risk it.
  if (!Number.isFinite(lat) || Math.abs(lat) > 85) return { lat, lng };

  const worldPx = WORLD_PX_AT_Z0 * 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  // Normalised Mercator y, 0 at the north edge and 1 at the south.
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
  const shifted = y + offsetY / worldPx;
  if (shifted <= 0 || shifted >= 1) return { lat, lng };

  const shiftedLat =
    (2 * Math.atan(Math.exp((0.5 - shifted) * 2 * Math.PI)) - Math.PI / 2) * (180 / Math.PI);
  return Number.isFinite(shiftedLat) ? { lat: shiftedLat, lng } : { lat, lng };
}
