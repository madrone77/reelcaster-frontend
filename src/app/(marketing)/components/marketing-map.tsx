"use client";

import { useMemo } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { tierFor } from "@/app/explore/lib/explore-data";

const TIER_HEX: Record<string, string> = {
  good: "#16A34A",
  fair: "#D78711",
  poor: "#DC2626",
  none: "#9ca3af",
};

export interface MapPin {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  score: number | null;
}

/**
 * The marketing map — the Explore basemap, not a mockup. Same
 * `buildReliefStyle` bathymetric relief and the same tier-colored score pins,
 * fed by the same /api/v1/map/spots data, so the landing page shows the real
 * product rather than an illustration that can drift from it.
 *
 * Deliberately inert: no pan, zoom, layer tabs, or selection. This is a
 * picture of the product, and every control here would be a control that does
 * nothing until you reach /explore.
 */
export default function MarketingMap({
  pins,
  center,
  zoom,
}: {
  pins: MapPin[];
  center: { lat: number; lng: number };
  zoom: number;
}) {
  // Absolute origin is REQUIRED — MapLibre resolves vector-tile URLs inside a
  // Web Worker that can't expand root-relative paths, so contour + land tiles
  // would silently load zero features. Same reason as ExploreMap.
  const mapStyle = useMemo(
    () =>
      buildReliefStyle(
        typeof window !== "undefined" ? window.location.origin : "",
      ) as unknown as StyleSpecification,
    [],
  );

  return (
    <Map
      initialViewState={{
        latitude: center.lat,
        longitude: center.lng,
        zoom,
      }}
      mapStyle={mapStyle}
      attributionControl={false}
      dragPan={false}
      dragRotate={false}
      scrollZoom={false}
      doubleClickZoom={false}
      touchZoomRotate={false}
      keyboard={false}
      style={{ width: "100%", height: "100%" }}
    >
      {pins.map((p) => {
        const tier = tierFor(p.score);
        return (
          <Marker key={p.slug} latitude={p.lat} longitude={p.lng} anchor="center">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white shadow-rc-pin"
              style={{ backgroundColor: TIER_HEX[tier] }}
              title={`${p.name} — ${p.score ?? "no score"}`}
            >
              {p.score ?? "—"}
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
