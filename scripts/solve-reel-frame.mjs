/**
 * Solve the sheet for an /lp/<city>/<n> reel hero.
 *
 * The reel shows a 375x724 window onto a larger baked still and slides it
 * from mark to mark at a fixed zoom (see src/app/lp/_reel/reel-frame.ts). So
 * what has to be solved is not "which single screen holds the most marks" but
 * "which run of marks is worth carrying, and how big is the sheet that holds
 * them" -- because the sheet is the hero's LCP image and its area is the bill.
 *
 *   node scripts/solve-reel-frame.mjs seattle-wa 11
 *   node scripts/solve-reel-frame.mjs victoria-bc 11 --require="Constance Bank,William Head"
 *
 * Prints, for a range of sheet-area budgets, the best contiguous run of marks
 * at that zoom: the frame numbers to paste into a `ReelFrame`, and where each
 * stop lands once the window has panned to it.
 *
 * `--require` names marks the sheet MUST hold and be able to pan clear of the
 * chrome, exactly as `fishing_spots.name` spells them. Without it the search
 * optimises for stop COUNT, which is the right default and is not always what
 * the page is for: Victoria's unconstrained answer was the waterfront alone,
 * leaving out Constance Bank and everything west toward Pedder Bay, because
 * adding them costs area and buys no extra stops. Required marks are also
 * seeded into the declutter ahead of the score, mirroring `ReelFrame.featured`
 * -- otherwise the script would report a sheet holding a mark that the reel
 * would then decline to stop at.
 *
 * What it refuses outright: any sheet that slices an NDBC buoy label on its
 * edge (`buoy-label` draws from z9.5 up and the reel does not redraw it), and
 * any stop the window cannot bring clear of the reel's own chrome.
 *
 * Marks come from the same payload and the same widest-coverage species rule
 * the page itself ranks on (city-proof.ts), so the sheet is solved against the
 * marks the reel will actually be handed.
 */
import { readFileSync } from "node:fs";

const API = process.env.BLUECASTER_API_URL ?? "https://www.bluecaster.co";
const KEY = process.env.BLUECASTER_API_KEY;

const city = process.argv[2] ?? "seattle-wa";
const zoom = Number(process.argv[3] ?? 11);
const requireArg = process.argv.slice(4).find((a) => a.startsWith("--require="));
const REQUIRED = requireArg
  ? requireArg.slice("--require=".length).split(",").map((s) => s.trim()).filter(Boolean)
  : [];

// Mirrors reel-frame.ts and explore-reel.tsx. Kept as literals rather than
// imported: this is a plain node script and those are TS modules in the app.
const TILE = 512, VW = 375, VH = 724;
const SAFE = { x0: 28, y0: 130, x1: 347, y1: 462 };
const FOCUS = { x: VW / 2, y: 316 };
const PIN_GAP = 26, MAX_STOPS = 8;
/** Half-width and drop of a two-line buoy label, measured off a capture. */
const LABEL_HALF = 82, LABEL_DROP = 44;
/** Sheet areas to report, in map px. 375x724 = 272k is one screen. */
const BUDGETS = [500_000, 750_000, 1_000_000, 1_250_000];
/** 1250k is here because a REQUIRED list can force a sheet past the point any
 *  unconstrained search would go: Victoria's four named marks need 1200k, and
 *  a budget list that stopped at 1000k answered "nothing fits" to a frame that
 *  is shipped. Cost is roughly linear in area, so read the tiers as a price
 *  list rather than a limit. */

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
    X: mercX(s.lng) * world,
    Y: mercY(s.lat) * world,
  }))
  .sort((a, b) => a.Y - b.Y);
console.log(`${city} at z${zoom}: ranking on ${payload.species[widest].name}, ${marks.length} scored marks`);
const missing = REQUIRED.filter((r) => !marks.some((m) => m.name === r));
if (missing.length) throw new Error(`not scored in ${city}, or not spelled this way: ${missing.join(", ")}`);
console.log(REQUIRED.length ? `requiring: ${REQUIRED.join(", ")}\n` : "");

/** Buoys, read from the very GeoJSON the map style hands MapLibre. */
const buoys = JSON.parse(
  readFileSync(new URL("../public/buoy_stations_salish.geojson", import.meta.url), "utf8"),
).features.map((f) => ({
  X: mercX(f.geometry.coordinates[0]) * world,
  Y: mercY(f.geometry.coordinates[1]) * world,
}));

