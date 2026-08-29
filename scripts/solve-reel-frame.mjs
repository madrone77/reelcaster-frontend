/**
 * Solve the frame for an /lp/<city>/<n> reel hero.
 *
 * The four numbers in a `ReelFrame` describe a capture, not a preference, and
 * they were searched for rather than eyeballed. This is that search, kept so
 * the next city costs a run rather than an afternoon.
 *
 *   node scripts/solve-reel-frame.mjs seattle-wa 10.1 10.7
 *
 * What it optimises, in order:
 *   1. Stops — marks that land inside REEL_SAFE and survive the reel's own
 *      declutter at PIN_GAP. A reel with three stops is a slideshow.
 *   2. Even travel — the largest minimum gap between consecutive stops down
 *      the frame. Two clumps with a hole between them score badly here even
 *      when the raw spread looks wide.
 * And what it refuses outright: any frame that slices an NDBC buoy label on
 * the bezel. See the notes on SEATTLE_FRAME in src/app/lp/_reel/reel-frame.ts.
 *
 * Marks come from the same payload and the same widest-coverage species rule
 * the page itself ranks on (city-proof.ts), so the frame is solved against the
 * marks the reel will actually be handed.
 */
import { readFileSync } from "node:fs";

const API = process.env.BLUECASTER_API_URL ?? "https://www.bluecaster.co";
const KEY = process.env.BLUECASTER_API_KEY;

const city = process.argv[2] ?? "seattle-wa";
const zLo = Number(process.argv[3] ?? 8.5);
const zHi = Number(process.argv[4] ?? 11);

// Mirrors reel-frame.ts and explore-reel.tsx. Kept as literals rather than
// imported: this is a plain node script and those are TS modules in the app.
const TILE = 512, W = 375, H = 724;
const SAFE = { x0: 28, y0: 130, x1: 347, y1: 462 };
const PIN_GAP = 26, MAX_STOPS = 8;
/** Half-width and drop of a two-line buoy label, measured off a capture. */
const LABEL_HALF = 82, LABEL_DROP = 44;

const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
const unmercY = (y) => (Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 4) * 360 / Math.PI;
const project = (f, lng, lat) => {
  const world = TILE * 2 ** f.zoom;
  return {
    x: (mercX(lng) - mercX(f.centerLng)) * world + W / 2,
    y: (mercY(lat) - mercY(f.centerLat)) * world + H / 2,
  };
};
const inSafe = (x, y) => x >= SAFE.x0 && x <= SAFE.x1 && y >= SAFE.y0 && y <= SAFE.y1;

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
  .map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, score: Math.round(s.scores[widest].peak * 100) }))
  .sort((a, b) => b.score - a.score);
console.log(`${city}: ranking on ${payload.species[widest].name}, ${marks.length} scored marks\n`);

/**
 * Buoys, read from the very GeoJSON the map style hands MapLibre. Their labels
 * draw from z9.5 up (`buoy-label` in src/lib/map/relief-style.ts) and the reel
 * does not redraw them, so they constrain the frame.
 */
const buoys = JSON.parse(
  readFileSync(new URL("../public/buoy_stations_salish.geojson", import.meta.url), "utf8"),
).features.map((f) => ({
  name: f.properties.name,
  lng: f.geometry.coordinates[0],
  lat: f.geometry.coordinates[1],
}));

const labelsClean = (f) =>
  buoys.every((b) => {
    const { x, y } = project(f, b.lng, b.lat);
    const out = x < -LABEL_HALF || x > W + LABEL_HALF || y < -LABEL_DROP || y > H + LABEL_DROP;
    const whole = x - LABEL_HALF >= 0 && x + LABEL_HALF <= W && y >= 0 && y + LABEL_DROP <= H;
    return out || whole;
  });

function evaluate(f) {
  const visible = marks.map((p) => ({ p, at: project(f, p.lng, p.lat) })).filter(({ at }) => inSafe(at.x, at.y));
  const kept = [];
  for (const v of visible) {
    const clash = kept.some((k) => Math.abs(k.at.x - v.at.x) < PIN_GAP && Math.abs(k.at.y - v.at.y) < PIN_GAP);
    if (!clash) kept.push(v);
    if (kept.length === MAX_STOPS) break;
  }
  const ordered = [...kept].sort((a, b) => a.at.y - b.at.y);
  let minGap = Infinity;
  for (let i = 1; i < ordered.length; i++) {
    minGap = Math.min(minGap, Math.hypot(ordered[i].at.x - ordered[i - 1].at.x, ordered[i].at.y - ordered[i - 1].at.y));
  }
  return { stops: kept.length, minGap: Number.isFinite(minGap) ? minGap : 0, kept: ordered };
}

const lats = marks.map((p) => p.lat), lngs = marks.map((p) => p.lng);
const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
const lngMid = (Math.min(...lngs) + Math.max(...lngs)) / 2;

for (let zoom = zLo; zoom <= zHi + 1e-9; zoom = +(zoom + 0.1).toFixed(2)) {
  const world = TILE * 2 ** zoom;
  let best = null;
  for (let dy = -120; dy <= 120; dy++) {
    for (let dx = -120; dx <= 120; dx++) {
      const centerLng = lngMid + ((dx * 4) / world) * 360;
      const centerLat = unmercY(mercY(latMid) + (dy * 4) / world);
      const f = { zoom, centerLng, centerLat };
      if (!labelsClean(f)) continue;
      const r = evaluate(f);
      if (!best || r.stops > best.r.stops || (r.stops === best.r.stops && r.minGap > best.r.minGap)) {
        best = { f, r };
      }
    }
  }
  if (!best) { console.log(`z${zoom}  no frame clears the buoy labels`); continue; }
  console.log(
    `z${zoom}  ${best.f.centerLng.toFixed(4)}, ${best.f.centerLat.toFixed(4)}` +
      `  ${best.r.stops} stops, closest pair ${best.r.minGap.toFixed(0)}px`,
  );
  for (const k of best.r.kept) {
    console.log(`        ${k.p.score}  ${k.p.name.padEnd(36)} x${k.at.x.toFixed(0)} y${k.at.y.toFixed(0)}`);
  }
}
