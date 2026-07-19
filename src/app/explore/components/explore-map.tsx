"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  AttributionControl,
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
import { MAP_CUSTOM_ATTRIBUTION, MapBrandLogo } from "@/lib/map/map-brand";
import { spotsToFeatureCollection, SELECT_HEX } from "../lib/spot-geojson";
import { useCurrentsFlow } from "../lib/use-currents-flow";

const SOURCE_ID = "bc-spots";
const SPOT_CIRCLE = "bc-spot-circle";
const SPOT_LABEL = "bc-spot-label";
// Relief-style layers (tide donuts + weather buoys). Spot circles are React
// layers added after the style, so they render on top and win overlap clicks.
const TIDE_STATION = "tide-station";
const BUOY_MARKER = "buoy-marker";

const INTERACTIVE = [SPOT_CIRCLE, TIDE_STATION, BUOY_MARKER];

/** A clicked tide-station donut or weather-buoy marker. */
export interface StationPick {
  kind: "tide" | "buoy";
  source: "chs" | "noaa" | "ndbc";
  sid: string;
  name: string;
  lat: number;
  lng: number;
}

// Layer groups the toggles flip (relief style ids). Bathymetry = depth shading
// + contours + their labels; labels = place names.
const RELIEF_LAYERS = ["color-relief", "contour-line", "contour-labels"];
const LABEL_LAYERS = ["places-t0", "places-t1", "places-t2", "places-t3", "places-t4"];
// WDFW regulatory layers (WA marine-area grid + MPAs). The relief style ships
// them hidden (Canada-first); they flip on when the active city is in Washington.
const WDFW_LAYERS = [
  "wdfw-ma-casing",
  "wdfw-ma-lines",
  "wdfw-ma-labels",
  "wdfw-mpa-fill",
  "wdfw-mpa-outline",
  "wdfw-mpa-labels",
];

// OpenWeatherMap wind raster overlay (same tiles as the spot detail map).
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
const WIND_LAYER = "explore-wind";

// MapLibre's expression/filter unions don't infer from array literals — these
// keep the layer defs readable while staying typed.
const expr = (e: unknown) => e as ExpressionSpecification;

/**
 * Edge-to-edge bathymetric relief base map (self-hosted via /api/map/tiles).
 * Spots render as native GL circle + label layers — no per-spot DOM — so
 * panning/zooming the full covered set stays on the GPU. Empty `origin` so
 * every style URL (tiles, glyphs, places GeoJSON) is root-relative same-origin.
 */
