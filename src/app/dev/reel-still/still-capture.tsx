"use client";

import { useEffect, useMemo, useState } from "react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMarketingStyle } from "@/app/(marketing)/components/marketing-map";
import { fetchBathyManifest } from "@/lib/map/bathy-manifest";
import type { BathyManifestLike } from "@/lib/map/bathy-coverages";

declare global {
  interface Window {
    __stillReady?: boolean;
  }
}

/**
 * The marketing map at an exact centre, zoom and size, with no pins, pinned
 * over everything else the layout draws. See page.tsx.
 */
export default function StillCapture({
  lat,
  lng,
  zoom,
  w,
  h,
}: {
  lat: number;
  lng: number;
  zoom: number;
  w: number;
  h: number;
}) {
  // The US depth coverages have to be in the style before the map is built,
  // or a US still bakes without them. Undefined = still asking.
  const [manifest, setManifest] = useState<BathyManifestLike | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetchBathyManifest()
      .then((m) => live && setManifest(m ?? null))
      .catch(() => live && setManifest(null));
    return () => {
      live = false;
    };
  }, []);

  const style = useMemo(
    () => (manifest === undefined ? null : buildMarketingStyle(window.location.origin, manifest)),
    [manifest],
  );

  return (
    <div
      data-still
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: w,
        height: h,
        zIndex: 2147483647,
        background: "#AFD2E6",
      }}
    >
      {style && (
        <Map
          initialViewState={{ latitude: lat, longitude: lng, zoom }}
          mapStyle={style}
          interactive={false}
          attributionControl={false}
          fadeDuration={0}
          style={{ width: w, height: h }}
          onIdle={(e) => {
            if (e.target.areTilesLoaded()) window.__stillReady = true;
          }}
        />
      )}
    </div>
  );
}
