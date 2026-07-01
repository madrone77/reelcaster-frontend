"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, ChevronLeft } from "lucide-react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/maplibre";
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

type Layer = "bathy" | "satellite" | "currents" | "winds";

const TABS: [Layer, string][] = [
  ["bathy", "Bathymetry"],
  ["satellite", "Satellite"],
  ["currents", "Currents"],
  ["winds", "Winds"],
];

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;

const SAT_LAYER = "spot-sat";
const WIND_LAYER = "spot-wind";

/**
 * Compact spot map — reuses the bathymetric relief style + WebGL currents flow
 * from the Explore map, framed on a single spot with a tier-colored score pin.
 * Four tabs: Bathymetry / Satellite (Mapbox raster) / Currents / Winds (OWM
 * raster). Satellite & Winds are added to the live map object (not the style)
 * and toggled by visibility; they degrade to the base map when their env key
 * is unset.
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
    <div className="relative h-72 rounded-xl overflow-hidden border border-rc-rule bg-rc-surface">
      {/* Layer tabs */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
              layer === key
                ? "bg-rc-brand text-white"
                : "bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Back to map */}
      <Link
        href="/explore"
        aria-label="Back to map"
        className="absolute bottom-2 left-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>

      {/* Expand → full map */}
      <Link
        href="/explore"
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rc-panel/90 text-rc-ink-soft text-[11px] font-semibold hover:bg-rc-panel transition-colors"
      >
        <Maximize2 className="w-3 h-3" />
        Expand map
      </Link>

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
        {/* Satellite / Winds rasters — declared so react-map-gl manages them (it
            reconciles the style and would wipe imperatively-added layers). Layers
            render above the relief base; visibility follows the active tab. */}
        {MAPBOX_TOKEN && (
          <Source
            id={SAT_LAYER}
            type="raster"
            tiles={[
              `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=${MAPBOX_TOKEN}`,
            ]}
            tileSize={256}
          >
            <Layer
              id={SAT_LAYER}
              type="raster"
              layout={{ visibility: layer === "satellite" ? "visible" : "none" }}
            />
          </Source>
        )}
        {OWM_KEY && (
          <Source
            id={WIND_LAYER}
            type="raster"
            tiles={[
              `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
            ]}
            tileSize={256}
          >
            <Layer
              id={WIND_LAYER}
              type="raster"
              paint={{ "raster-opacity": 0.6 }}
              layout={{ visibility: layer === "winds" ? "visible" : "none" }}
            />
          </Source>
        )}

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
