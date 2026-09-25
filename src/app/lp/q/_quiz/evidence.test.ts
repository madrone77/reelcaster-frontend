import assert from "node:assert";
import { pickSpot, rankSpecies, type EvidenceSpot, type KeptByArea, type ReportCounts } from "./evidence";

// Run with: npx tsx src/app/lp/q/_quiz/evidence.test.ts

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const SEA = { lat: 47.6, lng: -122.33 };
const COHO = "coho";
const HALI = "hali";
const hours = Array(24).fill(70);
const spot = (id: string, lat: number, lng: number, o: Partial<EvidenceSpot> = {}): EvidenceSpot => ({
  id, slug: id, name: id, lat, lng, access: "boat", shoreKind: null, area: "10", areaAgency: "WDFW",
  trackRecord: null, scores: { [COHO]: { score: 80, peakHour: 7, hours } }, ...o,
});
const wdfw = (s: EvidenceSpot) => s.areaAgency === "WDFW" && !!s.area;

test("kept fish in the home area beat a single post further out", () => {
  const spots = [
    spot("shilshole", 47.68, -122.41, { trackRecord: "popular" }),
    spot("kingston", 47.8, -122.49),
  ];
  const reports: ReportCounts = { kingston: { [COHO]: 1 } };
  const kept: KeptByArea = { "10": { "Coho Salmon": 3879 } };
  const p = pickSpot(spots, COHO, "Coho Salmon", "boat", reports, kept, wdfw, SEA)!;
  assert.equal(p.spot.slug, "shilshole");
  assert.equal(p.source, "kept");
});

test("two posts at a spot are reports, and they win", () => {
  const spots = [spot("a", 47.65, -122.4), spot("b", 47.7, -122.4)];
  const p = pickSpot(spots, COHO, "Coho Salmon", "boat", { b: { [COHO]: 3 } }, {}, wdfw, SEA)!;
  assert.equal(p.spot.slug, "b");
  assert.equal(p.source, "reports");
});

test("halibut goes out to the area where it is kept, past closer water", () => {
  const halScore = { [HALI]: { score: 85, peakHour: 9, hours } };
  const spots = [
    spot("elliott", 47.6, -122.36, { scores: halScore }),
    spot("indian-point", 47.93, -122.55, { area: "9", scores: halScore }),
  ];
  const kept: KeptByArea = { "9": { Halibut: 9 } };
  const p = pickSpot(spots, HALI, "Pacific Halibut", "boat", {}, kept, wdfw, SEA)!;
  assert.equal(p.spot.slug, "indian-point");
  assert.equal(p.areaLabel, "Marine Area 9");
});

test("no shore spot for halibut on score alone", () => {
  const spots = [spot("pier", 47.6, -122.35, { access: "shore", scores: { [HALI]: { score: 90, peakHour: 9, hours } } })];
  assert.equal(pickSpot(spots, HALI, "Pacific Halibut", "shore", {}, {}, wdfw, SEA), null);
});

test("a fish nobody is catching is not offered", () => {
  const spots = [spot("a", 47.65, -122.4, { scores: { [COHO]: { score: 80, peakHour: 7, hours }, [HALI]: { score: 90, peakHour: 7, hours } } })];
  const species = { [COHO]: { id: COHO, slug: "coho-salmon", name: "Coho Salmon" }, [HALI]: { id: HALI, slug: "pacific-halibut", name: "Pacific Halibut" } };
  const ranked = rankSpecies(spots, species, {}, { "10": { "Coho Salmon": 50 } }, wdfw, SEA);
  assert.deepEqual(ranked.map((r) => r.species.slug), ["coho-salmon"]);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${name}`);
    console.log(err);
  }
}
if (failed) process.exit(1);
