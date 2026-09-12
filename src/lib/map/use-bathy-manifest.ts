"use client";

import { useEffect, useState } from "react";
import { fetchBathyManifest } from "./bathy-manifest";
import type { BathyManifestLike } from "./bathy-coverages";

/**
 * The bathymetry manifest for a map style builder. Null until it arrives and
 * null for good if it cannot be read, so a style built on null is the BC-only
 * style that shipped before coverages; once the manifest lands the caller's
 * style memo re-runs and react-map-gl diffs the new sources and layers in.
 */
export function useBathyManifest(enabled = true): BathyManifestLike | null {
  const [manifest, setManifest] = useState<BathyManifestLike | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetchBathyManifest().then((m) => {
      if (live && m) setManifest(m);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return manifest;
}
