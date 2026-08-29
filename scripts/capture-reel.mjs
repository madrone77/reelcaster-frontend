/**
 * Capture the baked Explore still behind an /lp/<city>/<n> reel hero.
 *
 * See src/app/lp/_reel/reel-frame.ts: the pins are markup drawn over this
 * image, so the capture geometry and that file's numbers have to be the same
 * numbers. This script prints the projection check it performed.
 *
 *   node scripts/capture-reel.mjs <outDir> '<json frames>'
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3043";
const outDir = process.argv[2];
const frames = JSON.parse(process.argv[3]);
/**
 * The still is the PANNING SHEET, not the phone screen: the reel shows a
 * 375x724 window onto it and slides the window from mark to mark. So the
 * capture viewport is the frame's own width/height, which is larger.
 */
const { width: W, height: H } = frames[0];

/**
 * Slack captured either side of the frame and then clipped away.
 *
 * Something in this page paints a scrollbar-width stripe of white down the
 * right edge of the canvas: MapLibre reports the land layer rendering out to
 * the last column, but hit-testing there finds no element and the screenshot
 * comes back white, and `overflow:hidden` on the document does not stop it.
 * Rather than chase it, capture wider and clip. The margin is symmetric, so
 * the clipped image keeps the map centre the frame is defined by and only its
 * width changes -- which is what makes this safe rather than a fudge.
 *
 * The first version of this script shipped without it, and the still it baked
 * carried 15 white pixels down its right edge into production.
 */
const MARGIN = 24;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: W + 2 * MARGIN, height: H },
  deviceScaleFactor: 2,
});
await page.addInitScript(`
window.__rcFindMap = function () {
  if (window.__rcMap) return window.__rcMap;
  const el = document.querySelector('.maplibregl-map');
  if (!el) return null;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return null;
  const isMap = (o) => o && typeof o === 'object' &&
    typeof o.queryRenderedFeatures === 'function' && typeof o.listImages === 'function';
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
};`);

await page.goto(`${BASE}/explore?city=seattle-wa`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".maplibregl-canvas", { timeout: 60_000 });
await page.waitForFunction("!!window.__rcFindMap()", null, { timeout: 60_000 });

// The map canvas is NOT the viewport: Explore insets it for the top bar, the
// strip and the tab bar. Lift it out and let it fill the phone before shooting.
const size = await page.evaluate(async () => {
  const el = document.querySelector(".rc-explore-map");
  document.body.appendChild(el);
  for (const child of [...document.body.children]) {
    if (child !== el) child.style.display = "none";
  }
  // Kill the scrollbar BEFORE measuring. `100vw` counts the scrollbar gutter
  // but the screenshot does not paint the map under it, so a page that still
  // scrolls bakes a 15px white stripe down the right edge of the still -- and
  // the canvas measures the full width regardless, so the size check below
  // passes and says nothing about it.
  document.documentElement.style.cssText = "overflow:hidden;margin:0";
  document.body.style.cssText = "overflow:hidden;margin:0";
  el.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;margin:0;";
  const map = window.__rcFindMap();
  map.resize();
  await new Promise((r) => setTimeout(r, 300));
  const c = map.getCanvas();
  return { w: c.clientWidth, h: c.clientHeight, doc: document.documentElement.clientWidth };
});
if (size.w !== W + 2 * MARGIN || size.h !== H) {
  throw new Error(`canvas is ${size.w}x${size.h}, expected ${W + 2 * MARGIN}x${H}`);
}
if (frames.some((f) => f.width !== W || f.height !== H)) {
  throw new Error("every frame in one run must share the capture size");
}

await page.addStyleTag({
  content: `.maplibregl-ctrl-container, .maplibregl-control-container { display: none !important; }`,
});

for (const f of frames) {
  const check = await page.evaluate(async (f) => {
    const map = window.__rcFindMap();
    map.setLayoutProperty("bc-spot-puck", "visibility", "none");
    map.jumpTo({ center: [f.centerLng, f.centerLat], zoom: f.zoom, bearing: 0, pitch: 0 });
    await new Promise((resolve) => {
      const done = () => map.loaded() && map.areTilesLoaded();
      if (done()) return resolve();
      const t = setInterval(() => { if (done()) { clearInterval(t); resolve(); } }, 100);
      setTimeout(() => { clearInterval(t); resolve(); }, 30000);
    });
    await new Promise((r) => setTimeout(r, 800));
    // The projection check: reel-frame.ts's arithmetic against MapLibre's own.
    // Reported in the CLIPPED image's pixels, which is what the frame is
    // defined in — map.project() answers in the wider capture canvas.
    return f.probes.map(([lng, lat]) => {
      const p = map.project([lng, lat]);
      return { lng, lat, x: p.x - f.margin, y: p.y };
    });
  }, { ...f, margin: MARGIN });
  fs.writeFileSync(`${outDir}/${f.name}.probe.json`, JSON.stringify(check, null, 2));
  await page.screenshot({
    path: `${outDir}/${f.name}.png`,
    clip: { x: MARGIN, y: 0, width: W, height: H },
  });
  console.log(`captured ${f.name} z${f.zoom} @ ${f.centerLng},${f.centerLat}`);
}

await browser.close();
