/**
 * Run with: npx tsx src/lib/map/bathy-coverages.test.ts
 *
 * The style builder is pure, so the cases are the shapes the manifest can
 * take: no coverages (an older manifest), the BC entry that must be skipped,
 * a two-tier US coverage that splits at the switch zoom, a one-tier coverage,
 * a coverage that also ships land + relief (the newer manifest), and the
 * malformed entries that must not take the map down.
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
  isBathyLandLayer,
  isBathyReliefLayer,
  isBathymetryLayer,
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

/** The newer manifest: the contour pair plus the land mask and the relief raster. */
function fullCoverage(id: string): BathyCoverage {
  const cov = usCoverage(id);
  cov.pmtiles.land = { file: `bathymetry-land.${id}.2026-09.pmtiles`, source_layer: "land" };
  cov.pmtiles.relief = { file: `relief-hybrid-webp.${id}.2026-09.pmtiles`, source_layer: null };
  return cov;
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

  // An older manifest without land or relief adds neither.
  assert.equal(style.sources[coverageSourceId("us-ca-monterey", "land")], undefined);
  assert.equal(style.sources[coverageSourceId("us-ca-monterey", "relief")], undefined);
  assert.equal(ids.indexOf(coverageLayerId("land", "us-ca-monterey", "land")), -1);
  assert.equal(ids.indexOf(coverageLayerId("color-relief", "us-ca-monterey", "relief")), -1);
}

