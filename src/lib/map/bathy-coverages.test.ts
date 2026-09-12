/**
 * Run with: npx tsx src/lib/map/bathy-coverages.test.ts
 *
 * The style builder is pure, so the cases are the shapes the manifest can
 * take: no coverages (an older manifest), the BC entry that must be skipped,
 * a two-tier US coverage that splits at the switch zoom, a one-tier coverage,
 * a coverage that also ships land + relief (the newer manifest), and the
 * malformed entries that must not take the map down, and the schema 2 `base`
 * (coast-wide relief + land) with the schema 1 per-coverage land fallback.
 */

import assert from "node:assert/strict";
import { buildReliefStyle } from "./relief-style";
import {
  applyBathyCoverages,
  baseSetId,
  baseVersion,
  BASE_ID,
  coverageLayerId,
  coverageSetId,
  coverageSourceId,
  coverageTileSet,
  isBathyContourLayer,
  isBathyLandLayer,
  isBathyReliefLayer,
  isBathymetryLayer,
  drawableBase,
  TIER_SWITCH_ZOOM,
  type BathyBase,
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
    assert.deepEqual(r, { added: [], skipped: [], base: [] });
    assert.deepEqual(style, base, "no coverages must leave the style byte-for-byte alone");
  }
}

// BC is skipped: it is already the style's own contours source.
{
  const base = freshStyle();
  const style = freshStyle();
  const r = applyBathyCoverages(style, { coverages: [bc] }, ORIGIN);
  assert.deepEqual(r, { added: [], skipped: ["bc"], base: [] });
  assert.deepEqual(style, base);
}

