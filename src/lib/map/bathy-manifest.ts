// One cached read of the bathymetry manifest, shared by the client style
// builders (via useBathyManifest) and the tile proxy (server). Module scope:
// a page fetches it once, a warm server instance re-reads it every TTL.
//
// Any failure resolves to null rather than throwing, and null means "draw BC
// only": the style falls back to exactly what shipped before coverages.

import { BATHY_MANIFEST_URL, type BathyManifestLike } from "./bathy-coverages";

const TTL_MS = 5 * 60 * 1000;

let cached: { at: number; promise: Promise<BathyManifestLike | null> } | null = null;

export function fetchBathyManifest(): Promise<BathyManifestLike | null> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = fetch(BATHY_MANIFEST_URL, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<BathyManifestLike>) : null))
    .then((m) => (m && typeof m === "object" ? m : null))
    .catch(() => null);
  cached = { at: now, promise };
  // A failed read should not be pinned for the whole TTL.
  promise.then((m) => {
    if (m === null && cached?.promise === promise) cached = null;
  });
  return promise;
}
