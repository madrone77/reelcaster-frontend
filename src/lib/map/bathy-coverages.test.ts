/**
 * Run with: npx tsx src/lib/map/bathy-coverages.test.ts
 *
 * The style builder is pure, so the cases are the shapes the manifest can
 * take: no coverages (an older manifest), the BC entry that must be skipped,
 * a two-tier US coverage that splits at the switch zoom, a one-tier coverage,
 * and the malformed entries that must not take the map down.
 */

import assert from "node:assert/strict";
import { buildReliefStyle } from "./relief-style";
import {
  applyBathyCoverages,
  coverageLayerId,
  coverageSetId,
  coverageSourceId,
  coverageTileSet,
  isBathyContourLayer,
  TIER_SWITCH_ZOOM,
  type BathyCoverage,
  type BathyManifestLike,
  type StyleLike,
} from "./bathy-coverages";

const ORIGIN = "https://www.reelcaster.com";

function freshStyle(): StyleLike {
  return buildReliefStyle(ORIGIN) as unknown as StyleLike;
}

const ATTR = "NOAA Office of Coast Survey BlueTopo; NOAA NCEI CUDEM and ETOPO 2022.";

function usCoverage(id: string, tiers: Array<"t1" | "t3"> = ["t1", "t3"]): BathyCoverage {
  const pmtiles: BathyCoverage["pmtiles"] = {};
  for (const t of tiers) pmtiles[t] = { file: `bathymetry-${t}.${id}.2026-09.pmtiles`, source_layer: "contours" };
  return { id, country: "US", bbox: [-122.6, 36.2, -121.6, 37.4], version: "2026-09", attribution: ATTR, pmtiles };
}

const bc: BathyCoverage = {
  id: "bc",
  country: "CA",
  bbox: [-135, 46.5, -122, 55],
  version: "2026-05",
  attribution: "Contains information licensed under the Open Government Licence - Canada.",
  pmtiles: { t1: { file: "bathymetry-t1.2026-05.pmtiles" }, t3: { file: "bathymetry-t3.2026-05.pmtiles" } },
};

// An older manifest, or a failed read: the style is exactly the BC style.
{
  const base = freshStyle();
  for (const manifest of [null, undefined, {}, { coverages: [] }] as Array<BathyManifestLike | null | undefined>) {
    const style = freshStyle();
    const r = applyBathyCoverages(style, manifest, ORIGIN);
    assert.deepEqual(r, { added: [], skipped: [] });
    assert.deepEqual(style, base, "no coverages must leave the style byte-for-byte alone");
  }
}

// BC is skipped: it is already the style's own contours source.
{
  const base = freshStyle();
  const style = freshStyle();
  const r = applyBathyCoverages(style, { coverages: [bc] }, ORIGIN);
  assert.deepEqual(r, { added: [], skipped: ["bc"] });
  assert.deepEqual(style, base);
}