// The newer manifest: land + relief beside the contour pair. The relief
// raster clone rides right after color-relief (under the contours), the land
// fill clone right after the BC land mask, both bounded to the footprint.
{
  const style = freshStyle();
  const cov = fullCoverage("us-wa-graysharbor");
  const r = applyBathyCoverages(style, { coverages: [bc, cov] }, ORIGIN);
  assert.deepEqual(r, { added: ["us-wa-graysharbor"], skipped: ["bc"] });

  const relief = style.sources[coverageSourceId("us-wa-graysharbor", "relief")];
  assert.ok(relief, "relief source");
  assert.equal(relief.type, "raster");
  assert.equal(relief.tileSize, 256);
  assert.equal(relief.minzoom, 8);
  assert.equal(relief.maxzoom, 14);
  assert.deepEqual(relief.bounds, cov.bbox);
  assert.deepEqual(relief.tiles, [`${ORIGIN}/api/map/tiles/cov-us-wa-graysharbor-relief-2026-09/{z}/{x}/{y}`]);
  assert.equal(relief.attribution, ATTR);

  const land = style.sources[coverageSourceId("us-wa-graysharbor", "land")];
  assert.ok(land, "land source");
  assert.equal(land.type, "vector");
  assert.equal(land.minzoom, 4);
  assert.equal(land.maxzoom, 14);
  assert.deepEqual(land.bounds, cov.bbox);
  assert.deepEqual(land.tiles, [`${ORIGIN}/api/map/tiles/cov-us-wa-graysharbor-land-2026-09/{z}/{x}/{y}`]);

  // The BC sources are untouched.
  assert.equal(style.sources.relief.tiles?.[0], `${ORIGIN}/api/map/tiles/relief-webp-2026-06/{z}/{x}/{y}`);
  assert.equal(style.sources.land.tiles?.[0], `${ORIGIN}/api/map/tiles/land-2026-05/{z}/{x}/{y}`);

  const ids = style.layers.map((l) => l.id);
  const reliefId = coverageLayerId("color-relief", "us-wa-graysharbor", "relief");
  const landId = coverageLayerId("land", "us-wa-graysharbor", "land");
  assert.equal(reliefId, "color-relief--us-wa-graysharbor-relief");
  assert.equal(landId, "land--us-wa-graysharbor-land");
  assert.equal(ids[ids.indexOf("color-relief") + 1], reliefId, "relief clone rides right after color-relief");
  assert.equal(ids[ids.indexOf("land") + 1], landId, "land clone rides right after the BC land mask");
  assert.ok(ids.indexOf(reliefId) < ids.indexOf("contour-line"), "shading sits under the contours");
  assert.ok(ids.indexOf(landId) > ids.indexOf(coverageLayerId("contour-labels", "us-wa-graysharbor", "t3")), "land covers the contours");
  const baseIds = freshStyle().layers.map((l) => l.id);
  assert.deepEqual(ids.filter((id) => baseIds.includes(id)), baseIds, "nothing else moved");
  assert.equal(ids.length, baseIds.length + 7);

  const byId = new Map(style.layers.map((l) => [l.id, l]));
  const reliefLayer = byId.get(reliefId)!;
  assert.equal(reliefLayer.type, "raster");
  assert.equal(reliefLayer.source, coverageSourceId("us-wa-graysharbor", "relief"));
  assert.deepEqual(reliefLayer.paint, byId.get("color-relief")!.paint, "same raster paint as BC");
  assert.equal(reliefLayer.minzoom, undefined);
  assert.deepEqual(reliefLayer.metadata, { "bathy:coverage": "us-wa-graysharbor", "bathy:archive": "relief" });

  const landLayer = byId.get(landId)!;
  assert.equal(landLayer.type, "fill");
  assert.equal(landLayer.source, coverageSourceId("us-wa-graysharbor", "land"));
  assert.equal(landLayer["source-layer"], "land");
  assert.deepEqual(landLayer.paint, byId.get("land")!.paint, "same opaque LAND_COLOR as BC");
  assert.deepEqual(landLayer.metadata, { "bathy:coverage": "us-wa-graysharbor", "bathy:archive": "land" });

  // Families: the Bathymetry toggle flips relief + contours, never land.
  assert.equal(isBathyReliefLayer("color-relief"), true);
  assert.equal(isBathyReliefLayer(reliefId), true);
  assert.equal(isBathyReliefLayer(landId), false);
  assert.equal(isBathyLandLayer("land"), true);
  assert.equal(isBathyLandLayer(landId), true);
  assert.equal(isBathyLandLayer(reliefId), false);
  assert.equal(isBathyLandLayer("land-x"), false);
  for (const id of ids) {
    const expected = isBathyReliefLayer(id) || isBathyContourLayer(id);
    assert.equal(isBathymetryLayer(id), expected, id);
  }
  assert.equal(isBathymetryLayer(landId), false);
  assert.equal(isBathymetryLayer("bg"), false);
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
  assert.equal(coverageTileSet(manifest, "cov-us-ca-monterey-land-2026-09"), null, "an older manifest has no land archive");
  assert.equal(coverageTileSet(manifest, "cov-us-ca-monterey-relief-2026-09"), null, "nor a relief archive");
  assert.equal(coverageTileSet(manifest, "cov-bc-t3-2026-05"), null, "BC is never served as a coverage set");
  assert.equal(coverageTileSet(manifest, "contours-z14-2026-06"), null, "fixed sets are not this resolver's job");
  assert.equal(coverageTileSet(null, id), null);
}

// Land and relief set ids resolve to their own serving rules: the raster
// is WebP served as-is (like the BC relief set), the land mask is gzipped MVT.
{
  const cov = fullCoverage("us-ca-sandiego");
  const manifest = { coverages: [bc, cov] };
  const relief = coverageTileSet(manifest, coverageSetId(cov, "relief"));
  assert.ok(relief);
  assert.equal(relief.url, "https://szbrwccppikqkystlgmq.supabase.co/storage/v1/object/public/bathymetry/relief-hybrid-webp.us-ca-sandiego.2026-09.pmtiles");
  assert.equal(relief.contentType, "image/webp");
  assert.equal(relief.gzip, false);
  assert.equal(relief.minzoom, 8);
  assert.equal(relief.maxzoom, 14);
  const land = coverageTileSet(manifest, coverageSetId(cov, "land"));
  assert.ok(land);
  assert.equal(land.url, "https://szbrwccppikqkystlgmq.supabase.co/storage/v1/object/public/bathymetry/bathymetry-land.us-ca-sandiego.2026-09.pmtiles");
  assert.equal(land.contentType, "application/x-protobuf");
  assert.equal(land.gzip, true);
  assert.equal(land.minzoom, 4);
  assert.equal(land.maxzoom, 14);
}

console.log("bathy-coverages: all cases pass");
