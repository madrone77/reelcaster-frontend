// Folds the bathymetry manifest's `coverages` list into the relief style.
//
// The live manifest (bluecaster docs/bathymetry.md, "Multiple coverages in one
// manifest") describes one bake per entry: `bc` plus one entry per US
// footprint from Cape Flattery to San Diego. Every entry ships the same pair
// of contour archives (t1 simple, t3 HD) with source-layer `contours` and the
// fields `tier`, `system` ("ft" | "m"), `depth` (positive, in that system's
// unit, 0 = the coastline) and `depth_m`.
//
// Schema 1 manifests also ship `land` (vector, source layer `land`, the OSM
// land polygons clipped to the footprint) and `relief` (WebP raster, the
// colour relief + hillshade bake, z8 to z14) per coverage. Older manifests
// carry only the contour pair and still work.
//
// Schema 2 (`coverages_schema: 2`) adds a top-level `base` object: one
// coast-wide relief raster (`base.relief`, ETOPO, z0 to z9, land and BC's own
// waters baked transparent) and one coast-wide land archive (`base.land`, OSM
// polygons, layer `land`) from Baja to the top of BC. Per-coverage `land` is
// gone from schema 2 and the per-coverage relief rasters are feathered to
// transparent at their edges, so the 18 footprints stop reading as rectangles
// on a flat blue sea. A schema 1 manifest that still carries per-coverage
// `land` keeps drawing it.
//
// What this module does to a style built by buildReliefStyle:
//   - for a manifest with `base`: a bounded raster source `relief-base` and a
//     clone of the BC `color-relief` layer (`color-relief--base-relief`)
//     right after the BC raster, so it sits under every footprint relief
//     and under every contour. The relief style has no zone fills, so the
//     BC raster is the anchor (the admin map anchors on its last zone fill
//     for the same reason: BC must keep winning and Washington must not be
//     hidden). BC still wins because the base raster is transparent wherever
//     BC draws. Plus a bounded vector source `land-base` and a clone of the
//     BC `land` fill (`land--base-land`) right after it, before any
//     per-coverage land clone;
//   - one source per non-BC coverage and archive, served through this app's
//     own per-tile proxy (see tile-sets.ts; no pmtiles protocol on the
//     client), `bounds` from the coverage bbox so MapLibre never asks for a
//     tile outside the footprint;
//   - the BC contour layers cloned per coverage right after the originals so
//     draw order is unchanged: lines, ft depth labels, plus a coastline line
//     (the 0 ft contour draws the shore even when a coverage has no land
//     archive). t1 below TIER_SWITCH_ZOOM, t3 from there up;
//   - the BC `color-relief` raster layer cloned per coverage right after the
//     original (after the base relief when there is one), so the blue depth
//     shading sits under the contours and under everything BC draws over
//     its own relief;
//   - the BC `land` fill cloned per coverage right after the original (after
//     the base land when there is one), so the US shore gets the same opaque
//     LAND_COLOR mask as the BC coast; schema 2 has no per-coverage land, so
//     this only happens on a schema 1 manifest;
//   - the coverage's attribution on each of its sources. MapLibre's
//     attribution control shows identical strings once, so 18 NOAA coverages
//     read as one credit;
//   - the BC entry skipped: the style's own `contours` source already draws
//     that coast, and drawing it twice would double every BC line.
//
// The 2026-09c quality pass (bluecaster PR #434, schema 2 unchanged) adds:
//   - per-coverage `soundings` (layer `soundings`, BC soundings schema) and
//     `intertidal` (layer `intertidal_band`) archives, drawn through the
//     soundings and intertidal templates below, which carry the admin V17
//     style's paint. The relief style has no BC soundings or intertidal
//     layers of its own, so the templates live here;
//   - `base.places` (layer `places`, undersea feature and fishing-ground
//     names) drawn through the `places-undersea` template, riding with the
//     place-name tiers under the Labels toggle;
//   - `kind: "offshore"` coverages (the deep `us-off-*` tiles) with a relief
//     raster whose entry says `minzoom: 8, maxzoom: 12`. Every source reads
//     its zoom range from its own manifest entry and falls back to the bake's
//     known range only when the entry is silent. No raster layer has a zoom
//     gate, so MapLibre overzooms each raster past its source maxzoom
//     instead of going blank. Offshore coverages are walked first, so a
//     nearshore footprint always draws over an offshore one;
//   - US contour paint by depth (the admin rules): colour and opacity follow
//     depth so deep structure reads on dark water, and every fifth t3 level
//     (rounded to chart numbers) is an index contour, wider and labelled in
//     feet from z12. The BC contour layers keep their own paint.
//
// A manifest with no `coverages` leaves the style untouched, so an older
// manifest renders exactly what shipped before.
//
// Pure and free of server-only imports: the tile proxy route resolves set ids
// with it and the client style builders apply it.

import { CDN, tileUrlTemplate, type TileSetDef } from "./tile-sets";

export type Bbox = [number, number, number, number];

export interface CoveragePmtiles {
  file: string;
  label?: string;
  source_layer?: string | null;
  /** The archive's zoom range when the manifest states it (offshore relief says 8 to 12). */
  minzoom?: number;
  maxzoom?: number;
}

