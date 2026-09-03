/**
 * Bake the "Where, what, and when" picture for an /lp/<city>/1 hero.
 *
 * See src/app/lp/_city1/city1-city.ts: every city-first page shows one real
 * spot page on ITS OWN water, captioned with the mark's name, and the caption
 * names a jurisdiction. That is why the field is required rather than optional
 * -- a city added without its own capture would otherwise show another
 * regulator's screen to a reader who can tell.
 *
 *   BASE=http://localhost:3033 node scripts/capture-where-what-when.mjs <spot-slug> <out.png> [province]
 *
 * The picture is NOT a screenshot of the spot page with arrows pasted on. It
 * is src/app/lp/_city1/where-what-when-phone.tsx: the homepage's own
 * SpotHeroPhone inside the same PhoneFrame the hero reel wears, with the three
 * callouts measured off the rendered rows. This script only opens the
 * development route that mounts it, waits for the mini map's tiles, and
 * screenshots the element with a transparent background at 2x.
 *
 * The route is /dev/where-what-when/<slug>, which 404s in production, so
 * BASE must be a dev server.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3033";
const slug = process.argv[2];
const out = process.argv[3];
const province = process.argv[4] ?? "BC";
if (!slug || !out) {
  throw new Error("usage: capture-where-what-when.mjs <spot-slug> <out.png> [province]");
}

const browser = await chromium.launch();
const page = await browser.newPage({
  // Wider than the picture, so nothing in the page wraps around it.
  viewport: { width: 1280, height: 1100 },
  deviceScaleFactor: 2,
});

await page.goto(
  `${BASE}/dev/where-what-when/${slug}?province=${encodeURIComponent(province)}`,
  { waitUntil: "networkidle", timeout: 120_000 },
);

// The bathymetry map at the foot of the screen keeps fetching after
// networkidle settles, and a short wait bakes flat navy water under the
// contour lines -- on the one picture arguing the water is not flat. Wait for
// MapLibre to say it is done, and only fall back to a fixed pause if the map
// never turns up.
await page
  .waitForFunction(
    () => {
      const el = document.querySelector(".maplibregl-map");
      if (!el) return false;
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (!key) return false;
      const isMap = (o) =>
        o && typeof o === "object" && typeof o.areTilesLoaded === "function";
      for (let f = el[key], hop = 0; f && hop < 40; f = f.return, hop++) {
        for (let h = f.memoizedState, i = 0; h && i < 40; h = h.next, i++) {
          const s = h.memoizedState;
          for (const m of [s, s?.current, s?.map]) {
            if (isMap(m)) return m.loaded() && m.areTilesLoaded();
          }
        }
      }
      return false;
    },
    null,
    { timeout: 45_000 },
  )
  .catch(() => console.warn("map never reported loaded; capturing anyway"));
await page.waitForTimeout(2500);

// The route sits under the root layout, which hangs the app's own fixed
// bottom nav on a phone-width window and the dev overlay on any. Neither is
// part of the picture: hide everything in the body that is not the picture
// or an ancestor of it, and make the ground see-through so omitBackground
// means something.
await page.addStyleTag({
  content:
    "body *:not([data-wwv]):not([data-wwv] *):not(:has([data-wwv])){display:none!important}" +
    "html,body{background:transparent!important;margin:0!important}",
});
await page.waitForTimeout(300);

const host = page.locator("[data-wwv]");
const arrows = await host.locator("svg text").allTextContents();
if (arrows.length < 3) {
  throw new Error(`expected three callouts, found ${arrows.length}: ${arrows.join(", ")}`);
}
const name = await host.locator("h2").first().textContent();

await host.screenshot({ path: out, type: "png", omitBackground: true });
const box = await host.boundingBox();
await browser.close();
console.log(
  `wrote ${out} for ${name?.trim()} (${Math.round(box.width * 2)}x${Math.round(box.height * 2)}), callouts: ${arrows.join(" / ")}`,
);
