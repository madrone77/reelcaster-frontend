"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  type MapRef,
  type LayerProps,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type {
  ExpressionSpecification,
  Map as MlMap,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RailSpot } from "../lib/explore-data";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { spotsToFeatureCollection, SELECT_HEX } from "../lib/spot-geojson";
import { useCurrentsFlow } from "../lib/use-currents-flow";

const SOURCE_ID = "bc-spots";
const SPOT_CIRCLE = "bc-spot-circle";
const SPOT_LABEL = "bc-spot-label";

const INTERACTIVE = [SPOT_CIRCLE];

// Layer groups the toggles flip (relief style ids). Bathymetry = depth shading
// + contours + their labels; labels = place names.
const RELIEF_LAYERS = ["color-relief", "contour-line", "contour-labels"];
const LABEL_LAYERS = ["places-t0", "places-t1", "places-t2", "places-t3", "places-t4"];

// MapLibre's expression unions don't infer from array literals — this keeps
// the layer defs readable while staying typed.
const expr = (e: unknown) => e as ExpressionSpecification;

/**
 * Edge-to-edge bathymetric relief base map (self-hosted via /api/map/tiles).
 * Spots render as native GL circle + label layers — no per-spot DOM — so
 * panning/zooming the full covered set stays on the GPU. Empty `origin` so
 * every style URL (tiles, glyphs, places GeoJSON) is root-relative same-origin.
 */
/** Current map viewport, in lng/lat. The rail lists whatever falls inside it. */
export type MapBounds = { w: number; s: number; e: number; n: number };

export default function ExploreMap({
  mapRef,
  spots,
  selectedSlug,
  onSelect,
  initialCenter,
  initialZoom,
  relief,
  labels,
  currents,
  onBoundsChange,
}: {
  mapRef: RefObject<MapRef | null>;
  spots: RailSpot[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  relief: boolean;
  labels: boolean;
  currents: boolean;
  /** Fired on load and after every pan/zoom — drives the viewport spot list. */
  onBoundsChange?: (b: MapBounds) => void;
}) {
  const [cursor, setCursor] = useState<string>("");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [mapObj, setMapObj] = useState<MlMap | null>(null);

  // Report the viewport up so the rail can list only what's on screen.
  const emitBounds = useCallback(
    (map: MlMap) => {
      if (!onBoundsChange) return;
      const b = map.getBounds();
      onBoundsChange({
        w: b.getWest(),
        s: b.getSouth(),
        e: b.getEast(),
        n: b.getNorth(),
      });
    },
    [onBoundsChange],
  );

  // Attach straight to the map instance rather than react-map-gl's onLoad:
  // `load` only fires once the STYLE finishes loading, and the relief style can
  // stall ("Style is not done loading"), which would leave the rail unfiltered
  // forever. Bounds are valid from the moment the map exists, so emit at once
  // and on every moveend.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    let map: MlMap | undefined;
    const handleMoveEnd = () => {
      if (map) emitBounds(map);
    };
    // Poll with setTimeout, not rAF: rAF is throttled to a standstill in a
    // background tab, which would leave the rail permanently unfiltered.
    const attach = () => {
      map = mapRef.current?.getMap();
      if (!map) {
        if (tries++ < 60) timer = setTimeout(attach, 50);
        return;
      }
      emitBounds(map);
      map.on("moveend", handleMoveEnd);
    };
    attach();
    return () => {
      if (timer) clearTimeout(timer);
      map?.off("moveend", handleMoveEnd);
    };
  }, [emitBounds, mapRef]);

  // Animated tidal-current overlay — bathy-relief WebGL flow (heatmap field +
  // white particle ribbons) as a MapLibre custom layer clipped at the coastline.
  useCurrentsFlow({ map: mapObj, enabled: currents, timeIso: null });

  // Flip layer visibility for the relief/labels toggles once the style is up.
  useEffect(() => {
    if (!mapObj) return;
    const set = (ids: string[], on: boolean) =>
      ids.forEach((id) => {
        if (mapObj.getLayer(id)) {
          mapObj.setLayoutProperty(id, "visibility", on ? "visible" : "none");
        }
      });
    set(RELIEF_LAYERS, relief);
    set(LABEL_LAYERS, labels);
  }, [mapObj, relief, labels]);

  // Absolute origin is REQUIRED: MapLibre builds vector-tile URLs inside a Web
  // Worker that can't resolve root-relative paths ("/api/map/tiles/…" → "Failed
  // to parse URL"), so contour + land tiles silently load zero features. Raster,
  // GeoJSON, and glyphs resolve on the main thread, which masks it. Use the full
  // origin so every source URL is absolute.
  const mapStyle = useMemo(
    () =>
      buildReliefStyle(
        typeof window !== "undefined" ? window.location.origin : "",
      ) as unknown as StyleSpecification,
    [],
  );

  const data = useMemo(() => spotsToFeatureCollection(spots), [spots]);

  // Selection + hover drive the stroke (cobalt when selected, heavier when
  // hovered) — never the radius, matching BlueCaster. Re-evaluated whenever
  // selectedSlug/hoveredSlug change so the declarative paint updates.
  const sel = selectedSlug ?? "__none__";
  const hov = hoveredSlug ?? "__none__";
  const strokeColor = ["case", ["==", ["get", "slug"], sel], SELECT_HEX, "#ffffff"];
  const strokeWidth = [
    "case",
    ["==", ["get", "slug"], sel], 3,
    ["==", ["get", "slug"], hov], 2.5,
    1.5,
  ];

  // One circle layer for every spot (scored colors + opacity baked into props;
  // unscored = muted zinc dot at 0.6). Radius zoom-interpolated (11→14→16).
  const spotCircleLayer: LayerProps = {
    id: SPOT_CIRCLE,
    type: "circle",
    paint: {
      "circle-radius": expr(["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14, 15, 16]),
      "circle-color": expr(["get", "color"]),
      "circle-opacity": expr(["get", "opacity"]),
      "circle-stroke-width": expr(strokeWidth),
      "circle-stroke-color": expr(strokeColor),
    },
  };

  // Score numeral (or "·" for unscored), color from the feature (white / grey).
  const spotLabelLayer: LayerProps = {
    id: SPOT_LABEL,
    type: "symbol",
    layout: {
      "text-field": expr(["get", "label"]),
      "text-font": ["Open Sans Semibold"],
      "text-size": expr(["interpolate", ["linear"], ["zoom"], 8, 10, 14, 12]),
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": expr(["get", "txtColor"]) },
  };

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const slug = e.features?.[0]?.properties?.slug;
      if (slug) onSelect(slug as string);
    },
    [onSelect],
  );

  // Hover: pointer cursor + track the hovered spot so its stroke thickens.
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const slug = f ? (f.properties?.slug as string) : null;
    setCursor(f ? "pointer" : "");
    setHoveredSlug((prev) => (prev === slug ? prev : slug));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursor("");
    setHoveredSlug(null);
  }, []);

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: initialCenter.lat,
          longitude: initialCenter.lng,
          zoom: initialZoom,
        }}
        mapStyle={mapStyle}
        minZoom={3.5}
        maxZoom={15}
        interactiveLayerIds={INTERACTIVE}
        cursor={cursor}
        onClick={handleClick}
        onLoad={(e) => setMapObj(e.target)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        <Source id={SOURCE_ID} type="geojson" data={data}>
          <Layer {...spotCircleLayer} />
          <Layer {...spotLabelLayer} />
        </Source>
      </Map>
    </div>
  );
}