export interface BathyCoverage {
  id: string;
  label?: string;
  country?: string;
  bbox: Bbox;
  version?: string;
  attribution?: string;
  license_notice?: string;
  units_available?: string[];
  /** `"nearshore"` (the shelf tiles) or `"offshore"` (`us-off-*`). Missing means nearshore. */
  kind?: string;
  pmtiles: {
    t1?: CoveragePmtiles;
    t3?: CoveragePmtiles;
    land?: CoveragePmtiles;
    relief?: CoveragePmtiles;
    /** Sounding points, layer `soundings`, the BC soundings schema (2026-09c). */
    soundings?: CoveragePmtiles;
    /** Intertidal band polygons, layer `intertidal_band` (2026-09c). */
    intertidal?: CoveragePmtiles;
  };
  [key: string]: unknown;
}

/** An entry of the top-level `base` object: the file plus its zoom range. */
export type BaseRasterPmtiles = CoveragePmtiles;

/**
 * Schema 2's top-level `base`: the coast-wide relief raster and land
 * polygons that draw under and beside every coverage (bluecaster
 * docs/bathymetry.md, "Coast-wide base relief and land").
 */
export interface BathyBase {
  relief?: BaseRasterPmtiles;
  land?: BaseRasterPmtiles;
  /** Undersea feature and fishing-ground names, layer `places` (`name`, `kind`, `minzoom`). */
  places?: BaseRasterPmtiles;
  bbox?: Bbox;
  attribution?: string;
  /** Not in the manifest today; the bake date in the file name stands in for it. */
  version?: string;
  [key: string]: unknown;
}

export interface BathyManifestLike {
  version?: string;
  coverages_schema?: number;
  coverages?: BathyCoverage[];
  base?: BathyBase;
  [key: string]: unknown;
}