/** A candidate sheet from one contiguous run of marks, north to south. */
function sheetFor(run) {
  // Every required mark has to be in this run at all before anything else is
  // worth computing.
  if (REQUIRED.some((r) => !run.some((m) => m.name === r))) return null;
  // Declutter as the reel does: required marks first (ReelFrame.featured),
  // then best-first.
  const kept = [];
  const byScore = [...run].sort((a, b) => b.score - a.score);
  const ordered = [
    ...REQUIRED.flatMap((r) => byScore.filter((m) => m.name === r)),
    ...byScore,
  ];
  const seen = new Set();
  for (const m of ordered) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    const clash = kept.some((k) => Math.abs(k.X - m.X) < PIN_GAP && Math.abs(k.Y - m.Y) < PIN_GAP);
    if (!clash) kept.push(m);
    if (kept.length === MAX_STOPS) break;
  }
  const xs = kept.map((k) => k.X), ys = kept.map((k) => k.Y);
  const width = Math.ceil(Math.max(...xs) - Math.min(...xs)) + VW;
  const height = Math.ceil(Math.max(...ys) - Math.min(...ys)) + VH;
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;

  // A required mark decluttered away or capped out is a sheet that does not
  // do what it was asked for.
  if (REQUIRED.some((r) => !kept.some((m) => m.name === r))) return null;

  /**
   * Centring on the marks is the first guess, not the only one.
   *
   * A sheet is rejected when it slices a buoy label, for a good reason:
   * `buoy-label` draws from z9.5, the reel does not redraw it, and half a
   * station name hanging off an edge is the one artefact a still cannot
   * explain. But rejection was doing too much work. A sliced label is one that
   * is nearly off the sheet already, and every stop has slack in the safe
   * area, so the fix is almost always a few pixels of pan.
   *
   * Victoria is the case that found this. Its four required marks put New
   * Dungeness 76 px past the right edge against an 82 px label half-width, so
   * six pixels bled on -- and because the box is derived from the marks, EVERY
   * candidate run holding those four produced the same six pixels and the
   * search reported "nothing fits" for a frame that is otherwise fine.
   *
   * So nudge before giving up: same size, centre offset, first offset to
   * satisfy both rules wins. Ordered by distance, so the answer stays as close
   * to mark-centred as the constraints allow, and capped at 160 px -- past
   * that the sheet is no longer framed on its own marks and the honest answer
   * is a different run.
   */
  const NUDGE_MAX = 160, NUDGE_STEP = 4;
  const offsets = [{ dx: 0, dy: 0 }];
  for (let r = NUDGE_STEP; r <= NUDGE_MAX; r += NUDGE_STEP) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) offsets.push({ dx, dy });
  }

  for (const { dx, dy } of offsets) {
    const cX = midX + dx, cY = midY + dy;
    const toSheet = (m) => ({ x: m.X - cX + width / 2, y: m.Y - cY + height / 2 });

    // Every buoy label must be wholly on the sheet or wholly off it.
    let sliced = false;
    for (const b of buoys) {
      const { x, y } = toSheet(b);
      const off = x < -LABEL_HALF || x > width + LABEL_HALF || y < -LABEL_DROP || y > height + LABEL_DROP;
      const whole = x - LABEL_HALF >= 0 && x + LABEL_HALF <= width && y >= 0 && y + LABEL_DROP <= height;
      if (!off && !whole) { sliced = true; break; }
    }
    if (sliced) continue;

    // Every stop must be reachable: pan the window to it, then check the chrome.
    const stops = [];
    let unreachable = false;
    for (const m of [...kept].sort((a, b) => a.Y - b.Y)) {
      const { x, y } = toSheet(m);
      const tx = clamp(x - FOCUS.x, 0, width - VW);
      const ty = clamp(y - FOCUS.y, 0, height - VH);
      const vx = x - tx, vy = y - ty;
      if (vx < SAFE.x0 || vx > SAFE.x1 || vy < SAFE.y0 || vy > SAFE.y1) { unreachable = true; break; }
      stops.push({ name: m.name, score: m.score, x, y, tx, ty, vx, vy });
    }
    if (unreachable) continue;

    return {
      width, height, stops, nudge: { dx, dy },
      centerLng: (cX / world) * 360 - 180,
      centerLat: unmercY(cY / world),
    };
  }
  return null;
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
    .sort((a, b) => b.stops.length - a.stops.length || a.width * a.height - b.width * b.height)[0];
  console.log(`sheet ≤ ${(budget / 1000).toFixed(0)}k px:`);
  if (!best) { console.log("  nothing fits\n"); continue; }
  console.log(
    `  ${best.stops.length} stops   ${best.width}x${best.height}` +
      ` (${((best.width * best.height) / 1000).toFixed(0)}k px)` +
      `   centre ${best.centerLng.toFixed(5)}, ${best.centerLat.toFixed(5)}` +
      (best.nudge.dx || best.nudge.dy
        ? `   (nudged ${best.nudge.dx},${best.nudge.dy} px off the marks to clear a buoy label)`
        : ""),
  );
  for (const s of best.stops) {
    console.log(
      `      ${s.score}  ${s.name.padEnd(36)}` +
        ` sheet(${s.x.toFixed(0)},${s.y.toFixed(0)}) pan(${s.tx.toFixed(0)},${s.ty.toFixed(0)})`,
    );
  }
  console.log();
}
