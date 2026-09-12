import { NextRequest } from "next/server";
import { gzipSync } from "node:zlib";
import { PMTiles, FetchSource } from "pmtiles";
import { TILE_SETS, type TileSetDef } from "@/lib/map/tile-sets";
import { coverageTileSet, isCoverageSetId } from "@/lib/map/bathy-coverages";
import { fetchBathyManifest } from "@/lib/map/bathy-manifest";

/**
 * GET /api/map/tiles/[set]/[z]/[x]/[y]
 *
 * Per-tile proxy over the bathymetry PMTiles archives on the Supabase CDN
 * (ported from bluecaster). Clients fetch plain z/x/y URLs (no pmtiles
 * protocol, no Range requests, no CORS preflights); each tile is a small
 * full-200 response cached immutable by both Vercel's edge (s-maxage) and the
 * browser (max-age) — which 206 partial responses never are. The set id embeds
 * the bake version, so immutable caching can never serve a stale bake (see
 * src/lib/map/tile-sets.ts).
 *
 * 204 = valid coords but no tile there (MapLibre renders it as empty, no
 * console error). 400 = unknown set / malformed coords. Errors are never
 * cached.
 *
 * Set ids that start with `cov-` are the manifest's per-coverage archives
 * (US west coast, see src/lib/map/bathy-coverages.ts): contours (MVT,
 * re-gzipped), land (MVT) and relief (WebP raster, served as-is like the BC
 * relief set). Ids that start with `base-` are the manifest's coast-wide
 * base relief (WebP, z0 to z9) and base land (MVT). All resolved against the
 * live manifest, which is cached in module scope, so an archive the manifest
 * does not list is a 400 like any other unknown set.
 */

async function resolveSet(setId: string): Promise<TileSetDef | undefined> {
  const fixed = TILE_SETS[setId];
  if (fixed) return fixed;
  if (!isCoverageSetId(setId)) return undefined;
  return coverageTileSet(await fetchBathyManifest(), setId) ?? undefined;
}

// Module scope: PMTiles' internal SharedPromiseCache keeps the archive header
// and directories across requests within a warm instance, so a typical tile
// miss costs a single range fetch to the CDN.
const archives = new Map<string, PMTiles>();
function archive(setId: string, url: string): PMTiles {
  let a = archives.get(setId);
  if (!a) {
    a = new PMTiles(new FetchSource(url));
    archives.set(setId, a);
  }
  return a;
}

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";
// Plain GETs with no custom headers never preflight; allow any origin so the
// tiles stay reusable (and harmless — they're public bathymetry).
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ set: string; z: string; x: string; y: string }> },
) {
  const { set, z, x, y } = await params;
  const def = await resolveSet(set);
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y);
  if (!def || !Number.isInteger(zi) || !Number.isInteger(xi) || !Number.isInteger(yi)) {
    return new Response("unknown tile set or bad coords", { status: 400, headers: { ...CORS } });
  }
  // Outside the archive's zoom/extent: cacheable empty tile.
  if (zi < def.minzoom || zi > def.maxzoom || xi < 0 || yi < 0 || xi >= 2 ** zi || yi >= 2 ** zi) {
    return new Response(null, { status: 204, headers: { ...CORS, "Cache-Control": IMMUTABLE } });
  }

  try {
    const tile = await archive(set, def.url).getZxy(zi, xi, yi);
    if (!tile?.data || tile.data.byteLength === 0) {
      return new Response(null, { status: 204, headers: { ...CORS, "Cache-Control": IMMUTABLE } });
    }
    const headers: Record<string, string> = {
      ...CORS,
      "Cache-Control": IMMUTABLE,
      "Content-Type": def.contentType,
    };
    let body: BodyInit = tile.data as ArrayBuffer;
    // getZxy returns DECOMPRESSED bytes (pmtiles inflates the archive's
    // internal tile gzip). Re-gzip MVT explicitly — Vercel doesn't reliably
    // compress application/x-protobuf, and an explicit Content-Encoding
    // prevents double-compression.
    if (def.gzip && /\bgzip\b/i.test(request.headers.get("accept-encoding") ?? "")) {
      body = gzipSync(Buffer.from(tile.data));
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
    }
    return new Response(body, { status: 200, headers });
  } catch (e) {
    return new Response((e as Error).message, {
      status: 502,
      headers: { ...CORS, "Cache-Control": "no-store" },
    });
  }
}
