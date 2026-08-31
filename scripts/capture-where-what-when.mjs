/**
 * Bake the "Where, what, and when" photograph for an /lp/<city>/1 hero.
 *
 * See src/app/lp/_city1/city1-city.ts: every city-first page shows one real
 * spot page on ITS OWN water, captioned with the mark's name, and the caption
 * names a jurisdiction. That is why the field is required rather than optional
 * -- a city added without its own capture would otherwise show another
 * regulator's screen to a reader who can tell.
 *
 *   node scripts/capture-where-what-when.mjs <spot-slug> <out.png>
 *
 * Writes a transparent-background PNG of the spot page in a phone, with the
 * three callouts laid over it. The arrow targets are MEASURED off the rendered
 * page rather than typed in: a longer mark name or a different species roster
 * moves the rows, and an arrow pointing at the wrong line is worse than no
 * arrow at all.
 *
 * Two things it does on purpose:
 *
 * The page is captured 50 CSS px short and dropped 50 px down the screen, with
 * a strip of the app's own header blue painted above it. The status bar has to
 * go somewhere, and drawing it over the live header would put an iOS clock on
 * top of the ReelCaster wordmark.
 *
 * It captures ANONYMOUSLY. The two shipped shots were taken signed in and
 * carry a stranger's initials in the corner; what a reader arriving from an ad
 * actually sees is this.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3043";
const slug = process.argv[2];
const out = process.argv[3];
if (!slug || !out) throw new Error("usage: capture-where-what-when.mjs <spot-slug> <out.png>");

/** Phone screen, and the strip at the top of it the status bar gets. */
const SCREEN = { w: 390, h: 844 };
const STATUS = 50;
/** The app's own header colour, so the strip and the header are one blue. */
const HEADER_BLUE = "#2536D9";
const BEZEL = 10;
const CANVAS = { w: 700, h: 900 };
const PHONE_X = 270, PHONE_Y = 15;

const browser = await chromium.launch();

// ── 1. The spot page itself, and where its three rows landed ──────────────
const page = await browser.newPage({
  viewport: { width: SCREEN.w, height: SCREEN.h - STATUS },
  deviceScaleFactor: 2,
});
await page.goto(`${BASE}/explore/spot/${slug}`, { waitUntil: "networkidle", timeout: 120_000 });
// The bathymetry map at the foot of the page keeps fetching after networkidle
// settles, and a short wait bakes a screen where the vector lines have drawn
// and the seabed under them has not -- which reads as flat navy water on the
// one screen the page is using to argue the water is not flat. Wait for
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
  .catch(() => {});
await page.waitForTimeout(2500);
// The dev overlay is a real element and would otherwise be baked in.
// The dev overlay is a real element and would otherwise be baked in, and the
// scrollbar gutter bakes a white stripe down the right edge -- the same trap
// scripts/capture-reel.mjs documents, and the screenshot is the width the
// viewport claims either way, so nothing catches it but the eye.
await page.addStyleTag({
  content:
    "nextjs-portal,[data-nextjs-toast]{display:none!important}" +
    "html,body{overflow:hidden!important;margin:0!important}" +
    "::-webkit-scrollbar{width:0!important;height:0!important}",
});
await page.waitForTimeout(300);

const marks = await page.evaluate(() => {
  const leaves = (re) =>
    [...document.querySelectorAll("*")].filter(
      (e) => e.children.length === 0 && re.test((e.textContent ?? "").trim()),
    );
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  };
  // The <h1> is the mark: the caption prints this name, so read it here too
  // rather than trusting the argument.
  const h1 = document.querySelector("h1");
  // The first species tile.
  //
  // Found by walking down from the SPECIES kicker rather than by guessing a
  // y band: a two-line mark name ("Five Finger Island" wraps where "Trial
  // Islands" does not) pushes the whole row down, and a band that fits one
  // city misses the next. Climbing to "the first ancestor with a border"
  // fails differently and worse -- it walks past the tile to a page-level
  // box, and the highlight then frames the whole screen.
  const kicker = leaves(/^Species$/i)[0];
  const section = kicker?.parentElement?.parentElement ?? null;
  const card = section
    ? [...section.querySelectorAll("*")].find((e) => {
        const r = e.getBoundingClientRect();
        return r.height >= 50 && r.height <= 130 && r.width >= 90 && r.width <= 230;
      }) ?? null
    : null;

  const win = leaves(/^BEST WINDOW$/i)[0];
  return {
    name: h1 ? h1.textContent.trim() : null,
    nameBox: h1 ? rect(h1) : null,
    cardBox: card ? rect(card) : null,
    windowBox: win ? rect(win.parentElement ?? win) : null,
  };
});
for (const [k, v] of Object.entries(marks)) if (!v) throw new Error(`could not find ${k} on /explore/spot/${slug}`);

const shot = (await page.screenshot({ type: "png" })).toString("base64");
await page.close();
console.log(`captured ${marks.name}`);

