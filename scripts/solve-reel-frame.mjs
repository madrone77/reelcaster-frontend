/**
 * Solve the sheet for an /lp/<city>/<n> reel hero.
 *
 * The reel shows a 375x724 window onto a larger baked still and slides it
 * from mark to mark at a fixed zoom (see src/app/lp/_reel/reel-frame.ts). So
 * what has to be solved is not "which single screen holds the most marks" but
 * "which run of marks is worth carrying, and how big is the sheet that holds
 * them" -- because the sheet is the hero's LCP image and its area is the bill.
 *
 *   node scripts/solve-reel-frame.mjs seattle-wa 11 [budgets-in-k]
 *
 * Prints, for a range of sheet-area budgets, the best contiguous run of marks
 * at that zoom: the frame numbers to paste into a `ReelFrame`, and where each
 * stop lands once the window has panned to it.
 *
 * What it refuses outright: any sheet that slices an NDBC buoy label on its
 * edge (`buoy-label` draws from z9.5 up and the reel does not redraw it), and
 * any stop the window cannot bring clear of the reel's own chrome.
 *
 * Marks come from the same payload and the same widest-coverage species rule
 * the page itself ranks on (city-proof.ts), so the sheet is solved against the
 * marks the reel will actually be handed -- in the reel's own order, which
 * since 2026-09-03 is marks with fresh reports (`has_reports`, the map's "Hot"
 * tag) first and score second. A sheet is ranked on how many Hot stops it
 * carries before how many stops, because the tag is the one thing on the
 * phone a Pro viewer's map shows that a stranger's does not.
 */
import { readFileSync } from "node:fs";

const API = process.env.BLUECASTER_API_URL ?? "https://www.bluecaster.co";
const KEY = process.env.BLUECASTER_API_KEY;

const city = process.argv[2] ?? "seattle-wa";
const zoom = Number(process.argv[3] ?? 11);

// Mirrors reel-frame.ts and explore-reel.tsx. Kept as literals rather than
// imported: this is a plain node script and those are TS modules in the app.
const TILE = 512, VW = 375, VH = 724;
// y1 is the card top (503) less a Hot puck's badge (35 + 8) and its ring (2).
const SAFE = { x0: 28, y0: 130, x1: 347, y1: 458 };
const FOCUS = { x: VW / 2, y: 316 };
// PIN_GAP is the map's own declutter distance: two puck half-widths (19) plus
// its stroke allowance (4), centre to centre. See spot-geojson.ts PIN_MIN_DIST.
const PIN_GAP = 42, MAX_STOPS = 8;
/** Half-width and drop of a two-line buoy label, measured off a capture. */
const LABEL_HALF = 82, LABEL_DROP = 44;
/**
 * Water kept beyond the safe box at the sheet's edges, so a stop at the edge
 * of the run is not drawn against the bezel. The sheet only has to bring each
 * stop inside the safe box after the clamped pan: a stop can sit anywhere in
 * the middle of the sheet (the window centres on it) and only the outermost
 * stops are ever off-centre, so the sheet is the run's spread plus the safe
 * box's own margins, not the spread plus a whole window. The first version
 * of this solver added a whole window and sized every sheet ~1.5x too large.
 */
const EDGE = 48;
/** Sheet areas to report, in map px. 375x724 = 272k is one screen. An
 *  optional third argument lists other budgets in k, e.g. `1000,1250,1500`. */
const BUDGETS = process.argv[4]
  ? process.argv[4].split(",").map((k) => Number(k) * 1000)
  : [500_000, 750_000, 1_000_000];

const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
const unmercY = (y) => (Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 4) * 360 / Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const world = TILE * 2 ** zoom;

const res = await fetch(`${API}/api/v1/map/spots?city=${city}`, {
  headers: KEY ? { "x-api-key": KEY } : {},
});
if (!res.ok) throw new Error(`map/spots ${res.status} — set BLUECASTER_API_KEY`);
const payload = await res.json();

// The species the page ranks on: the one scored at the most marks.
const coverage = new Map();
for (const s of payload.spots) {
  for (const id of Object.keys(s.scores ?? {})) coverage.set(id, (coverage.get(id) ?? 0) + 1);
}
const widest = [...coverage.entries()].sort((a, b) => b[1] - a[1])[0][0];
const marks = payload.spots
  .filter((s) => s.scores?.[widest])
  .map((s) => ({
    name: s.name,
    score: Math.round(s.scores[widest].peak * 100),
    hot: s.has_reports === true,
    X: mercX(s.lng) * world,
    Y: mercY(s.lat) * world,
  }))
  .sort((a, b) => a.Y - b.Y);
console.log(
  `${city} at z${zoom}: ranking on ${payload.species[widest].name}, ${marks.length} scored marks,` +
    ` ${marks.filter((m) => m.hot).length} with reports today\n`,
);