export default function ExploreMap({
  mapRef,
  spots,
  selectedSlug,
  onSelect,
  onSelectStation,
  initialCenter,
  initialZoom,
  relief,
  labels,
  currents,
  wind,
  hour,
  flowTimeIso,
  stripVisible = false,
  wdfwRegs,
}: {
  mapRef: RefObject<MapRef | null>;
  spots: RailSpot[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onSelectStation: (pick: StationPick) => void;
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  relief: boolean;
  labels: boolean;
  currents: boolean;
  wind?: boolean;
  /** 0–23 hour override — pins recolor to that hour; null = day peak. */
  hour?: number | null;
  /** UTC instant for the currents flow field; null = model "now". */
  flowTimeIso?: string | null;
  /** Desktop forecast strip visible → raise attribution/watermark above it. */
  stripVisible?: boolean;
  /** Show the WDFW marine-area grid + MPAs (active city is in Washington). */
  wdfwRegs?: boolean;
}) {
  const [cursor, setCursor] = useState<string>("");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [mapObj, setMapObj] = useState<MlMap | null>(null);

  // Animated tidal-current overlay — bathy-relief WebGL flow (heatmap field +
  // white particle ribbons) as a MapLibre custom layer clipped at the coastline.
  useCurrentsFlow({ map: mapObj, enabled: currents, timeIso: flowTimeIso ?? null });

  // The compact attribution renders expanded on load, spilling a wall of source
  // text over the map. Collapse it back to the ⓘ. This runs off the DOM from
  // mount — NOT off the map 'load' event, which waits on the relief-tile CDN
  // and can take 20s+, leaving the wall up the whole time. Keep re-collapsing
  // briefly (late attribution updates re-open it) until the user taps the ⓘ,
  // after which their choice wins.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let userToggled = false;
    const collapse = () => {
      if (userToggled) return;
      const el = root.querySelector(".maplibregl-ctrl-attrib");
      if (el) {
        el.classList.remove("maplibregl-compact-show");
        el.removeAttribute("open");
      }
    };
    const onClickCapture = (e: Event) => {
      if ((e.target as HTMLElement).closest?.(".maplibregl-ctrl-attrib")) userToggled = true;
    };
    root.addEventListener("click", onClickCapture, true);
    collapse();
    const iv = setInterval(collapse, 500);
    const stop = setTimeout(() => clearInterval(iv), 30_000);
    return () => {
      clearInterval(iv);
      clearTimeout(stop);
      root.removeEventListener("click", onClickCapture, true);
    };
  }, []);

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
    set(WDFW_LAYERS, wdfwRegs ?? false);
  }, [mapObj, relief, labels, wdfwRegs]);

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

  const data = useMemo(
    () => spotsToFeatureCollection(spots, hour),
    [spots, hour],
  );

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
      const f = e.features?.[0];
      if (!f) return;
      if (f.layer.id === SPOT_CIRCLE) {
        const slug = f.properties?.slug;
        if (slug) onSelect(slug as string);
        return;
      }
      const [lng, lat] =
        f.geometry.type === "Point" ? f.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
      if (f.layer.id === TIDE_STATION) {
        onSelectStation({
          kind: "tide",
          source: f.properties?.source as "chs" | "noaa",
          sid: String(f.properties?.sid ?? ""),
          name: String(f.properties?.name ?? ""),
          lat,
          lng,
        });
      } else if (f.layer.id === BUOY_MARKER) {
        onSelectStation({
          kind: "buoy",
          source: "ndbc",
          sid: String(f.properties?.sid ?? ""),
          name: String(f.properties?.name ?? ""),
          lat,
          lng,
        });
      }
    },
    [onSelect, onSelectStation],
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
    <div
      ref={wrapRef}
      className="rc-explore-map absolute inset-0"
      style={{ "--rc-map-inset": stripVisible ? "128px" : "0px" } as CSSProperties}
    >
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
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <AttributionControl compact position="bottom-right" customAttribution={MAP_CUSTOM_ATTRIBUTION} />

        {OWM_KEY && (
          <Source
            id={WIND_LAYER}
            type="raster"
            tiles={[
              `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
            ]}
            tileSize={256}
            attribution="Wind tiles © OpenWeatherMap"
          >
            <Layer
              id={WIND_LAYER}
              type="raster"
              paint={{ "raster-opacity": 0.6 }}
              layout={{ visibility: wind ? "visible" : "none" }}
            />
          </Source>
        )}

        <Source id={SOURCE_ID} type="geojson" data={data}>
          <Layer {...spotCircleLayer} />
          <Layer {...spotLabelLayer} />
        </Source>
      </Map>

      {/* Brand watermark — bottom-right corner, with the ⓘ acknowledgments
          inline to its left on the same vertical midline (the ctrl container
          is positioned via globals.css, keyed to these logo sizes).
          Desktop additionally rides above the forecast strip via the inset. */}
      <div className="lg:hidden pointer-events-none absolute bottom-2.5 right-2.5 z-10">
        <MapBrandLogo width={52} />
      </div>
      <div
        className="hidden lg:block pointer-events-none absolute right-2.5 z-10"
        style={{ bottom: "calc(var(--rc-map-inset, 0px) + 10px)" }}
      >
        <MapBrandLogo width={60} />
      </div>
    </div>
  );
}
