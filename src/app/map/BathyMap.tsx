"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

let protocolRegistered = false;
function ensureProtocol() {
  if (protocolRegistered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  protocolRegistered = true;
}

interface BathyMapProps {
  center?: [number, number];
  zoom?: number;
  onReady?: (map: maplibregl.Map) => void;
  className?: string;
}

/**
 * Map substrate: the bathymetric color-relief base (the /bathy-relief look),
 * loaded from the same-origin proxy (/api/bluecaster/map/relief-style →
 * bluecaster /api/v1/map/relief-style). Hands the map instance to the explorer
 * via onReady so it can add the score-puck layers on top.
 *
 * The relief style is self-contained (relief raster + contours + land +
 * regulatory + labels all visible), so no per-layer Pro-tier flipping is needed.
 */
export function BathyMap({ center = [-123.26, 48.43], zoom = 12, onReady, className }: BathyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    ensureProtocol();

    fetch("/api/bluecaster/map/relief-style", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`relief-style ${r.status}`);
        return r.json();
      })
      .then((style) => {
        if (cancelled || !containerRef.current) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center,
          zoom,
          maxZoom: 16,
          minZoom: 8,
          attributionControl: { compact: true },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");
        map.on("error", (e) =>
          console.error("maplibre error:", (e as unknown as { error?: Error }).error?.message),
        );

        onReady?.(map);
      })
      .catch((err) => console.error("BathyMap style load failed:", err));

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
    // Create once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