/** Buoys, read from the very GeoJSON the map style hands MapLibre. */
const buoys = JSON.parse(
  readFileSync(new URL("../public/buoy_stations_salish.geojson", import.meta.url), "utf8"),
).features.map((f) => ({
  X: mercX(f.geometry.coordinates[0]) * world,
  Y: mercY(f.geometry.coordinates[1]) * world,
}));

/** A candidate sheet from one contiguous run of marks, north to south. */
function sheetFor(run) {
  // Declutter in the reel's own order -- reports first, then score -- and
  // keep what is left.
  const kept = [];
  for (const m of [...run].sort((a, b) => Number(b.hot) - Number(a.hot) || b.score - a.score)) {
    const clash = kept.some((k) => Math.hypot(k.X - m.X, k.Y - m.Y) < PIN_GAP);
    if (!clash) kept.push(m);
    if (kept.length === MAX_STOPS) break;
  }
  const xs = kept.map((k) => k.X), ys = kept.map((k) => k.Y);
  // Margins the safe box demands at each edge of the sheet, plus EDGE. The
  // bottom is the exception: the safe box only says a southern stop clears the
  // card, which parks it in the 48 px between the card and the safe line with
  // nothing but land above it -- on Vancouver the three harbour stops came out
  // as a phone showing the North Shore, yellow to the middle of the screen. So
  // the sheet reaches far enough below the last stop for the window to centre
  // it, exactly as it centres every stop in the middle of the run.
  const left = SAFE.x0 + EDGE, right = VW - SAFE.x1 + EDGE;
  const top = SAFE.y0 + EDGE, bottom = Math.max(VH - SAFE.y1 + EDGE, VH - FOCUS.y);
  const width = Math.max(VW, Math.ceil(Math.max(...xs) - Math.min(...xs)) + left + right);
  const height = Math.max(VH, Math.ceil(Math.max(...ys) - Math.min(...ys)) + top + bottom);
  // The run sits `left` in from the sheet's left edge and `top` down from its
  // top, centred in whatever slack the VW/VH floors leave.
  const spreadX = Math.max(...xs) - Math.min(...xs), spreadY = Math.max(...ys) - Math.min(...ys);
  const x0 = left + (width - left - right - spreadX) / 2;
  const y0 = top + (height - top - bottom - spreadY) / 2;
  const cX = Math.min(...xs) - x0 + width / 2;
  const cY = Math.min(...ys) - y0 + height / 2;
  const toSheet = (m) => ({ x: m.X - cX + width / 2, y: m.Y - cY + height / 2 });

  // Every buoy label must be wholly on the sheet or wholly off it.
  for (const b of buoys) {
    const { x, y } = toSheet(b);
    const off = x < -LABEL_HALF || x > width + LABEL_HALF || y < -LABEL_DROP || y > height + LABEL_DROP;
    const whole = x - LABEL_HALF >= 0 && x + LABEL_HALF <= width && y >= 0 && y + LABEL_DROP <= height;
    if (!off && !whole) return null;
  }

  // Every stop must be reachable: pan the window to it, then check the chrome.
  const stops = [];
  for (const m of kept.sort((a, b) => a.Y - b.Y)) {
    const { x, y } = toSheet(m);
    const tx = clamp(x - FOCUS.x, 0, width - VW);
    const ty = clamp(y - FOCUS.y, 0, height - VH);
    const vx = x - tx, vy = y - ty;
    if (vx < SAFE.x0 || vx > SAFE.x1 || vy < SAFE.y0 || vy > SAFE.y1) return null;
    stops.push({ name: m.name, score: m.score, hot: m.hot, x, y, tx, ty, vx, vy });
  }
  return {
    width, height, stops,
    hot: stops.filter((s) => s.hot).length,
    centerLng: (cX / world) * 360 - 180,
    centerLat: unmercY(cY / world),
  };
}

const candidates = [];
for (let i = 0; i < marks.length; i++) {
  for (let j = i + 2; j <= marks.length; j++) {
    const s = sheetFor(marks.slice(i, j));
    if (s) candidates.push(s);
  }
}

for (const budget of BUDGETS) {
  const best = candidates
    .filter((c) => c.width * c.height <= budget)
    .sort(
      (a, b) =>
        b.hot - a.hot ||
        b.stops.length - a.stops.length ||
        a.width * a.height - b.width * b.height,
    )[0];
  console.log(`sheet ≤ ${(budget / 1000).toFixed(0)}k px:`);
  if (!best) { console.log("  nothing fits\n"); continue; }
  console.log(
    `  ${best.stops.length} stops, ${best.hot} hot   ${best.width}x${best.height}` +
      ` (${((best.width * best.height) / 1000).toFixed(0)}k px)` +
      `   centre ${best.centerLng.toFixed(5)}, ${best.centerLat.toFixed(5)}`,
  );
  for (const s of best.stops) {
    console.log(
      `      ${s.hot ? "HOT " : "    "}${s.score}  ${s.name.padEnd(36)}` +
        ` sheet(${s.x.toFixed(0)},${s.y.toFixed(0)}) pan(${s.tx.toFixed(0)},${s.ty.toFixed(0)})`,
    );
  }
  console.log();
}