// Loose shape of the bits of a MapLibre style this module touches. The real
// StyleSpecification is far stricter than we need here.
export interface StyleLayerLike {
  id: string;
  type: string;
  source?: string;
  "source-layer"?: string;
  minzoom?: number;
  maxzoom?: number;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StyleSourceLike {
  type: string;
  tiles?: string[];
  url?: string;
  bounds?: Bbox;
  minzoom?: number;
  maxzoom?: number;
  tileSize?: number;
  attribution?: string;
  [key: string]: unknown;
}

export interface StyleLike {
  sources: Record<string, StyleSourceLike>;
  layers: StyleLayerLike[];
  [key: string]: unknown;
}

/** Where the manifest lives: same public bucket as the archives. */
export const BATHY_MANIFEST_URL = `${CDN}/manifest.json`;

/** The relief style's BC contour source and layers (relief-style.ts). */
export const BC_CONTOURS_SOURCE = "contours";
export const BC_CONTOUR_LINE = "contour-line";
export const BC_CONTOUR_LABELS = "contour-labels";
/** The relief style's BC depth-shading raster and land mask (relief-style.ts). */
export const BC_RELIEF_SOURCE = "relief";
export const BC_RELIEF_LAYER = "color-relief";
export const BC_LAND_SOURCE = "land";
export const BC_LAND_LAYER = "land";
/** The relief style's first place-name tier; soundings and undersea names go right under it. */
export const BC_PLACES_ANCHOR = "places-t0";

/** The manifest id every consumer treats as "the BC bake". */
export const BC_COVERAGE_ID = "bc";

export type ContourTier = "t1" | "t3";
/** Every archive a coverage can ship: the contour pair, land, relief, soundings, intertidal band. */
export type CoverageArchive = ContourTier | "land" | "relief" | "soundings" | "intertidal";

const ARCHIVES: readonly CoverageArchive[] = ["t1", "t3", "land", "relief", "soundings", "intertidal"];

/** Below this zoom a coverage draws its t1 (simple) archive, from here up t3 (HD). */
export const TIER_SWITCH_ZOOM = 11;

/**
 * Index contour steps in feet, the admin rule: a depth up to `max` is an
 * index line when it is a multiple of `step`; past the last row, every
 * 1000 ft. With the t3 levels this is about every fifth line, rounded to
 * chart numbers.
 */
export const INDEX_STEPS_FT: ReadonlyArray<{ max: number; step: number }> = [
  { max: 150, step: 15 },
  { max: 300, step: 50 },
  { max: 1000, step: 100 },
  { max: 2000, step: 250 },
  { max: 3000, step: 500 },
];
export const INDEX_STEP_FT_BEYOND = 1000;

/** True when a ft depth is an index contour (plain-number mirror of the style expression). */
export function isIndexDepthFt(depth: number): boolean {
  if (!Number.isFinite(depth) || depth === 0) return false;
  for (const { max, step } of INDEX_STEPS_FT) {
    if (depth <= max) return depth % step === 0;
  }
  return depth % INDEX_STEP_FT_BEYOND === 0;
}

const CLONE_SEP = "--";
const SET_PREFIX = "cov-";
const BASE_SET_PREFIX = "base-";

/** The pseudo coverage id the base relief and land hang off (`relief-base`, `color-relief--base-relief`). */
export const BASE_ID = "base";
/** The base archives the style draws. */
export type BaseArchive = "relief" | "land" | "places";
const BASE_ARCHIVES: readonly BaseArchive[] = ["relief", "land", "places"];
/** Zoom range of the base relief when the manifest entry does not say (ETOPO at 305 m, native z9). */
export const BASE_RELIEF_MINZOOM = 0;
export const BASE_RELIEF_MAXZOOM = 9;
/** Zoom range of the base land when the manifest entry does not say. */
export const BASE_LAND_MINZOOM = 0;
export const BASE_LAND_MAXZOOM = 14;
/** Zoom range of the base places when the manifest entry does not say (the archive header's z6 to z14). */
export const BASE_PLACES_MINZOOM = 6;
export const BASE_PLACES_MAXZOOM = 14;

/**
 * The known zoom range of each coverage archive kind, used only when the
 * manifest entry does not state one: relief z8 to z14 (the nearshore bake),
 * land z4 to z14, soundings and intertidal z8 to z14, contours z6 to z14.
 */
export const COVERAGE_ZOOM_FALLBACK: Readonly<Record<CoverageArchive, { minzoom: number; maxzoom: number }>> = {
  t1: { minzoom: 6, maxzoom: 14 },
  t3: { minzoom: 6, maxzoom: 14 },
  land: { minzoom: 4, maxzoom: 14 },
  relief: { minzoom: 8, maxzoom: 14 },
  soundings: { minzoom: 8, maxzoom: 14 },
  intertidal: { minzoom: 8, maxzoom: 14 },
};

/** Tile-proxy set id for one coverage archive. Embeds the bake version so the
 *  immutable tile cache can never serve a stale bake (see tile-sets.ts). */
export function coverageSetId(coverage: Pick<BathyCoverage, "id" | "version">, archive: CoverageArchive): string {
  return `${SET_PREFIX}${coverage.id}-${archive}-${coverage.version ?? "0"}`;
}

/**
 * The bake version of a base archive, for its set id. The manifest's `base`
 * carries no `version`, so the bake date in the file name stands in
 * (`relief-base.westcoast.2026-09.pmtiles` is `2026-09`); a file with no
 * such token uses its whole stem, so a renamed bake still gets a fresh id.
 */
export function baseVersion(base: Pick<BathyBase, "version"> | undefined, file: string): string {
  if (typeof base?.version === "string" && base.version) return base.version;
  const dated = /\.(\d{4}-\d{2}[a-z]?)\.pmtiles$/i.exec(file);
  if (dated) return dated[1];
  return file.replace(/\.pmtiles$/i, "").replace(/[^A-Za-z0-9_-]+/g, "-") || "0";
}

/** Tile-proxy set id for one base archive: `base-relief-2026-09`, `base-land-2026-09`. */
export function baseSetId(base: BathyBase, archive: BaseArchive): string {
  return `${BASE_SET_PREFIX}${archive}-${baseVersion(base, base[archive]?.file ?? "")}`;
}

/** True for a per-coverage set id and for a base set id: both resolve against the manifest. */
export function isCoverageSetId(setId: string): boolean {
  return setId.startsWith(SET_PREFIX) || setId.startsWith(BASE_SET_PREFIX);
}

/**
 * Style source id per archive: `contours-<id>-t3`, `land-<id>`, `relief-<id>`,
 * `soundings-<id>`, `intertidal-<id>`, and `places-base` for the base names.
 */
export function coverageSourceId(coverageId: string, archive: CoverageArchive | "places"): string {
  if (archive === "land") return `${BC_LAND_SOURCE}-${coverageId}`;
  if (archive === "relief") return `${BC_RELIEF_SOURCE}-${coverageId}`;
  if (archive === "soundings" || archive === "intertidal" || archive === "places") return `${archive}-${coverageId}`;
  return `${BC_CONTOURS_SOURCE}-${coverageId}-${archive}`;
}

/** Clone layer id: `<base>--<coverage>-<archive>`, e.g. `land--us-ca-monterey-land`. */
export function coverageLayerId(baseId: string, coverageId: string, archive: CoverageArchive | "places"): string {
  return `${baseId}${CLONE_SEP}${coverageId}-${archive}`;
}

/** The coastline clone has no BC original; it hangs off the line layer's id. */
export const COAST_BASE_ID = "contour-coast";

/**
 * True for a BC contour layer and for every per-coverage clone of it, so a
 * caller that toggles `contour-line` can reach the whole family with one test.
 */
export function isBathyContourLayer(layerId: string): boolean {
  for (const base of [BC_CONTOUR_LINE, BC_CONTOUR_LABELS, COAST_BASE_ID]) {
    if (layerId === base || layerId.startsWith(base + CLONE_SEP)) return true;
  }
  return false;
}

/** True for the BC depth-shading raster and for every per-coverage clone of it. */
export function isBathyReliefLayer(layerId: string): boolean {
  return layerId === BC_RELIEF_LAYER || layerId.startsWith(BC_RELIEF_LAYER + CLONE_SEP);
}

/** The soundings templates (dots and depth labels); a coverage with `soundings` gets one of each. */
export const SOUNDINGS_LAYER_IDS = [
  "soundings-structures",
  "soundings-peaks",
  "soundings-structures-labels",
  "soundings-peaks-labels",
] as const;
/** The intertidal band template; a coverage with `intertidal` gets one, above every relief raster. */
export const INTERTIDAL_LAYER_ID = "intertidal-band";
/** The undersea names template; `base.places` is drawn through it. */
export const PLACES_UNDERSEA_LAYER_ID = "places-undersea";

/** True for every per-coverage soundings layer. */
export function isBathySoundingsLayer(layerId: string): boolean {
  return SOUNDINGS_LAYER_IDS.some((base) => layerId.startsWith(base + CLONE_SEP));
}

/** True for every per-coverage intertidal band layer. */
export function isBathyIntertidalLayer(layerId: string): boolean {
  return layerId.startsWith(INTERTIDAL_LAYER_ID + CLONE_SEP);
}

/** True for the undersea place names drawn from `base.places`. The Labels toggle reaches them. */
export function isBathyPlacesLayer(layerId: string): boolean {
  return layerId.startsWith(PLACES_UNDERSEA_LAYER_ID + CLONE_SEP);
}

/** True for the BC land mask and for every per-coverage clone of it. */
export function isBathyLandLayer(layerId: string): boolean {
  return layerId === BC_LAND_LAYER || layerId.startsWith(BC_LAND_LAYER + CLONE_SEP);
}

/**
 * What the Bathymetry toggle flips: the depth shading, the contour family,
 * the soundings and the intertidal band, BC originals and US clones alike.
 * Land is not bathymetry and stays put; undersea names ride with Labels.
 */
export function isBathymetryLayer(layerId: string): boolean {
  return (
    isBathyReliefLayer(layerId) ||
    isBathyContourLayer(layerId) ||
    isBathySoundingsLayer(layerId) ||
    isBathyIntertidalLayer(layerId)
  );
}

function isBbox(v: unknown): v is Bbox {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

function isFiniteBboxOrder(b: Bbox): boolean {
  return b[0] < b[2] && b[1] < b[3];
}

/** Coverages the style can draw: well formed, not the BC bake, with at least one archive. */
export function drawableCoverages(manifest: BathyManifestLike | null | undefined): BathyCoverage[] {
  const list = Array.isArray(manifest?.coverages) ? manifest!.coverages : [];
  const out: BathyCoverage[] = [];
  for (const cov of list) {
    if (!cov || typeof cov.id !== "string" || !cov.id || cov.id === BC_COVERAGE_ID) continue;
    if (!isBbox(cov.bbox) || !isFiniteBboxOrder(cov.bbox) || !cov.pmtiles) continue;
    if (archivesOf(cov).length === 0) continue;
    out.push(cov);
  }
  return out;
}

function hasFile(cov: BathyCoverage, archive: CoverageArchive): boolean {
  return isFileEntry(cov.pmtiles?.[archive]);
}

function isFileEntry(p: CoveragePmtiles | undefined): p is CoveragePmtiles {
  return !!p && typeof p.file === "string" && p.file.length > 0;
}

/** The manifest's `base` when it is well formed and ships at least one archive, else null. */
export function drawableBase(manifest: BathyManifestLike | null | undefined): BathyBase | null {
  const base = manifest?.base;
  if (!base || typeof base !== "object") return null;
  if (base.bbox !== undefined && (!isBbox(base.bbox) || !isFiniteBboxOrder(base.bbox))) return null;
  return baseArchivesOf(base).length > 0 ? base : null;
}

/** Every base archive the manifest ships, relief first. */
export function baseArchivesOf(base: BathyBase | null | undefined): BaseArchive[] {
  if (!base) return [];
  return BASE_ARCHIVES.filter((a) => isFileEntry(base[a]));
}

function zoomOf(entry: CoveragePmtiles | undefined, key: "minzoom" | "maxzoom", fallback: number): number {
  const v = entry?.[key];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function rangeOf(entry: CoveragePmtiles | undefined, fallback: { minzoom: number; maxzoom: number }): { minzoom: number; maxzoom: number } {
  const minzoom = zoomOf(entry, "minzoom", fallback.minzoom);
  const maxzoom = zoomOf(entry, "maxzoom", fallback.maxzoom);
  // A range that reads backwards is a typo in the manifest: use the known one.
  return minzoom <= maxzoom ? { minzoom, maxzoom } : { ...fallback };
}

/** The zoom range of a base archive: the entry's own, else the bake's known range. */
export function baseZoomRange(base: BathyBase, archive: BaseArchive): { minzoom: number; maxzoom: number } {
  const entry = base[archive];
  if (archive === "relief") return rangeOf(entry, { minzoom: BASE_RELIEF_MINZOOM, maxzoom: BASE_RELIEF_MAXZOOM });
  if (archive === "places") return rangeOf(entry, { minzoom: BASE_PLACES_MINZOOM, maxzoom: BASE_PLACES_MAXZOOM });
  return rangeOf(entry, { minzoom: BASE_LAND_MINZOOM, maxzoom: BASE_LAND_MAXZOOM });
}

/** The zoom range of a coverage archive: the entry's own, else COVERAGE_ZOOM_FALLBACK. */
export function coverageZoomRange(cov: BathyCoverage, archive: CoverageArchive): { minzoom: number; maxzoom: number } {
  return rangeOf(cov.pmtiles?.[archive], COVERAGE_ZOOM_FALLBACK[archive]);
}

export function tiersOf(cov: BathyCoverage): ContourTier[] {
  return (["t1", "t3"] as const).filter((t) => hasFile(cov, t));
}

/** Every archive the coverage ships, in ARCHIVES order. */
export function archivesOf(cov: BathyCoverage): CoverageArchive[] {
  return ARCHIVES.filter((a) => hasFile(cov, a));
}

/** How the proxy serves each archive kind; same as the BC sets in tile-sets.ts. */
function archiveDef(archive: CoverageArchive | BaseArchive, url: string, range: { minzoom: number; maxzoom: number }): TileSetDef {
  if (archive === "relief") {
    // WebP raster, already dense: no re-gzip.
    return { url, contentType: "image/webp", gzip: false, ...range };
  }
  // Every other archive is MVT: contours, land, soundings, intertidal, places.
  return { url, contentType: "application/x-protobuf", gzip: true, ...range };
}

/**
 * Resolve a proxy set id (`cov-<coverage>-<archive>-<version>` or
 * `base-<archive>-<version>`) against the manifest. Null when the manifest
 * has no such archive, which the proxy turns into a 400 like any other
 * unknown set.
 */
export function coverageTileSet(manifest: BathyManifestLike | null | undefined, setId: string): TileSetDef | null {
  if (!isCoverageSetId(setId)) return null;
  const base = drawableBase(manifest);
  if (base) {
    for (const archive of baseArchivesOf(base)) {
      if (baseSetId(base, archive) !== setId) continue;
      return archiveDef(archive, `${CDN}/${base[archive]!.file}`, baseZoomRange(base, archive));
    }
  }
  for (const cov of drawableCoverages(manifest)) {
    for (const archive of archivesOf(cov)) {
      if (coverageSetId(cov, archive) !== setId) continue;
      return archiveDef(archive, `${CDN}/${cov.pmtiles[archive]!.file}`, coverageZoomRange(cov, archive));
    }
  }
  return null;
}

function zoomRangeFor(base: StyleLayerLike, tier: ContourTier, tiers: ContourTier[]): { minzoom?: number; maxzoom?: number } | null {
  const range: { minzoom?: number; maxzoom?: number } = {};
  if (base.minzoom !== undefined) range.minzoom = base.minzoom;
  if (base.maxzoom !== undefined) range.maxzoom = base.maxzoom;
  if (tiers.length === 2) {
    if (tier === "t1") range.maxzoom = Math.min(range.maxzoom ?? Infinity, TIER_SWITCH_ZOOM);
    else range.minzoom = Math.max(range.minzoom ?? 0, TIER_SWITCH_ZOOM);
  }
  // A layer whose own minzoom sits above the switch (the z12 depth labels)
  // has nothing to draw from the t1 archive.
  if (range.minzoom !== undefined && range.maxzoom !== undefined && range.minzoom >= range.maxzoom) return null;
  if (range.maxzoom === Infinity) delete range.maxzoom;
  return range;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ── US contour paint (the admin V17 rules, bluecaster PR #434) ─────────────
//
// Every US clone draws ft-system lines only, so depth in metres is the ft
// depth times 0.3048. Written as plain style expressions so the relief style
// JSON stays serialisable.

const DEPTH_FT = ["to-number", ["get", "depth"]];
const DEPTH_M = ["*", DEPTH_FT, 0.3048];

/** Style expression: true on an index contour (see INDEX_STEPS_FT). */
export function indexContourExpr(): unknown[] {
  const expr: unknown[] = ["case"];
  for (const { max, step } of INDEX_STEPS_FT) {
    expr.push(["<=", DEPTH_FT, max], ["==", ["%", DEPTH_FT, step], 0]);
  }
  expr.push(["==", ["%", DEPTH_FT, INDEX_STEP_FT_BEYOND], 0]);
  return expr;
}

/** Line colour by depth: mid blue shallow, a darker blue to 40 m, pale blue at 90 m, pale and see-through past 200 m. */
export const US_CONTOUR_COLOR_STOPS: ReadonlyArray<[number, string]> = [
  [0, "#5C92B4"],
  [40, "#3D78A9"],
  [90, "#9DC9E6"],
  [200, "rgba(226,242,255,0.72)"],
];

/** The paint every US contour line clone gets. BC's own `contour-line` keeps its paint. */
export function usContourLinePaint(): Record<string, unknown> {
  const idx = indexContourExpr();
  const byDepth = (...stops: number[]) => ["interpolate", ["linear"], DEPTH_M, ...stops];
  return {
    "line-color": ["interpolate", ["linear"], DEPTH_M, ...US_CONTOUR_COLOR_STOPS.flat()],
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.3, 11, 0.5, 12, ["case", idx, 1.1, 0.5], 14, ["case", idx, 1.8, 0.8]],
    "line-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      byDepth(0, 1, 120, 0.9, 200, 0.6, 500, 0.45),
      11,
      ["case", idx, 1, byDepth(0, 1, 120, 0.85, 200, 0.45, 400, 0.3)],
      13,
      ["case", idx, 1, byDepth(0, 1, 120, 0.85, 200, 0.45, 400, 0.3)],
      14,
      ["case", idx, 1, byDepth(0, 1, 200, 0.7, 400, 0.5)],
    ],
  };
}

// ── Soundings, intertidal band and undersea names (admin V17 paint) ─────────
//
// The relief style has no BC layers for these, so the templates are built
// here. The one change from the admin paint is the font: this app ships only
// Open Sans Semibold, and any other stack is a 404 per glyph range.

const FONT = ["Open Sans Semibold"];
const PEAK_FILTER = ["all", ["==", ["get", "kind"], "peak"], [">=", ["get", "prominence_m"], 5], ["<=", ["get", "depth_m"], 100]];
const STRUCTURE_FILTER = ["==", ["get", "kind"], "structure"];

function soundingsTemplates(): StyleLayerLike[] {
  return [
    {
      id: "soundings-structures",
      type: "circle",
      filter: STRUCTURE_FILTER,
      minzoom: 12,
      paint: { "circle-radius": 3, "circle-color": "#1F4A6B", "circle-stroke-width": 1.5, "circle-stroke-color": "#FFFFFF" },
    },
    {
      id: "soundings-peaks",
      type: "circle",
      filter: PEAK_FILTER,
      minzoom: 13,
      paint: { "circle-radius": 1.5, "circle-color": "#5A6878", "circle-stroke-width": 1, "circle-stroke-color": "#FFFFFF" },
    },
    {
      id: "soundings-structures-labels",
      type: "symbol",
      filter: STRUCTURE_FILTER,
      minzoom: 12,
      layout: {
        "text-field": ["concat", ["to-string", ["get", "depth_ft"]], " ft"],
        "text-size": 11,
        "text-anchor": "left",
        "text-offset": [0.6, 0],
        "text-font": FONT,
      },
      paint: { "text-color": "#1F4A6B", "text-halo-color": "#FFFFFF", "text-halo-width": 2 },
    },
    {
      id: "soundings-peaks-labels",
      type: "symbol",
      filter: PEAK_FILTER,
      minzoom: 14,
      layout: {
        "text-field": ["to-string", ["get", "depth_ft"]],
        "text-size": 9,
        "text-anchor": "left",
        "text-offset": [0.4, 0],
        "text-font": FONT,
      },
      paint: { "text-color": "#5A6878", "text-halo-color": "#FFFFFF", "text-halo-width": 1 },
    },
  ];
}

function intertidalTemplate(): StyleLayerLike {
  return {
    id: INTERTIDAL_LAYER_ID,
    type: "fill",
    minzoom: 8,
    paint: { "fill-color": "#DFECBD", "fill-antialias": false },
  };
}

/** The undersea kinds the admin style names (bank, canyon, seamount, ... and the anglers' grounds). */
export const UNDERSEA_KINDS = [
  "bank",
  "canyon",
  "seamount",
  "ridge",
  "knoll",
  "shoal",
  "trench",
  "reef",
  "basin",
  "escarpment",
  "trough",
  "fan",
  "valley",
  "terrace",
  "ground",
  "spot",
];

function placesUnderseaTemplate(): StyleLayerLike {
  return {
    id: PLACES_UNDERSEA_LAYER_ID,
    type: "symbol",
    filter: ["in", ["get", "kind"], ["literal", UNDERSEA_KINDS]],
    minzoom: 7,
    layout: {
      "symbol-sort-key": 35,
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 10, 12, 13, 15],
      "text-font": FONT,
      "text-letter-spacing": 0.03,
      "text-max-width": 8,
      "text-padding": 6,
      // Hang below the point. A score puck stands above its point (icon
      // anchor bottom) and ignores placement, so a name on the same spot as a
      // puck (Cortes Bank, the 43 Fathom Spot) would otherwise print across
      // it. See the puck layer in explore-map.tsx.
      "text-anchor": "top",
      "text-offset": [0, 0.5],
    },
    paint: { "text-color": "#4F6478", "text-halo-color": "#FFFFFF", "text-halo-width": 2 },
  };
}

/**
 * The three contour clone templates for one coverage, derived from the
 * style's BC layers so the label font and halo stay identical; the line
 * paint is the US depth paint above. The BC bake carries `elev` in metres;
 * the coverages carry `system` + `depth`, so the ft-system lines are the ones
 * drawn and labelled, matching the ft labels BC shows.
 */
function templatesFor(line: StyleLayerLike, labels: StyleLayerLike | undefined): StyleLayerLike[] {
  const out: StyleLayerLike[] = [];
  const lineT = clone(line);
  lineT.filter = ["all", ["==", ["get", "system"], "ft"], ["!=", ["get", "depth"], 0]];
  lineT.paint = usContourLinePaint();
  out.push(lineT);

  if (labels) {
    // Index contours only, so a label always sits on a wider line.
    const labelsT = clone(labels);
    labelsT.filter = ["all", ["==", ["get", "system"], "ft"], ["!=", DEPTH_FT, 0], indexContourExpr()];
    labelsT.layout = { ...labelsT.layout, "text-field": ["concat", ["to-string", ["get", "depth"]], " ft"] };
    out.push(labelsT);
  }

  // Coastline: the 0 ft contour, a touch heavier than a depth line. There is
  // no land fill outside the BC bake, so without this the shore is invisible.
  const coastT = clone(line);
  coastT.id = COAST_BASE_ID;
  coastT.filter = ["all", ["==", ["get", "system"], "ft"], ["==", ["get", "depth"], 0]];
  coastT.paint = {
    ...coastT.paint,
    "line-color": "rgba(20,44,74,0.9)",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 14, 1.4],
  };
  out.push(coastT);
  return out;
}

export interface ApplyResult {
  /** Coverage ids that got sources and layers. */
  added: string[];
  /** Coverage ids skipped because they were the BC bake or malformed. */
  skipped: string[];
  /** Which of the manifest's `base` archives were drawn (`relief`, `land`, `places`). */
  base: BaseArchive[];
}

/**
 * Add sources and layer clones for the manifest: the schema 2 base relief,
 * land and places first, then per coverage (offshore first) the contour
 * family, the relief raster, the intertidal band, the soundings and the land
 * fill. `origin` is the absolute origin the tile-proxy URLs are built on
 * (MapLibre resolves vector-tile URLs in a worker, so root-relative fails
 * silently; same rule as buildReliefStyle's callers). Mutates `style` in
 * place and returns a result; a manifest with neither `coverages` nor `base`
 * leaves the style untouched.
 *
 * Draw order, bottom to top: color-relief, base relief, offshore reliefs,
 * nearshore reliefs, intertidal bands, contour-line and its clones, labels,
 * ..., land and its clones, ..., soundings, undersea names, places-t0.
 */
export function applyBathyCoverages(style: StyleLike, manifest: BathyManifestLike | null | undefined, origin: string): ApplyResult {
  const result: ApplyResult = { added: [], skipped: [], base: [] };
  const all = Array.isArray(manifest?.coverages) ? manifest!.coverages : [];
  const base = drawableBase(manifest);
  if (all.length === 0 && !base) return result;

  const line = style.layers.find((l) => l.id === BC_CONTOUR_LINE);
  const labels = style.layers.find((l) => l.id === BC_CONTOUR_LABELS);
  const templates = line ? templatesFor(line, labels) : [];
  const reliefBase = style.layers.find((l) => l.id === BC_RELIEF_LAYER && l.type === "raster");
  const landBase = style.layers.find((l) => l.id === BC_LAND_LAYER && l.type === "fill");
  const hasPlacesAnchor = style.layers.some((l) => l.id === BC_PLACES_ANCHOR);

  // Offshore first, stable otherwise: where an offshore bbox meets a
  // nearshore one, the finer nearshore survey draws on top.
  const isOffshore = (c: BathyCoverage) => c.kind === "offshore";
  const found = line ? drawableCoverages(manifest) : [];
  const drawable = [...found.filter(isOffshore), ...found.filter((c) => !isOffshore(c))];
  const drawableIds = new Set(drawable.map((c) => c.id));
  for (const cov of all) {
    if (cov && typeof cov.id === "string" && !drawableIds.has(cov.id)) result.skipped.push(cov.id);
  }

  // Clones keyed by the BC layer they follow in draw order (or, for the
  // soundings and names, the place tier they go right under). The coastline
  // rides right after the line clones.
  const after = new Map<string, StyleLayerLike[]>();
  const push = (baseId: string, layer: StyleLayerLike) => {
    const list = after.get(baseId) ?? [];
    list.push(layer);
    after.set(baseId, list);
  };
  // Intertidal bands sit above every relief raster (a relief would otherwise
  // paint over a drying flat), so they are held back and pushed after the
  // last relief clone. Soundings and undersea names go right under the first
  // place tier: above land, below the town names, which win a collision.
  const intertidal: StyleLayerLike[] = [];
  const soundings: StyleLayerLike[] = [];
  const names: StyleLayerLike[] = [];

  // The base goes first at each anchor so every footprint draws over it:
  // relief right after the BC raster, land right after the BC land mask.
  if (base) {
    const attribution = typeof base.attribution === "string" ? base.attribution.trim() : "";
    const bounds = isBbox(base.bbox) ? ([...base.bbox] as Bbox) : undefined;
    const sourceFor = (archive: BaseArchive, extra: Partial<StyleSourceLike>): StyleSourceLike => {
      const source: StyleSourceLike = {
        type: archive === "relief" ? "raster" : "vector",
        tiles: [tileUrlTemplate(origin, baseSetId(base, archive))],
        ...baseZoomRange(base, archive),
        ...extra,
      };
      if (bounds) source.bounds = [...bounds] as Bbox;
      if (attribution) source.attribution = attribution;
      return source;
    };
    const archives = baseArchivesOf(base);
    if (reliefBase && archives.includes("relief")) {
      const sourceId = coverageSourceId(BASE_ID, "relief");
      // Source maxzoom from the entry (9) and no layer zoom gate: MapLibre
      // overzooms the base under the HD rasters at every zoom.
      style.sources[sourceId] = sourceFor("relief", { tileSize: 256 });
      const layer = clone(reliefBase);
      layer.id = coverageLayerId(BC_RELIEF_LAYER, BASE_ID, "relief");
      layer.source = sourceId;
      delete layer.minzoom;
      delete layer.maxzoom;
      layer.metadata = { ...layer.metadata, "bathy:coverage": BASE_ID, "bathy:archive": "relief" };
      push(BC_RELIEF_LAYER, layer);
      result.base.push("relief");
    }
    if (landBase && archives.includes("land")) {
      const sourceId = coverageSourceId(BASE_ID, "land");
      style.sources[sourceId] = sourceFor("land", {});
      const layer = clone(landBase);
      layer.id = coverageLayerId(BC_LAND_LAYER, BASE_ID, "land");
      layer.source = sourceId;
      layer["source-layer"] = base.land?.source_layer || "land";
      layer.metadata = { ...layer.metadata, "bathy:coverage": BASE_ID, "bathy:archive": "land" };
      push(BC_LAND_LAYER, layer);
      result.base.push("land");
    }
    if (hasPlacesAnchor && archives.includes("places")) {
      const sourceId = coverageSourceId(BASE_ID, "places");
      style.sources[sourceId] = sourceFor("places", {});
      const layer = placesUnderseaTemplate();
      layer.id = coverageLayerId(PLACES_UNDERSEA_LAYER_ID, BASE_ID, "places");
      layer.source = sourceId;
      layer["source-layer"] = base.places?.source_layer || "places";
      layer.metadata = { "bathy:coverage": BASE_ID, "bathy:archive": "places" };
      names.push(layer);
      result.base.push("places");
    }
  }

  for (const cov of drawable) {
    const tiers = tiersOf(cov);
    const attribution = typeof cov.attribution === "string" ? cov.attribution.trim() : "";
    const sourceFor = (archive: CoverageArchive, extra: Partial<StyleSourceLike>): StyleSourceLike => {
      const source: StyleSourceLike = {
        type: archive === "relief" ? "raster" : "vector",
        tiles: [tileUrlTemplate(origin, coverageSetId(cov, archive))],
        bounds: [...cov.bbox] as Bbox,
        ...extra,
      };
      if (attribution) source.attribution = attribution;
      return source;
    };

    // Depth shading: a raster clone of color-relief, same paint, bounded to
    // the footprint, source zoom range from the entry (offshore stops at 12)
    // and no layer zoom gate, so MapLibre overzooms it rather than blanking.
    if (reliefBase && hasFile(cov, "relief")) {
      const sourceId = coverageSourceId(cov.id, "relief");
      style.sources[sourceId] = sourceFor("relief", { tileSize: 256, ...coverageZoomRange(cov, "relief") });
      const layer = clone(reliefBase);
      layer.id = coverageLayerId(BC_RELIEF_LAYER, cov.id, "relief");
      layer.source = sourceId;
      delete layer.minzoom;
      delete layer.maxzoom;
      layer.metadata = { ...layer.metadata, "bathy:coverage": cov.id, "bathy:archive": "relief" };
      push(BC_RELIEF_LAYER, layer);
    }

    // Drying flats: the pale band from 0 m MLLW to MHHW, above every relief.
    if (reliefBase && hasFile(cov, "intertidal")) {
      const sourceId = coverageSourceId(cov.id, "intertidal");
      style.sources[sourceId] = sourceFor("intertidal", coverageZoomRange(cov, "intertidal"));
      const layer = intertidalTemplate();
      layer.id = coverageLayerId(INTERTIDAL_LAYER_ID, cov.id, "intertidal");
      layer.source = sourceId;
      layer["source-layer"] = cov.pmtiles.intertidal?.source_layer || "intertidal_band";
      layer.metadata = { "bathy:coverage": cov.id, "bathy:archive": "intertidal" };
      intertidal.push(layer);
    }

    // Soundings: structure and peak dots plus their ft depth labels.
    if (hasPlacesAnchor && hasFile(cov, "soundings")) {
      const sourceId = coverageSourceId(cov.id, "soundings");
      style.sources[sourceId] = sourceFor("soundings", coverageZoomRange(cov, "soundings"));
      for (const t of soundingsTemplates()) {
        t.id = coverageLayerId(t.id, cov.id, "soundings");
        t.source = sourceId;
        t["source-layer"] = cov.pmtiles.soundings?.source_layer || "soundings";
        t.metadata = { "bathy:coverage": cov.id, "bathy:archive": "soundings" };
        soundings.push(t);
      }
    }

    // Shore: an opaque LAND_COLOR fill clone right after the BC land mask
    // (and after the base land). Schema 1 only: schema 2 drops the key and
    // the coast-wide base land draws the shore instead.
    if (landBase && hasFile(cov, "land")) {
      const sourceId = coverageSourceId(cov.id, "land");
      style.sources[sourceId] = sourceFor("land", coverageZoomRange(cov, "land"));
      const layer = clone(landBase);
      layer.id = coverageLayerId(BC_LAND_LAYER, cov.id, "land");
      layer.source = sourceId;
      layer["source-layer"] = cov.pmtiles.land?.source_layer || "land";
      layer.metadata = { ...layer.metadata, "bathy:coverage": cov.id, "bathy:archive": "land" };
      push(BC_LAND_LAYER, layer);
    }

    for (const tier of tiers) {
      // The style asks for contours from z9 (the lines start at z10).
      const range = coverageZoomRange(cov, tier);
      style.sources[coverageSourceId(cov.id, tier)] = sourceFor(tier, { minzoom: Math.max(9, range.minzoom), maxzoom: range.maxzoom });

      for (const t of templates) {
        const zooms = zoomRangeFor(t, tier, tiers);
        if (!zooms) continue;
        const layer = clone(t);
        layer.id = coverageLayerId(t.id, cov.id, tier);
        layer.source = coverageSourceId(cov.id, tier);
        layer["source-layer"] = cov.pmtiles[tier]?.source_layer || "contours";
        delete layer.minzoom;
        delete layer.maxzoom;
        Object.assign(layer, zooms);
        layer.metadata = { ...layer.metadata, "bathy:coverage": cov.id, "bathy:tier": tier };
        push(t.id === COAST_BASE_ID ? BC_CONTOUR_LINE : t.id, layer);
      }
    }
    result.added.push(cov.id);
  }

  if (result.added.length === 0 && result.base.length === 0) return result;
  for (const layer of intertidal) push(BC_RELIEF_LAYER, layer);

  const before = [...soundings, ...names];
  const layers: StyleLayerLike[] = [];
  for (const layer of style.layers) {
    if (layer.id === BC_PLACES_ANCHOR) layers.push(...before);
    layers.push(layer);
    const extra = after.get(layer.id);
    if (extra) layers.push(...extra);
  }
  style.layers = layers;
  return result;
}
