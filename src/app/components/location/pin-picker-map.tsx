"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import type { NearestSpotHit } from "@/lib/bluecaster/catch-ingest-types";

/**
 * Draggable-pin location picker on the bathymetric relief chart (same
 * MapLibre style as Explore — no Mapbox token needed). Controlled: the pin
 * follows `lat`/`lng`; drags and map clicks report through `onMove`.
 * Nearby saved spots render as small labeled target dots (mock parity).
 */
export default function PinPickerMap({
  lat,
  lng,
  onMove,
  candidates = [],
  matchedSpotId = null,
  className = "h-[420px]",
  zoom = 11,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
  candidates?: NearestSpotHit[];
  matchedSpotId?: string | null;
  className?: string;
  zoom?: number;
}) {
  const mapRef = useRef<MapRef | null>(null);
  // True while the pin change originated from a user gesture on THIS map
  // (pin drag / map click). External jumps (geo-resolution, "use spot")
  // recenter; user gestures must not — the map easing back after a drag
  // reads as the map moving on its own.
  const internalMoveRef = useRef(false);

  const mapStyle = useMemo(
    () =>
      buildReliefStyle(
        typeof window !== "undefined" ? window.location.origin : "",
      ) as unknown as StyleSpecification,
    [],
  );

  // Follow external pin jumps (initial geo-resolution, "use spot" actions).
  useEffect(() => {
    if (internalMoveRef.current) {
      internalMoveRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const drift = Math.abs(center.lat - lat) + Math.abs(center.lng - lng);
    if (drift > 0.02) {
      map.easeTo({ center: [lng, lat], duration: 500 });
    }
  }, [lat, lng]);

  const reportMove = (nextLat: number, nextLng: number) => {
    internalMoveRef.current = true;
    onMove(nextLat, nextLng);
  };

  const handleClick = (e: MapLayerMouseEvent) => {
    reportMove(e.lngLat.lat, e.lngLat.lng);
  };

  const latLabel = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngLabel = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-rc-rule bg-rc-surface ${className}`}
    >
      <div className="absolute top-3 left-3 z-10 rounded-lg bg-rc-panel/95 border border-rc-rule px-3 py-1.5 font-rc-mono text-[12px] text-rc-ink shadow-rc-panel">
        {latLabel} · {lngLabel}
      </div>

      <Map
        ref={mapRef}
        initialViewState={{ latitude: lat, longitude: lng, zoom }}
        mapStyle={mapStyle}
        minZoom={5}
        maxZoom={15}
        attributionControl={false}
        onClick={handleClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {candidates.map((c) => (
          <Marker key={c.id} latitude={c.lat} longitude={c.lng} anchor="center">
            <div className="flex flex-col items-center pointer-events-none">
              <span
                className={`font-rc-mono text-[11px] font-semibold px-1 rounded-sm bg-rc-panel/80 ${
                  c.id === matchedSpotId ? "text-rc-brand" : "text-rc-ink-soft"
                }`}
              >
                {c.name}
              </span>
              <span
                className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  c.id === matchedSpotId
                    ? "border-rc-brand"
                    : "border-rc-ink-mute"
                } bg-rc-panel/90`}
              >
                <span
                  className={`w-1 h-1 rounded-full ${
                    c.id === matchedSpotId ? "bg-rc-brand" : "bg-rc-ink-mute"
                  }`}
                />
              </span>
            </div>
          </Marker>
        ))}

        <Marker
          latitude={lat}
          longitude={lng}
          anchor="bottom"
          draggable
          onDragEnd={(e) => reportMove(e.lngLat.lat, e.lngLat.lng)}
        >
          {/* Blue teardrop pin (mock parity) */}
          <svg
            width="34"
            height="44"
            viewBox="0 0 34 44"
            className="drop-shadow-md cursor-grab active:cursor-grabbing"
          >
            <path
              d="M17 1C8.2 1 1 8.1 1 16.9 1 28.9 17 43 17 43s16-14.1 16-26.1C33 8.1 25.8 1 17 1Z"
              fill="#1E40E0"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle cx="17" cy="16.5" r="5.5" fill="#fff" />
          </svg>
        </Marker>
      </Map>
    </div>
  );
}
