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
import { attachRcaHatch } from "@/lib/map/rca-hatch";
import {
  attachSquarePuck,
  SQUARE_PUCK_IMAGE_ID,
  SQUARE_PUCK_SIZE,
} from "@/lib/map/square-puck";
import { MAP_CUSTOM_ATTRIBUTION, MapBrandLogo } from "@/lib/map/map-brand";
import { spotsToFeatureCollection, declutterHiddenSlugs, SELECT_HEX } from "../lib/spot-geojson";
import { useCurrentsFlow } from "../lib/use-currents-flow";

const SOURCE_ID = "bc-spots";
const SPOT_CIRCLE = "bc-spot-circle";
const SPOT_LABEL = "bc-spot-label";
// Square puck for a spot the viewer created — same size/colour as the circles,
// differing only in shape.
const SPOT_CUSTOM_SQUARE = "bc-spot-custom-square";
const SPOT_CUSTOM_SQUARE_STROKE = "bc-spot-custom-square-stroke";
/** Stroke copy scale — 1.12 of a 32px square ≈ the circles' 1.5px ring. */
const SQUARE_STROKE_SCALE = 1.12;
// Relief-style layers (tide donuts + weather buoys). Spot circles are React
// layers added after the style, so they render on top and win overlap clicks.
const TIDE_STATION = "tide-station";
const BUOY_MARKER = "buoy-marker";

// Both spot shapes must be interactive — the square is a spot, not decoration.
const INTERACTIVE = [SPOT_CIRCLE, SPOT_CUSTOM_SQUARE, TIDE_STATION, BUOY_MARKER];

/** A clicked tide-station donut or weather-buoy marker. */
export interface StationPick {
  kind: "tide" | "buoy";
  source: "chs" | "noaa" | "ndbc";
  sid: string;
  name: string;
  lat: number;
  lng: number;
}

