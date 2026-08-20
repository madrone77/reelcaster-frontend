import { Page, expect } from '@playwright/test';

/**
 * Helpers for asserting that a map actually drew its runtime images.
 *
 * The pins, the RCA hatch and the "no data" puck are all canvas sprites
 * registered at runtime, not sprites in the style. MapLibre asks for an image
 * while it lays a tile out, and an image that is missing at that instant is
 * left off the tile until something reloads it. That is a silent failure on
 * screen: no error, no blank tile, just no pins.
 */

/**
 * MapLibre's own warning for an icon it could not resolve. It is emitted at the
 * exact moment a tile is laid out without the image, which makes it the
 * earliest and most precise signal that a map is about to come up bare.
 */
const MISSING_IMAGE = /Image "([^"]+)" could not be loaded/;

/**
 * Start collecting missing-image warnings. Call before `page.goto` — the first
 * layout happens about a second into a cold load, well before anything is
 * visible to assert on.
 */
export function collectMissingImages(page: Page): string[] {
  const missing: string[] = [];
  page.on('console', (msg) => {
    const id = msg.text().match(MISSING_IMAGE)?.[1];
    if (id) missing.push(id);
  });
  return missing;
}

/**
 * Reach the MapLibre instance through the React fiber on its container.
 *
 * react-map-gl keeps the map in component state and hands out no global, so a
 * test has to walk to it. If the walk ever stops working this returns null and
 * every caller fails loudly, which is the point: an assertion that cannot find
 * the map must not pass.
 */
const FIND_MAP = `
window.__rcFindMap = function () {
  if (window.__rcMap) return window.__rcMap;
  const el = document.querySelector('.maplibregl-map');
  if (!el) return null;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return null;
  const isMap = (o) =>
    o && typeof o === 'object' &&
    typeof o.queryRenderedFeatures === 'function' &&
    typeof o.listImages === 'function';
  let fiber = el[key];
  for (let hop = 0; fiber && hop < 40; hop++) {
    let hook = fiber.memoizedState;
    for (let i = 0; hook && i < 40; i++) {
      const s = hook.memoizedState;
      if (isMap(s)) return (window.__rcMap = s);
      if (s && typeof s === 'object') {
        if (isMap(s.current)) return (window.__rcMap = s.current);
        if (isMap(s.map)) return (window.__rcMap = s.map);
      }
      hook = hook.next;
    }
    fiber = fiber.return;
  }
  return null;
};`;

/** Install the map-finder. Must run before the page's own scripts. */
export async function installMapProbe(page: Page) {
  await page.addInitScript(FIND_MAP);
}

export interface MapPins {
  /** Pin sprites the map is currently drawing in the viewport. */
  pucks: number;
  /** Puck images registered on the map (`rcp:...`). */
  images: number;
}

/**
 * How many pins the map is drawing right now, without touching it.
 *
 * Returns null until the map exists, so it composes with `expect.poll`.
 * Deliberately reads what is RENDERED rather than what is in the source: the
 * bug this guards against left every feature in the source and drew none of
 * them.
 */
export async function readMapPins(page: Page): Promise<MapPins | null> {
  return page.evaluate(() => {
    const map = (window as unknown as { __rcFindMap: () => unknown }).__rcFindMap() as
      | {
          getStyle: () => { layers: Array<{ id: string }> };
          queryRenderedFeatures: (o: { layers: string[] }) => unknown[];
          listImages: () => string[];
        }
      | null;
    if (!map) return null;
    const layers = map.getStyle().layers.map((l) => l.id).filter((id) => /puck/.test(id));
    if (layers.length === 0) return { pucks: 0, images: 0 };
    let pucks = 0;
    try {
      pucks = map.queryRenderedFeatures({ layers }).length;
    } catch {
      // Thrown while a tile is mid-layout. Treat as "nothing yet" and poll on.
      pucks = 0;
    }
    return { pucks, images: map.listImages().filter((i) => i.startsWith('rcp:')).length };
  });
}

/**
 * Assert a map draws pins without being touched.
 *
 * No pan, no zoom, no click: retiling the source is exactly what used to paper
 * over the bug, so any interaction here would hide the regression.
 */
export async function expectPinsWithoutInteraction(page: Page, timeout = 25_000) {
  await expect
    .poll(async () => (await readMapPins(page))?.pucks ?? 0, {
      timeout,
      message:
        'no pins rendered on the map. Either the sprites were registered too ' +
        'late (the regression this guards) or the page had no spots to draw — ' +
        'check the BlueCaster dev server is up on :3001',
    })
    .toBeGreaterThan(0);
}