// ── 2. The composite ─────────────────────────────────────────────────────
/** Screen coordinates to canvas coordinates. */
const cx = (x) => PHONE_X + BEZEL + x;
const cy = (y) => PHONE_Y + BEZEL + STATUS + y;

/**
 * One callout: a slab with a triangular head, pointing at a row of the page.
 *
 * `dir` is which way the head points, so a callout can come in from either
 * side without a second path to keep in step with this one.
 */
function arrow({ label, dir, tipX, tipY, tail }) {
  const H = 78, HH = 152, HW = 86, s = dir === "right" ? 1 : -1;
  const neck = tipX - s * HW;
  const d = [
    `M${tipX},${tipY}`,
    `L${neck},${tipY - HH / 2}`,
    `L${neck},${tipY - H / 2}`,
    `L${tail},${tipY - H / 2}`,
    `L${tail},${tipY + H / 2}`,
    `L${neck},${tipY + H / 2}`,
    `L${neck},${tipY + HH / 2}`,
    "Z",
  ].join("");
  return `<path d="${d}" fill="#262626" filter="url(#sh)"/>
    <text x="${(neck + tail) / 2}" y="${tipY}" fill="#fff" font-size="40" font-weight="800"
      font-family="Inter,-apple-system,Helvetica,Arial,sans-serif"
      text-anchor="middle" dominant-baseline="central">${label}</text>`;
}

const card = marks.cardBox;
const win = marks.windowBox;
const name = marks.nameBox;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.w}" height="${CANVAS.h}" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}">
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity="0.22"/>
    </filter>
    <clipPath id="screen">
      <rect x="${PHONE_X + BEZEL}" y="${PHONE_Y + BEZEL}" width="${SCREEN.w}" height="${SCREEN.h}" rx="46"/>
    </clipPath>
  </defs>

  <!-- phone -->
  <rect x="${PHONE_X}" y="${PHONE_Y}" width="${SCREEN.w + 2 * BEZEL}" height="${SCREEN.h + 2 * BEZEL}"
        rx="56" fill="#1c1c1e" filter="url(#sh)"/>
  <g clip-path="url(#screen)">
    <rect x="${PHONE_X + BEZEL}" y="${PHONE_Y + BEZEL}" width="${SCREEN.w}" height="${STATUS}" fill="${HEADER_BLUE}"/>
    <image href="data:image/png;base64,${shot}" x="${cx(0)}" y="${cy(0)}" width="${SCREEN.w}" height="${SCREEN.h - STATUS}"/>
  </g>

  <!-- status bar, over the header blue -->
  <text x="${cx(28)}" y="${PHONE_Y + BEZEL + 30}" fill="#fff" font-size="17" font-weight="700"
        font-family="Inter,-apple-system,Helvetica,Arial,sans-serif" dominant-baseline="central">6:05</text>
  <g fill="#fff" transform="translate(${cx(300)},${PHONE_Y + BEZEL + 23})">
    <rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="8" rx="1"/>
    <rect x="10" y="2" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/>
    <path d="M25 3.5a13 13 0 0 1 15 0l-1.9 2.3a10 10 0 0 0-11.2 0Zm3.3 4a8 8 0 0 1 8.4 0l-1.9 2.3a5 5 0 0 0-4.6 0Zm2.6 4.2a3 3 0 0 1 3.2 0L32.5 14Z"/>
    <rect x="47" y="1.5" width="20" height="11" rx="3" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.6"/>
    <rect x="49" y="3.5" width="16" height="7" rx="1.6"/>
    <rect x="68.5" y="5" width="1.6" height="4" rx="0.8" opacity="0.6"/>
  </g>
  <rect x="${cx(SCREEN.w / 2 - 55)}" y="${PHONE_Y + BEZEL + 11}" width="110" height="31" rx="16" fill="#000"/>

  <!-- what: the species tile the score is read off -->
  <rect x="${cx(card.left - 5)}" y="${cy(card.top - 5)}"
        width="${card.right - card.left + 10}" height="${card.bottom - card.top + 10}"
        rx="14" fill="#2536D9" fill-opacity="0.12" stroke="#2536D9" stroke-width="3"/>

  ${arrow({ label: "Where?", dir: "right", tipX: cx(name.left - 2), tipY: cy((name.top + name.bottom) / 2), tail: 0 })}
  ${arrow({ label: "What?", dir: "left", tipX: cx(card.right + 8), tipY: cy((card.top + card.bottom) / 2), tail: CANVAS.w })}
  ${arrow({ label: "When?", dir: "right", tipX: cx(win.left + 46), tipY: cy((win.top + win.bottom) / 2 + 26), tail: 0 })}
</svg>`;

const shell = await browser.newPage({
  viewport: { width: CANVAS.w, height: CANVAS.h },
  deviceScaleFactor: 2,
});
await shell.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
await shell.waitForTimeout(400);
await shell.screenshot({ path: out, omitBackground: true });
await browser.close();
console.log(`wrote ${out} (${CANVAS.w * 2}x${CANVAS.h * 2})`);