export interface CustomSpotPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visibility: "private" | "public";
  /** Selecting a spot is slug-keyed (`?spot=`), so the marker needs one. */
  slug?: string;
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
  onViewportChange,
  pinDropMode = false,
  onMapPick,
}: {
  mapRef: RefObject<MapRef | null>;
  spots: RailSpot[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onSelectStation: (pick: StationPick) => void;
  /** When true, a bare map click drops a pin (returns lng/lat) instead of
   *  selecting features — the "create custom spot" placement mode. */
  pinDropMode?: boolean;
  onMapPick?: (coords: { lat: number; lng: number }) => void;
  /** Fired on load + every moveend with the visible bounds and centre —
   *  drives the viewport-scoped rail, strip and pill label. */
  onViewportChange?: (
    bounds: { w: number; s: number; e: number; n: number },
    center: { lat: number; lng: number },
  ) => void;
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
  // Zoom snapshot for pin decluttering, quantised to quarter-steps so the
  // hidden set only recomputes a few times per pinch — pixel overlap depends
  // on zoom alone (no rotation on this map), never on pan.
  const [declutterZoom, setDeclutterZoom] = useState(() => Math.round(initialZoom * 4) / 4);

  const reportViewport = (m: MlMap) => {
    if (!onViewportChange) return;
    const b = m.getBounds();
    const c = m.getCenter();
    onViewportChange(
      { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() },
      { lat: c.lat, lng: c.lng },
    );
  };

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

  // Overlapping pins: hide the lower-scored one at this zoom (it reappears on
  // zoom-in). The selected spot is immune. Applied as a layer filter so the
  // GeoJSON source (and the strip/rail fed from `spots`) is untouched.
  const hiddenSlugs = useMemo(
    () => declutterHiddenSlugs(spots, hour, declutterZoom, selectedSlug),
    [spots, hour, declutterZoom, selectedSlug],
  );
  // Always a filter (empty list = keep all) so react-map-gl diffs a filter
  // change rather than toggling the property on and off.
  const declutterFilter = expr([
    "!",
    ["in", ["get", "slug"], ["literal", hiddenSlugs]],
  ]);

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

  // One circle layer for every CURATED spot (scored colors + opacity baked into
  // props; unscored = muted zinc dot at 0.6). Radius zoom-interpolated
  // (11→14→16). The viewer's own spots are excluded here and drawn as squares
  // by the layer below — without the exclusion each would render as both.
  const spotCircleLayer: LayerProps = {
    id: SPOT_CIRCLE,
    type: "circle",
    filter: expr(["all", declutterFilter, ["==", ["get", "isCustom"], 0]]),
    paint: {
      "circle-radius": expr(["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14, 15, 16]),
      "circle-color": expr(["get", "color"]),
      "circle-opacity": expr(["get", "opacity"]),
      "circle-stroke-width": expr(strokeWidth),
      "circle-stroke-color": expr(strokeColor),
    },
  };

  // The viewer's OWN spots: identical puck — score colour, white stroke, score
  // numeral — but SQUARE. Shape is the only difference because colour is
  // already carrying score, and cobalt already means "selected" here.
  //
  // MapLibre has no square primitive, so this is an SDF symbol (see
  // lib/map/square-puck.ts): `icon-color` applies the same score ramp the
  // circles use and `icon-halo-*` gives it the same white/selected stroke.
  //
  // icon-size is a ratio of the drawn image, so the stops are
  // circle-diameter ÷ image size — matching the circles' 11/14/16 radii
  // exactly, which is what "same size as the circles" requires.
  // The stroke is a SECOND, slightly larger copy of the same square drawn
  // underneath — not `icon-halo-width`. An SDF halo renders far too faintly
  // here to match the circles' crisp 1.5px ring (verified against a real pin
  // side by side: at halo 3 it was still barely there). A scaled sibling gives
  // an exact, uniform border.
  //
  // SQUARE_STROKE_SCALE is baked into the stops rather than written as
  // ["*", interpolate, k] — `zoom` must be the top-level input of an
  // interpolate or MapLibre rejects the whole layer, silently.
  const customSquareStrokeLayer: LayerProps = {
    id: SPOT_CUSTOM_SQUARE_STROKE,
    type: "symbol",
    filter: expr(["all", declutterFilter, ["==", ["get", "isCustom"], 1]]),
    layout: {
      "icon-image": SQUARE_PUCK_IMAGE_ID,
      "icon-size": expr([
        "interpolate",
        ["linear"],
        ["zoom"],
        8, ((11 * 2) / SQUARE_PUCK_SIZE) * SQUARE_STROKE_SCALE,
        12, ((14 * 2) / SQUARE_PUCK_SIZE) * SQUARE_STROKE_SCALE,
        15, ((16 * 2) / SQUARE_PUCK_SIZE) * SQUARE_STROKE_SCALE,
      ]),
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      // Same white / cobalt-when-selected as the circles' stroke. Selection
      // reads through colour alone here; the circles also widen their stroke,
      // but a zoom interpolate can't be nested inside a selection `case`.
      "icon-color": expr(strokeColor),
      "icon-opacity": expr(["get", "opacity"]),
    },
  };

  const customSquareLayer: LayerProps = {
    id: SPOT_CUSTOM_SQUARE,
    type: "symbol",
    filter: expr(["all", declutterFilter, ["==", ["get", "isCustom"], 1]]),
    layout: {
      "icon-image": SQUARE_PUCK_IMAGE_ID,
      "icon-size": expr([
        "interpolate",
        ["linear"],
        ["zoom"],
        8, (11 * 2) / SQUARE_PUCK_SIZE,
        12, (14 * 2) / SQUARE_PUCK_SIZE,
        15, (16 * 2) / SQUARE_PUCK_SIZE,
      ]),
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-color": expr(["get", "color"]),
      "icon-opacity": expr(["get", "opacity"]),
    },
  };

  // Score numeral (or "·" for unscored), color from the feature (white / grey).
  const spotLabelLayer: LayerProps = {
    id: SPOT_LABEL,
    type: "symbol",
    filter: declutterFilter,
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
      // Placement mode: any click drops the pin at the clicked coordinate.
      if (pinDropMode) {
        onMapPick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        return;
      }
      const f = e.features?.[0];
      if (!f) return;
      if (f.layer.id === SPOT_CIRCLE || f.layer.id === SPOT_CUSTOM_SQUARE) {
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
    [onSelect, onSelectStation, pinDropMode, onMapPick],
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
        cursor={pinDropMode ? "crosshair" : cursor}
        onClick={handleClick}
        onLoad={(e) => {
          attachRcaHatch(e.target); // register RCA fill-pattern image (hatch)
          attachSquarePuck(e.target); // register the custom-spot square (SDF icon)
          setMapObj(e.target);
          reportViewport(e.target);
        }}
        onZoom={(e) =>
          setDeclutterZoom(Math.round(e.viewState.zoom * 4) / 4)
        }
        onMoveEnd={(e) => reportViewport(e.target)}
        onResize={(e) => reportViewport(e.target)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
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
          {/* Stroke copy first — it must sit UNDER the square it outlines. */}
          <Layer {...customSquareStrokeLayer} />
          <Layer {...customSquareLayer} />
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