// A two-tier US coverage: two bounded sources, clones after the originals,
// t1 capped at the switch zoom, t3 from it, labels on t3 only.
{
  const style = freshStyle();
  const cov = usCoverage("us-ca-monterey");
  const r = applyBathyCoverages(style, { coverages: [bc, cov] }, ORIGIN);
  assert.deepEqual(r, { added: ["us-ca-monterey"], skipped: ["bc"] });

  for (const tier of ["t1", "t3"] as const) {
    const src = style.sources[coverageSourceId("us-ca-monterey", tier)];
    assert.ok(src, `source for ${tier}`);
    assert.equal(src.type, "vector");
    assert.deepEqual(src.bounds, cov.bbox);
    assert.notEqual(src.bounds, cov.bbox, "bounds is a copy, not the manifest's array");
    assert.deepEqual(src.tiles, [`${ORIGIN}/api/map/tiles/${coverageSetId(cov, tier)}/{z}/{x}/{y}`]);
    assert.equal(src.attribution, ATTR);
  }
  // The BC source is untouched.
  assert.equal(style.sources.contours.tiles?.[0], `${ORIGIN}/api/map/tiles/contours-z14-2026-06/{z}/{x}/{y}`);

  const ids = style.layers.map((l) => l.id);
  const lineIdx = ids.indexOf("contour-line");
  const labelsIdx = ids.indexOf("contour-labels");
  const lineT1 = ids.indexOf(coverageLayerId("contour-line", "us-ca-monterey", "t1"));
  const coastT1 = ids.indexOf(coverageLayerId("contour-coast", "us-ca-monterey", "t1"));
  const lineT3 = ids.indexOf(coverageLayerId("contour-line", "us-ca-monterey", "t3"));
  const coastT3 = ids.indexOf(coverageLayerId("contour-coast", "us-ca-monterey", "t3"));
  const labelsT3 = ids.indexOf(coverageLayerId("contour-labels", "us-ca-monterey", "t3"));
  assert.ok(lineT1 > lineIdx && coastT1 > lineT1 && lineT3 > coastT1 && coastT3 > lineT3, "line clones ride right after contour-line");
  assert.equal(ids[lineIdx + 1], ids[lineT1]);
  assert.equal(ids[labelsIdx + 1], ids[labelsT3], "label clone rides right after contour-labels");
  assert.equal(ids.indexOf(coverageLayerId("contour-labels", "us-ca-monterey", "t1")), -1, "labels start above the switch, so t1 has none");
  // Only the clones were added; nothing else moved.
  const baseIds = freshStyle().layers.map((l) => l.id);
  assert.deepEqual(ids.filter((id) => baseIds.includes(id)), baseIds);
  assert.equal(ids.length, baseIds.length + 5);

  const byId = new Map(style.layers.map((l) => [l.id, l]));
  const t1 = byId.get(ids[lineT1])!;
  const t3 = byId.get(ids[lineT3])!;
  assert.equal(t1.minzoom, 10, "keeps the BC line's floor");
  assert.equal(t1.maxzoom, TIER_SWITCH_ZOOM);
  assert.equal(t3.minzoom, TIER_SWITCH_ZOOM);
  assert.equal(t3.maxzoom, undefined);
  assert.equal(t1.source, coverageSourceId("us-ca-monterey", "t1"));
  assert.equal(t3.source, coverageSourceId("us-ca-monterey", "t3"));
  assert.equal(t3["source-layer"], "contours");
  assert.deepEqual(t3.paint, byId.get("contour-line")!.paint, "same ink as the BC lines");
  assert.deepEqual(t3.filter, ["all", ["==", ["get", "system"], "ft"], ["!=", ["get", "depth"], 0]]);
  assert.deepEqual(t3.metadata, { "bathy:coverage": "us-ca-monterey", "bathy:tier": "t3" });

  const coast = byId.get(ids[coastT3])!;
  assert.deepEqual(coast.filter, ["all", ["==", ["get", "system"], "ft"], ["==", ["get", "depth"], 0]]);

  const labels = byId.get(ids[labelsT3])!;
  assert.equal(labels.minzoom, 12, "keeps the BC labels' floor, which is above the switch");
  assert.deepEqual(labels.layout?.["text-field"], ["concat", ["to-string", ["get", "depth"]], " ft"]);
  assert.deepEqual(labels.layout?.["text-font"], ["Open Sans Semibold"], "the one font this app ships");
  assert.deepEqual(labels.filter, ["all", ["==", ["get", "system"], "ft"], ["in", ["get", "depth"], ["literal", [10, 20, 30, 50, 75, 100, 200, 400, 700]]]]);

  // The toggle reaches the whole family and nothing else.
  for (const id of ids) {
    const expected = id.startsWith("contour-line") || id.startsWith("contour-labels") || id.startsWith("contour-coast");
    assert.equal(isBathyContourLayer(id), expected, id);
  }
  assert.equal(isBathyContourLayer("color-relief"), false);
}

// One tier only: a single source, no zoom split.
{
  const style = freshStyle();
  const r = applyBathyCoverages(style, { coverages: [usCoverage("us-x", ["t3"])] }, ORIGIN);
  assert.deepEqual(r.added, ["us-x"]);
  assert.equal(style.sources[coverageSourceId("us-x", "t1")], undefined);
  const line = style.layers.find((l) => l.id === coverageLayerId("contour-line", "us-x", "t3"))!;
  assert.equal(line.minzoom, 10);
  assert.equal(line.maxzoom, undefined);
}

// Malformed entries are skipped, never thrown on.
{
  const style = freshStyle();
  const junk = [
    null,
    { id: "no-bbox", pmtiles: { t1: { file: "a.pmtiles" } } },
    { id: "bad-bbox", bbox: [1, 2, 3], pmtiles: { t1: { file: "a.pmtiles" } } },
    { id: "flipped-bbox", bbox: [-121, 36, -122, 37], pmtiles: { t1: { file: "a.pmtiles" } } },
    { id: "no-files", bbox: [-122, 36, -121, 37], pmtiles: {} },
    { bbox: [-122, 36, -121, 37], pmtiles: { t1: { file: "a.pmtiles" } } },
    usCoverage("us-ok"),
  ] as unknown as BathyCoverage[];
  const r = applyBathyCoverages(style, { coverages: junk }, ORIGIN);
  assert.deepEqual(r.added, ["us-ok"]);
  assert.deepEqual(r.skipped, ["no-bbox", "bad-bbox", "flipped-bbox", "no-files"]);
}

// Set ids round-trip through the proxy resolver, and only listed ones do.
{
  const manifest = { coverages: [bc, usCoverage("us-ca-monterey")] };
  const id = coverageSetId(usCoverage("us-ca-monterey"), "t3");
  assert.equal(id, "cov-us-ca-monterey-t3-2026-09");
  const def = coverageTileSet(manifest, id);
  assert.ok(def);
  assert.equal(def.url, "https://szbrwccppikqkystlgmq.supabase.co/storage/v1/object/public/bathymetry/bathymetry-t3.us-ca-monterey.2026-09.pmtiles");
  assert.equal(def.contentType, "application/x-protobuf");
  assert.equal(def.gzip, true);
  assert.equal(coverageTileSet(manifest, "cov-us-ca-monterey-t3-2026-08"), null, "a version the manifest does not list");
  assert.equal(coverageTileSet(manifest, "cov-bc-t3-2026-05"), null, "BC is never served as a coverage set");
  assert.equal(coverageTileSet(manifest, "contours-z14-2026-06"), null, "fixed sets are not this resolver's job");
  assert.equal(coverageTileSet(null, id), null);
}

console.log("bathy-coverages: all cases pass");
