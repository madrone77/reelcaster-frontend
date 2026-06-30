"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { useCurrentsFlow } from "../../lib/use-currents-flow";
import { tierFor } from "../../lib/explore-data";
import type { LiveSpot } from "@/lib/bluecaster/live-spot-types";

const TIER_HEX: Record<string, string> = {
  good: "#16A34A",
  fair: "#D78711",
  poor: "#DC2626",
  none: "#9ca3af",
};

type Layer = "bathy" | "currents";

/**
 * Compact spot map — reuses the bathymetric relief style and the WebGL currents
 * flow from the Explore map, framed on a single spot with a tier-colored score
 * pin. Tabs switch between Bathymetry and Currents (the two layers that exist).
 */
export default function SpotMiniMap({
  spot,
  score,
  speciesName,
}: {
  spot: LiveSpot;
  score: number | null;
  speciesName: string | null;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapObj, setMapObj] = useState<MlMap | null>(null);
  const [layer, setLayer] = useState<Layer>("bathy");

  useCurrentsFlow({ map: mapObj, enabled: layer === "currents", timeIso: null });

  const mapStyle = useMemo(
    () =>
      buildReliefStyle(
        typeof window !== "undefined" ? window.location.origin : "",
      ) as unknown as StyleSpecification,
    [],
  );

  const tier = tierFor(score);

  return (
    <div className="relative h-64 rounded-xl overflow-hidden border border-rc-rule bg-rc-surface">
      {/* Layer tabs */}
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        {(
          [
            ["bathy", "Bathymetry"],
            ["currents", "Currents"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              layer === key
                ? "bg-rc-brand text-white"
                : "bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Expand → full map */}
      <Link
        href="/explore"
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rc-panel/90 text-rc-ink-soft text-[11px] font-semibold hover:bg-rc-panel transition-colors"
      >
        <Maximize2 className="w-3 h-3" />
        Expand
      </Link>

      {/* Coordinates chip */}
      <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-md bg-rc-panel/90 font-rc-mono text-[11px] text-rc-ink-soft">
        {spot.lat.toFixed(2)}°N · {Math.abs(spot.lng).toFixed(2)}°W
      </div>

      <Map
        ref={mapRef}
        initialViewState={{
          latitude: spot.lat,
          longitude: spot.lng,
          zoom: 11.5,
        }}
        mapStyle={mapStyle}
        minZoom={6}
        maxZoom={15}
        attributionControl={false}
        onLoad={(e) => setMapObj(e.target)}
        style={{ width: "100%", height: "100%" }}
      >
        <Marker latitude={spot.lat} longitude={spot.lng} anchor="center">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-bold shadow-rc-pin ring-2 ring-white"
            style={{ backgroundColor: TIER_HEX[tier] }}
            title={speciesName ?? undefined}
          >
            {score ?? "—"}
          </div>
        </Marker>
      </Map>
    </div>
  );
}
