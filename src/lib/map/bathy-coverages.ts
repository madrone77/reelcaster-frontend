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
  pmtiles: { t1?: CoveragePmtiles; t3?: CoveragePmtiles; land?: CoveragePmtiles; relief?: CoveragePmtiles };
  [key: string]: unknown;
}

/** A raster entry of the top-level `base` object: the file plus its zoom range. */
export interface BaseRasterPmtiles extends CoveragePmtiles {
  minzoom?: number;
  maxzoom?: number;
}

/**
 * Schema 2's top-level `base`: the coast-wide relief raster and land
 * polygons that draw under and beside every coverage (bluecaster
 * docs/bathymetry.md, "Coast-wide base relief and land").
 */
export interface BathyBase {
  relief?: BaseRasterPmtiles;
  land?: BaseRasterPmtiles;
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

/** The manifest id every consumer treats as "the BC bake". */
export const BC_COVERAGE_ID = "bc";

export type ContourTier = "t1" | "t3";
/** Every archive a coverage can ship: the contour pair, the land mask, the relief raster. */
export type CoverageArchive = ContourTier | "land" | "relief";

const ARCHIVES: readonly CoverageArchive[] = ["t1", "t3", "land", "relief"];

/** Below this zoom a coverage draws its t1 (simple) archive, from here up t3 (HD). */
export const TIER_SWITCH_ZOOM = 11;

/** Round ft depths that get a label, same list the bluecaster chart uses. */
export const LABEL_DEPTHS_FT = [10, 20, 30, 50, 75, 100, 200, 400, 700];

const CLONE_SEP = "--";
const SET_PREFIX = "cov-";
const BASE_SET_PREFIX = "base-";

/** The pseudo coverage id the base relief and land hang off (`relief-base`, `color-relief--base-relief`). */
export const BASE_ID = "base";
/** The base archives the style draws. */
export type BaseArchive = "relief" | "land";
const BASE_ARCHIVES: readonly BaseArchive[] = ["relief", "land"];
/** Zoom range of the base relief when the manifest entry does not say (ETOPO at 305 m, native z9). */
export const BASE_RELIEF_MINZOOM = 0;
export const BASE_RELIEF_MAXZOOM = 9;
/** Zoom range of the base land when the manifest entry does not say. */
export const BASE_LAND_MINZOOM = 0;
export const BASE_LAND_MAXZOOM = 14;

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

/** Style source id per coverage archive: `contours-<id>-t3`, `land-<id>`, `relief-<id>`. */
export function coverageSourceId(coverageId: string, archive: CoverageArchive): string {
  if (archive === "land") return `${BC_LAND_SOURCE}-${coverageId}`;
  if (archive === "relief") return `${BC_RELIEF_SOURCE}-${coverageId}`;
  return `${BC_CONTOURS_SOURCE}-${coverageId}-${archive}`;
}

/** Clone layer id: `<base>--<coverage>-<archive>`, e.g. `land--us-ca-monterey-land`. */
export function coverageLayerId(baseId: string, coverageId: string, archive: CoverageArchive): string {
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

/** True for the BC land mask and for every per-coverage clone of it. */
export function isBathyLandLayer(layerId: string): boolean {
  return layerId === BC_LAND_LAYER || layerId.startsWith(BC_LAND_LAYER + CLONE_SEP);
}

/**
 * What the Bathymetry toggle flips: the depth shading and the contour family,
 * BC originals and US clones alike. Land is not bathymetry and stays put.
 */
export function isBathymetryLayer(layerId: string): boolean {
  return isBathyReliefLayer(layerId) || isBathyContourLayer(layerId);
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

function zoomOf(entry: BaseRasterPmtiles | undefined, key: "minzoom" | "maxzoom", fallback: number): number {
  const v = entry?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** The proxy zoom range of a base archive: the entry's own, else the bake's known range. */
export function baseZoomRange(base: BathyBase, archive: BaseArchive): { minzoom: number; maxzoom: number } {
  const entry = base[archive];
  if (archive === "relief") {
    return { minzoom: zoomOf(entry, "minzoom", BASE_RELIEF_MINZOOM), maxzoom: zoomOf(entry, "maxzoom", BASE_RELIEF_MAXZOOM) };
  }
  return { minzoom: zoomOf(entry, "minzoom", BASE_LAND_MINZOOM), maxzoom: zoomOf(entry, "maxzoom", BASE_LAND_MAXZOOM) };
}

export function tiersOf(cov: BathyCoverage): ContourTier[] {
  return (["t1", "t3"] as const).filter((t) => hasFile(cov, t));
}

/** Every archive the coverage ships, in ARCHIVES order. */
export function archivesOf(cov: BathyCoverage): CoverageArchive[] {
  return ARCHIVES.filter((a) => hasFile(cov, a));
}

/** How the proxy serves each archive kind; same as the BC sets in tile-sets.ts. */
function archiveDef(archive: CoverageArchive, url: string): TileSetDef {
  if (archive === "relief") {
    // WebP raster, already dense: no re-gzip. The bakes are z8 to z14.
    return { url, contentType: "image/webp", gzip: false, minzoom: 8, maxzoom: 14 };
  }
  if (archive === "land") {
    return { url, contentType: "application/x-protobuf", gzip: true, minzoom: 4, maxzoom: 14 };
  }
  // The contour bakes are z6 to z14; the style only asks from z9 anyway.
  return { url, contentType: "application/x-protobuf", gzip: true, minzoom: 6, maxzoom: 14 };
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
      const def = archiveDef(archive, `${CDN}/${base[archive]!.file}`);
      return { ...def, ...baseZoomRange(base, archive) };
    }
  }
  for (const cov of drawableCoverages(manifest)) {
    for (const archive of archivesOf(cov)) {
      if (coverageSetId(cov, archive) !== setId) continue;
      return archiveDef(archive, `${CDN}/${cov.pmtiles[archive]!.file}`);
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

/**
 * The three clone templates for one coverage, derived from the style's BC
 * layers so paint (colour, width, font, halo) stays identical and only the
 * source, the field names and the filters change. The BC bake carries `elev`
 * in metres; the coverages carry `system` + `depth`, so the ft-system lines
 * are the ones drawn and labelled, matching the ft labels BC shows.
 */
function templatesFor(line: StyleLayerLike, labels: StyleLayerLike | undefined): StyleLayerLike[] {
  const out: StyleLayerLike[] = [];
  const lineT = clone(line);
  lineT.filter = ["all", ["==", ["get", "system"], "ft"], ["!=", ["get", "depth"], 0]];
  out.push(lineT);

  if (labels) {
    const labelsT = clone(labels);
    labelsT.filter = ["all", ["==", ["get", "system"], "ft"], ["in", ["get", "depth"], ["literal", LABEL_DEPTHS_FT]]];
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
  /** Which of the manifest's `base` archives were drawn (`relief`, `land`). */
  base: BaseArchive[];
}

/**
 * Add sources and layer clones for the manifest: the schema 2 base relief and
 * land first, then per coverage the contour family, the relief raster and
 * the land fill, each riding right after its BC original. `origin` is the
 * absolute origin the tile-proxy URLs are built on (MapLibre resolves
 * vector-tile URLs in a worker, so root-relative fails silently; same rule as
 * buildReliefStyle's callers). Mutates `style` in place and returns a result;
 * a manifest with neither `coverages` nor `base` leaves the style untouched.
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

  const drawable = line ? drawableCoverages(manifest) : [];
  const drawableIds = new Set(drawable.map((c) => c.id));
  for (const cov of all) {
    if (cov && typeof cov.id === "string" && !drawableIds.has(cov.id)) result.skipped.push(cov.id);
  }

  // Clones keyed by the BC layer they follow in draw order. The coastline
  // rides right after the line clones.
  const after = new Map<string, StyleLayerLike[]>();
  const push = (baseId: string, layer: StyleLayerLike) => {
    const list = after.get(baseId) ?? [];
    list.push(layer);
    after.set(baseId, list);
  };

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
      style.sources[sourceId] = sourceFor("relief", { tileSize: 256 });
      const layer = clone(reliefBase);
      layer.id = coverageLayerId(BC_RELIEF_LAYER, BASE_ID, "relief");
      layer.source = sourceId;
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
    // the footprint. Rides right after the BC raster so it sits under the
    // contours and under everything the BC style draws over its own relief.
    if (reliefBase && hasFile(cov, "relief")) {
      const sourceId = coverageSourceId(cov.id, "relief");
      style.sources[sourceId] = sourceFor("relief", { tileSize: 256, minzoom: 8, maxzoom: 14 });
      const layer = clone(reliefBase);
      layer.id = coverageLayerId(BC_RELIEF_LAYER, cov.id, "relief");
      layer.source = sourceId;
      layer.metadata = { ...layer.metadata, "bathy:coverage": cov.id, "bathy:archive": "relief" };
      push(BC_RELIEF_LAYER, layer);
    }

    // Shore: an opaque LAND_COLOR fill clone right after the BC land mask
    // (and after the base land). Schema 1 only: schema 2 drops the key and
    // the coast-wide base land draws the shore instead.
    if (landBase && hasFile(cov, "land")) {
      const sourceId = coverageSourceId(cov.id, "land");
      style.sources[sourceId] = sourceFor("land", { minzoom: 4, maxzoom: 14 });
      const layer = clone(landBase);
      layer.id = coverageLayerId(BC_LAND_LAYER, cov.id, "land");
      layer.source = sourceId;
      layer["source-layer"] = cov.pmtiles.land?.source_layer || "land";
      layer.metadata = { ...layer.metadata, "bathy:coverage": cov.id, "bathy:archive": "land" };
      push(BC_LAND_LAYER, layer);
    }

    for (const tier of tiers) {
      style.sources[coverageSourceId(cov.id, tier)] = sourceFor(tier, { minzoom: 9, maxzoom: 14 });

      for (const t of templates) {
        const range = zoomRangeFor(t, tier, tiers);
        if (!range) continue;
        const layer = clone(t);
        layer.id = coverageLayerId(t.id, cov.id, tier);
        layer.source = coverageSourceId(cov.id, tier);
        layer["source-layer"] = cov.pmtiles[tier]?.source_layer || "contours";
        delete layer.minzoom;
        delete layer.maxzoom;
        Object.assign(layer, range);
        layer.metadata = { ...layer.metadata, "bathy:coverage": cov.id, "bathy:tier": tier };
        push(t.id === COAST_BASE_ID ? BC_CONTOUR_LINE : t.id, layer);
      }
    }
    result.added.push(cov.id);
  }

  if (result.added.length === 0 && result.base.length === 0) return result;

  const layers: StyleLayerLike[] = [];
  for (const layer of style.layers) {
    layers.push(layer);
    const extra = after.get(layer.id);
    if (extra) layers.push(...extra);
  }
  style.layers = layers;
  return result;
}
