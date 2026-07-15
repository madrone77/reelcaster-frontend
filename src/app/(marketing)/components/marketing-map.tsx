"use client";

import { useEffect, useMemo, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { useCurrentsFlow } from "@/app/explore/lib/use-currents-flow";
import { tierFor, type SpeciesOption } from "@/app/explore/lib/explore-data";
import MapFilterChips from "@/app/explore/components/map-filter-chips";

const TIER_HEX: Record<string, string> = {
  good: "#16A34A",
  fair: "#D78711",
  poor: "#DC2626",
  none: "#9ca3af",
};

// Same layer ids the relief style defines — see ExploreMap.
const RELIEF_LAYERS = ["color-relief", "contour-line", "contour-labels"];

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
const WIND_LAYER = "marketing-wind";

export interface MapSpot {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  score: number | null;
  /** Per-species peak score, keyed by species id — powers the Species chip. */
  scoresBySpecies: Record<string, number>;
}

/**
 * The marketing map — the Explore map, not a picture of it. Same
 * `buildReliefStyle` bathymetric relief, same /api/v1/map/spots data, same
 * `tierFor` pin colors, same MapFilterChips, and the same pan/zoom. The
 * landing page shows the real product, so it can't drift from it.
 *
 * Wind renders tiles only when NEXT_PUBLIC_OPENWEATHERMAP_API_KEY is set;
 * without it the chip toggles and no overlay appears — identical to Explore.
 */
export default function MarketingMap({
  spots,
  species,
  center,
  zoom,
}: {
  spots: MapSpot[];
  species: SpeciesOption[];
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const [mapObj, setMapObj] = useState<MlMap | null>(null);
  const [relief, setRelief] = useState(true);
  const [currents, setCurrents] = useState(false);
  const [wind, setWind] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);

  useCurrentsFlow({ map: mapObj, enabled: currents, timeIso: null });

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

  // Relief toggle flips layer visibility once the style is up.
  useEffect(() => {
    if (!mapObj) return;
    RELIEF_LAYERS.forEach((id) => {
      if (mapObj.getLayer(id)) {
        mapObj.setLayoutProperty(id, "visibility", relief ? "visible" : "none");
      }
    });
  }, [mapObj, relief]);

  // Selecting a species repoints each pin at that species' score, as the
  // Explore rail does. Spots with no score for it drop out rather than
  // showing a grey "—": Explore pairs those with a re-ranked rail that
  // explains them, and this map has no rail — a screen of blank pins would
  // just read as broken.
  const pins = useMemo(() => {
    if (!speciesFilter) return spots;
    return spots
      .map((s) => ({ ...s, score: s.scoresBySpecies[speciesFilter] ?? null }))
      .filter((s) => s.score !== null);
  }, [spots, speciesFilter]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 left-2 right-2 z-10">
        <MapFilterChips
          relief={relief}
          currents={currents}
          wind={wind}
          onToggleRelief={() => setRelief((v) => !v)}
          onToggleCurrents={() => setCurrents((v) => !v)}
          onToggleWind={() => setWind((v) => !v)}
          species={species}
          speciesFilter={speciesFilter}
          onSpeciesChange={setSpeciesFilter}
        />
      </div>

      <Map
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom,
        }}
        mapStyle={mapStyle}
        minZoom={7}
        maxZoom={14}
        attributionControl={false}
        onLoad={(e) => setMapObj(e.target)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

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
              layout={{ visibility: wind ? "visible" : "none" }}
            />
          </Source>
        )}

        {pins.map((p) => {
          const tier = tierFor(p.score);
          return (
            <Marker
              key={p.slug}
              latitude={p.lat}
              longitude={p.lng}
              anchor="center"
            >
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
    </div>
  );
}
