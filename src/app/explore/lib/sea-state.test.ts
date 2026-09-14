// Unit tests for the sea-state label and colour mapping in sea-state.ts.
//
// Run with: npx tsx src/app/explore/lib/sea-state.test.ts

import assert from "node:assert/strict";
import {
  SEA_BAND_COLOR,
  SEA_LABELS,
  formatTrain,
  legacySeaLabel,
  readRailSea,
  readSea,
  seaBand,
  seaDetailLine,
  seaColor,
  type SeaHour,
} from "./sea-state";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

const SAN_DIEGO_HOUR: SeaHour = {
  swell: { h: 1.22, p: 6.2, dir: 271 },
  swell2: { h: 0.6, p: 8.4, dir: 200 },
  chop: { h: 0.05, p: 1, dir: 200 },
  chop_estimated: false,
  combined_h: 1.46,
  felt_swell_h: 1.09,
  severity: 0.22,
  label: "Easy",
  reason: "Small swell",
};

test("every label maps to a band in order, Lumpy and Choppy share one", () => {
  assert.deepEqual(SEA_LABELS.map(seaBand), [0, 1, 2, 2, 3, 4]);
});

test("colour follows the label, not the height", () => {
  assert.equal(seaColor("Flat"), SEA_BAND_COLOR[0]);
  assert.equal(seaColor("Lumpy"), seaColor("Choppy"));
  assert.equal(seaColor("Rough"), "#EA580C");
  assert.equal(seaColor("Dangerous"), "#E11D48");
  assert.equal(seaColor(null), SEA_BAND_COLOR[0]);
  // A 1.46 m combined sea labelled Easy by the backend is grey, not orange.
  const r = readSea({ sea: SAN_DIEGO_HOUR, waveM: 1.46 });
  assert.equal(r?.label, "Easy");
  assert.equal(seaColor(r?.label), "#94A3B8");
});

test("the backend label wins over the old height reading", () => {
  const r = readSea({ sea: SAN_DIEGO_HOUR, waveM: 1.46, windKt: 5 });
  assert.equal(r?.modelled, true);
  assert.equal(r?.estimated, false);
  assert.equal(r?.swell?.p, 6.2);
});

test("an old payload with no sea object falls back to height, in the new words", () => {
  assert.equal(readSea({ waveM: 0.1 })?.label, "Flat");
  assert.equal(readSea({ waveM: 1.2 })?.label, "Lumpy");
  assert.equal(readSea({ waveM: 1.2 })?.modelled, false);
  assert.equal(legacySeaLabel(3), "Dangerous");
  assert.equal(readSea({ waveM: null, windKt: null }), null);
});

test("dry wave cells: the wind estimate is marked estimated on both paths", () => {
  const legacy = readSea({ waveM: null, windKt: 15, windGustKt: 20 });
  assert.equal(legacy?.estimated, true);
  const modelled = readSea({
    sea: { swell: null, chop: { h: 0.3, p: null, dir: 200 }, chop_estimated: true, combined_h: null, severity: 0.15, label: "Easy", reason: "Light wind chop" },
  });
  assert.equal(modelled?.estimated, true);
  assert.equal(modelled?.label, "Easy");
});

test("a sea object with an unknown label is ignored rather than trusted", () => {
  const r = readSea({ sea: { ...SAN_DIEGO_HOUR, label: "Choppy-ish" as never }, waveM: 0.1 });
  assert.equal(r?.modelled, false);
  assert.equal(r?.label, "Flat");
});

test("swell text reads like a buoy report", () => {
  assert.equal(formatTrain({ h: 1.22, p: 13.2, dir: 271 }, "ft"), "4 ft @ 13 s W");
  assert.equal(formatTrain({ h: 0.5, p: 9, dir: 180 }, "ft"), "1.5 ft @ 9 s S");
  assert.equal(formatTrain({ h: 1.22, p: null, dir: null }, "m"), "1.2 m");
  assert.equal(formatTrain(null, "ft"), null);
});

test("detail line: a real swell by buoy words, the chop when the swell is tiny, nothing for an estimate", () => {
  assert.equal(seaDetailLine(readSea({ sea: SAN_DIEGO_HOUR }), "ft"), "4 ft @ 6 s W");
  const victoria = readSea({
    sea: { swell: { h: 0.05, p: 2, dir: 270 }, chop: { h: 0.3, p: 2, dir: 260 }, combined_h: 0.3, severity: 0.12, label: "Easy", reason: "Light wind chop" },
  });
  assert.equal(seaDetailLine(victoria, "m"), "0.3 m chop");
  assert.equal(seaDetailLine(readSea({ waveM: 0.8 }), "ft"), "2.5 ft");
  assert.equal(seaDetailLine(readSea({ waveM: null, windKt: 18 }), "ft"), null);
});

test("rail cells: backend label and swell when sent, height fallback when not", () => {
  const withSea = readRailSea({ wav: 1.4, wkt: 6, sea: "Lumpy", sev: 0.3, swh: 1.2, swp: 12, swd: 280 });
  assert.equal(withSea?.label, "Lumpy");
  assert.equal(formatTrain(withSea?.swell, "ft"), "4 ft @ 12 s W");
  const old = readRailSea({ wav: 1.4, wkt: 6 });
  assert.equal(old?.modelled, false);
  assert.equal(old?.label, "Lumpy");
  assert.equal(readRailSea({ wav: null, wkt: 12, sea: "Choppy", sest: true })?.estimated, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