// A two-tier US coverage: two bounded sources, clones after the originals,
// t1 capped at the switch zoom, t3 from it, labels on t3 only.
{
  const style = freshStyle();
  const cov = usCoverage("us-ca-monterey");
  const r = applyBathyCoverages(style, { coverages: [bc, cov] }, ORIGIN);
  assert.deepEqual(r, { added: ["us-ca-monterey"], skipped: ["bc"], base: [] });

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
  assert.deepEqual(r, { added: ["us-wa-graysharbor"], skipped: ["bc"], base: [] });

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

// Schema 2: the coast-wide base. One bounded raster source drawn as a clone
// of color-relief right after the BC raster and BEFORE every footprint relief
// clone; one bounded vector source drawn as a clone of the BC land fill
// right after it. Per-coverage land is gone, so no land clone per coverage.
const BASE_ATTR = "Base relief: NOAA NCEI ETOPO 2022 (public domain). Land (c) OpenStreetMap contributors (ODbL).";
function schema2Base(): BathyBase {
  return {
    relief: { file: "relief-base.westcoast.2026-09.pmtiles", label: "Coast-wide relief", source_layer: null, minzoom: 0, maxzoom: 9 },
    land: { file: "bathymetry-land.westcoast.2026-09.pmtiles", label: "Coast-wide land", source_layer: "land" },
    bbox: [-136, 30, -114, 56],
    attribution: BASE_ATTR,
  };
}
/** A schema 2 coverage: contours + feathered relief, no land. */
function schema2Coverage(id: string): BathyCoverage {
  const cov = usCoverage(id);
  cov.pmtiles.relief = { file: `relief-hybrid-webp.${id}.2026-09b.pmtiles`, source_layer: null };
  return cov;
}
{
  const style = freshStyle();
  const base = schema2Base();
  const covA = schema2Coverage("us-ca-farallones");
  const covB = schema2Coverage("us-ca-sfbay");
  const r = applyBathyCoverages(style, { coverages_schema: 2, base, coverages: [bc, covA, covB] }, ORIGIN);
  assert.deepEqual(r, { added: ["us-ca-farallones", "us-ca-sfbay"], skipped: ["bc"], base: ["relief", "land"] });

  const relief = style.sources[coverageSourceId(BASE_ID, "relief")];
  assert.ok(relief, "base relief source");
  assert.equal(relief.type, "raster");
  assert.equal(relief.tileSize, 256);
  assert.equal(relief.minzoom, 0);
  assert.equal(relief.maxzoom, 9);
  assert.deepEqual(relief.bounds, base.bbox);
  assert.notEqual(relief.bounds, base.bbox, "bounds is a copy");
  assert.deepEqual(relief.tiles, [`${ORIGIN}/api/map/tiles/base-relief-2026-09/{z}/{x}/{y}`]);
  assert.equal(relief.attribution, BASE_ATTR);

  const land = style.sources[coverageSourceId(BASE_ID, "land")];
  assert.ok(land, "base land source");
  assert.equal(land.type, "vector");
  assert.equal(land.minzoom, 0);
  assert.equal(land.maxzoom, 14);
  assert.deepEqual(land.bounds, base.bbox);
  assert.deepEqual(land.tiles, [`${ORIGIN}/api/map/tiles/base-land-2026-09/{z}/{x}/{y}`]);
  assert.equal(land.attribution, BASE_ATTR);

  const ids = style.layers.map((l) => l.id);
  const byId = new Map(style.layers.map((l) => [l.id, l]));
  const baseReliefId = coverageLayerId("color-relief", BASE_ID, "relief");
  const baseLandId = coverageLayerId("land", BASE_ID, "land");
  assert.equal(baseReliefId, "color-relief--base-relief");
  assert.equal(baseLandId, "land--base-land");

  // Placement: base relief right after color-relief, then the footprints in
  // manifest order, all before contour-line.
  assert.equal(ids[ids.indexOf("color-relief") + 1], baseReliefId, "base relief rides right after the BC raster");
  assert.equal(ids[ids.indexOf("color-relief") + 2], coverageLayerId("color-relief", "us-ca-farallones", "relief"));
  assert.equal(ids[ids.indexOf("color-relief") + 3], coverageLayerId("color-relief", "us-ca-sfbay", "relief"));
  assert.ok(ids.indexOf(baseReliefId) < ids.indexOf("contour-line"), "under the contours");
  // Base land right after the BC land mask; no per-coverage land clones.
  assert.equal(ids[ids.indexOf("land") + 1], baseLandId, "base land rides right after the BC land fill");
  assert.equal(ids.indexOf(coverageLayerId("land", "us-ca-farallones", "land")), -1, "schema 2 has no per-coverage land");
  assert.equal(style.sources[coverageSourceId("us-ca-farallones", "land")], undefined);

  const reliefLayer = byId.get(baseReliefId)!;
  assert.equal(reliefLayer.type, "raster");
  assert.equal(reliefLayer.source, coverageSourceId(BASE_ID, "relief"));
  assert.deepEqual(reliefLayer.paint, byId.get("color-relief")!.paint, "linear resampling, no fade, same as BC");
  assert.equal(reliefLayer.minzoom, undefined, "MapLibre overzooms the z9 raster above it");
  assert.deepEqual(reliefLayer.metadata, { "bathy:coverage": BASE_ID, "bathy:archive": "relief" });

  const landLayer = byId.get(baseLandId)!;
  assert.equal(landLayer.type, "fill");
  assert.equal(landLayer.source, coverageSourceId(BASE_ID, "land"));
  assert.equal(landLayer["source-layer"], "land");
  assert.deepEqual(landLayer.paint, byId.get("land")!.paint, "same opaque LAND_COLOR as BC");
  assert.deepEqual(landLayer.metadata, { "bathy:coverage": BASE_ID, "bathy:archive": "land" });

  // Only the expected layers were added; nothing else moved.
  const baseIds = freshStyle().layers.map((l) => l.id);
  assert.deepEqual(ids.filter((id) => baseIds.includes(id)), baseIds);

  // Toggle families: the Bathymetry toggle reaches the base relief with the
  // BC raster, the footprint reliefs and the contours; the base land stays
  // with the land family, which the toggle never touches.
  assert.equal(isBathyReliefLayer(baseReliefId), true);
  assert.equal(isBathymetryLayer(baseReliefId), true);
  assert.equal(isBathyLandLayer(baseLandId), true);
  assert.equal(isBathymetryLayer(baseLandId), false);
  assert.equal(isBathyContourLayer(baseReliefId), false);
  const toggled = ids.filter(isBathymetryLayer);
  assert.ok(toggled.includes("color-relief") && toggled.includes(baseReliefId) && toggled.includes(coverageLayerId("color-relief", "us-ca-sfbay", "relief")));
  assert.ok(toggled.includes("contour-line") && toggled.includes(coverageLayerId("contour-line", "us-ca-sfbay", "t3")));
  assert.ok(!toggled.includes("land") && !toggled.includes(baseLandId));

  // The proxy serves the base ids: WebP raster z0 to z9, gzipped MVT land.
  const manifest = { coverages_schema: 2, base, coverages: [bc, covA] };
  assert.equal(baseSetId(base, "relief"), "base-relief-2026-09");
  assert.equal(baseSetId(base, "land"), "base-land-2026-09");
  const reliefDef = coverageTileSet(manifest, "base-relief-2026-09");
  assert.ok(reliefDef);
  assert.equal(reliefDef.url, "https://szbrwccppikqkystlgmq.supabase.co/storage/v1/object/public/bathymetry/relief-base.westcoast.2026-09.pmtiles");
  assert.equal(reliefDef.contentType, "image/webp");
  assert.equal(reliefDef.gzip, false);
  assert.equal(reliefDef.minzoom, 0);
  assert.equal(reliefDef.maxzoom, 9);
  const landDef = coverageTileSet(manifest, "base-land-2026-09");
  assert.ok(landDef);
  assert.equal(landDef.url, "https://szbrwccppikqkystlgmq.supabase.co/storage/v1/object/public/bathymetry/bathymetry-land.westcoast.2026-09.pmtiles");
  assert.equal(landDef.contentType, "application/x-protobuf");
  assert.equal(landDef.gzip, true);
  assert.equal(landDef.minzoom, 0);
  assert.equal(landDef.maxzoom, 14);
  assert.equal(coverageTileSet(manifest, "base-relief-2026-08"), null, "a version the manifest does not list");
  assert.equal(coverageTileSet({ coverages: [bc, covA] }, "base-relief-2026-09"), null, "a schema 1 manifest has no base");
  // The feathered footprint relief resolves by its own version as before.
  const hd = coverageTileSet(manifest, coverageSetId(covA, "relief"));
  assert.ok(hd);
  assert.equal(hd.url, "https://szbrwccppikqkystlgmq.supabase.co/storage/v1/object/public/bathymetry/relief-hybrid-webp.us-ca-farallones.2026-09b.pmtiles");
}

// The base version comes from the manifest's `version` if there is one, else
// the bake date in the file name, else the file stem.
{
  assert.equal(baseVersion(undefined, "relief-base.westcoast.2026-09.pmtiles"), "2026-09");
  assert.equal(baseVersion({}, "relief-hybrid-webp.us-ca-sfbay.2026-09b.pmtiles"), "2026-09b");
  assert.equal(baseVersion({ version: "v7" }, "relief-base.westcoast.2026-09.pmtiles"), "v7");
  assert.equal(baseVersion({}, "relief base (final).pmtiles"), "relief-base-final-");
  assert.equal(baseVersion({}, ""), "0");
}

// A base with only one archive draws only that one; a base with a broken
// bbox or no files is ignored; a manifest with base and no coverages still
// draws the base.
{
  const style = freshStyle();
  const base = schema2Base();
  delete base.land;
  const r = applyBathyCoverages(style, { base }, ORIGIN);
  assert.deepEqual(r, { added: [], skipped: [], base: ["relief"] });
  assert.ok(style.layers.some((l) => l.id === coverageLayerId("color-relief", BASE_ID, "relief")));
  assert.ok(!style.layers.some((l) => l.id === coverageLayerId("land", BASE_ID, "land")));

  assert.equal(drawableBase({ base: { bbox: [1, 2, 3] as unknown as BathyBase["bbox"], relief: { file: "a.pmtiles" } } }), null);
  assert.equal(drawableBase({ base: { relief: { file: "" } } }), null);
  assert.equal(drawableBase({ base: "junk" as unknown as BathyBase }), null);
  assert.equal(drawableBase({}), null);
  const untouched = freshStyle();
  const s2 = freshStyle();
  assert.deepEqual(applyBathyCoverages(s2, { base: { relief: { file: "" } } }, ORIGIN), { added: [], skipped: [], base: [] });
  assert.deepEqual(s2, untouched, "a base with nothing to draw leaves the style alone");
  // No bbox is allowed: the source is simply unbounded.
  const s3 = freshStyle();
  const noBbox = schema2Base();
  delete noBbox.bbox;
  applyBathyCoverages(s3, { base: noBbox }, ORIGIN);
  assert.equal(s3.sources[coverageSourceId(BASE_ID, "relief")].bounds, undefined);
}

// Schema 1 fallback: an older manifest with per-coverage land and no base
// still draws the land clones, after the BC land fill as before.
{
  const style = freshStyle();
  const cov = fullCoverage("us-wa-graysharbor");
  const r = applyBathyCoverages(style, { coverages_schema: 1, coverages: [bc, cov] }, ORIGIN);
  assert.deepEqual(r.base, []);
  const ids = style.layers.map((l) => l.id);
  assert.equal(ids[ids.indexOf("land") + 1], coverageLayerId("land", "us-wa-graysharbor", "land"));
  assert.equal(ids.indexOf(coverageLayerId("land", BASE_ID, "land")), -1);
  assert.equal(ids[ids.indexOf("color-relief") + 1], coverageLayerId("color-relief", "us-wa-graysharbor", "relief"));
}

// Both at once (a manifest mid-migration): base first at each anchor, then
// the per-coverage clones, land included.
{
  const style = freshStyle();
  const base = schema2Base();
  const cov = fullCoverage("us-wa-graysharbor");
  applyBathyCoverages(style, { coverages_schema: 2, base, coverages: [bc, cov] }, ORIGIN);
  const ids = style.layers.map((l) => l.id);
  assert.equal(ids[ids.indexOf("land") + 1], coverageLayerId("land", BASE_ID, "land"));
  assert.equal(ids[ids.indexOf("land") + 2], coverageLayerId("land", "us-wa-graysharbor", "land"));
  assert.equal(ids[ids.indexOf("color-relief") + 1], coverageLayerId("color-relief", BASE_ID, "relief"));
  assert.equal(ids[ids.indexOf("color-relief") + 2], coverageLayerId("color-relief", "us-wa-graysharbor", "relief"));
}

console.log("bathy-coverages: all cases pass");
