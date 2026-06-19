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
  FilterSpecification,
  GeoJSONSource,
  Map as MlMap,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RailSpot } from "../lib/explore-data";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { spotsToFeatureCollection, SELECT_HEX } from "../lib/spot-geojson";
import { useCurrentsFlow } from "../lib/use-currents-flow";

const SOURCE_ID = "bc-spots";
const CLUSTER = "bc-clusters";
const CLUSTER_COUNT = "bc-cluster-count";
const SPOT_CIRCLE = "bc-spot-circle";
const SPOT_LABEL = "bc-spot-label";

const INTERACTIVE = [CLUSTER, SPOT_CIRCLE];

// Layer groups the toggles flip (relief style ids). Bathymetry = depth shading
// + contours + their labels; labels = place names.
const RELIEF_LAYERS = ["color-relief", "contour-line", "contour-labels"];
const LABEL_LAYERS = ["places-t0", "places-t1", "places-t2", "places-t3", "places-t4"];

// MapLibre's expression/filter unions don't infer from array literals — these
// keep the layer defs readable while staying typed.
const expr = (e: unknown) => e as ExpressionSpecification;
const filt = (f: unknown) => f as FilterSpecification;

const NOT_CLUSTER = ["!", ["has", "point_count"]];

/**
 * Edge-to-edge bathymetric relief base map (self-hosted via /api/map/tiles).
 * Spots render as native GL clustered circle + label layers — no per-spot DOM —
 * so panning/zooming the full covered set stays on the GPU. Empty `origin` so
 * every style URL (tiles, glyphs, places GeoJSON) is root-relative same-origin.
 */
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
}) {
  const [cursor, setCursor] = useState<string>("");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [mapObj, setMapObj] = useState<MlMap | null>(null);

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

  // Cluster: solid cobalt, white ring, count-stepped radius (BlueCaster values).
  const clusterLayer: LayerProps = {
    id: CLUSTER,
    type: "circle",
    filter: filt(["has", "point_count"]),
    paint: {
      "circle-color": SELECT_HEX,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#ffffff",
      "circle-radius": expr(["step", ["get", "point_count"], 15, 5, 18, 15, 22, 30, 28]),
    },
  };

  const clusterCountLayer: LayerProps = {
    id: CLUSTER_COUNT,
    type: "symbol",
    filter: filt(["has", "point_count"]),
    layout: {
      "text-field": expr(["get", "point_count_abbreviated"]),
      "text-font": ["Open Sans Semibold"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#ffffff" },
  };

  // One circle layer for every spot (scored colors + opacity baked into props;
  // unscored = muted zinc dot at 0.6). Radius zoom-interpolated (11→14→16).
  const spotCircleLayer: LayerProps = {
    id: SPOT_CIRCLE,
    type: "circle",
    filter: filt(NOT_CLUSTER),
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
    filter: filt(NOT_CLUSTER),
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
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties ?? {};
      // Cluster → zoom to its expansion level.
      if (props.point_count) {
        const map = mapRef.current?.getMap();
        const src = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        const clusterId = props.cluster_id as number;
        if (!map || !src || clusterId == null) return;
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        src
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => map.easeTo({ center: [lng, lat], zoom, duration: 500 }))
          .catch(() => {});
        return;
      }
      // Individual spot → open it.
      if (props.slug) onSelect(props.slug as string);
    },
    [mapRef, onSelect],
  );

  // Hover: pointer cursor + track the hovered spot so its stroke thickens.
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const slug = f && !f.properties?.point_count ? (f.properties?.slug as string) : null;
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

        <Source
          id={SOURCE_ID}
          type="geojson"
          data={data}
          cluster
          clusterRadius={55}
          clusterMaxZoom={10}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...spotCircleLayer} />
          <Layer {...spotLabelLayer} />
        </Source>
      </Map>
    </div>
  );
}
