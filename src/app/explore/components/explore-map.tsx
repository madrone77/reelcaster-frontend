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
import { buildReliefStyle, buildSummaryStyle } from "@/lib/map/relief-style";
import { attachRcaHatch } from "@/lib/map/rca-hatch";
import { attachScorePucks, PUCK_TIP_OFFSET } from "../lib/score-puck";
import { MAP_CUSTOM_ATTRIBUTION, MapBrandLogo } from "@/lib/map/map-brand";
import { MAP_INSET_ATTR, mapBottomPanelInset } from "../lib/sheet-safe-center";
import { spotsToFeatureCollection, declutterHiddenSlugs } from "../lib/spot-geojson";
import { useCurrentsFlow } from "../lib/use-currents-flow";

const SOURCE_ID = "bc-spots";
// One layer for every spot now: the body, tail, numeral and ring are all baked
// into the sprite. Shape still marks ownership: a wide rounded pill for curated
// spots, a square one for the viewer's own.
const SPOT_PUCK = "bc-spot-puck";
// Relief-style layers (tide donuts + weather buoys). Spot circles are React
// layers added after the style, so they render on top and win overlap clicks.
const TIDE_STATION = "tide-station";
const BUOY_MARKER = "buoy-marker";

const INTERACTIVE = [SPOT_PUCK, TIDE_STATION, BUOY_MARKER];
// Summary style ships no tide/buoy layers; querying a layer id that isn't in the
// style throws inside queryRenderedFeatures on every mouse move.
const INTERACTIVE_SUMMARY = [SPOT_PUCK];

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
  showBrand = true,
  summary = false,
  showReports = false,
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
  /** Show the ReelCaster brand watermark. Off for summary maps (dashboard). */
  showBrand?: boolean;
  /** Summary mode: land + labels only, no chart substrate and no station
   *  markers. Skips ~2.8 MB of GeoJSON parsing that a "where are my spots"
   *  overview never draws. Implies relief/contours off. */
  summary?: boolean;
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
  /**
   * Whether this viewer may see which spots have catch reports. Gates the
   * Pro-only "Hot" tag and the emerald collar together. Off by default so a
   * surface with no tier to resolve (the public city pages) cannot show them
   * by omission.
   */
  showReports?: boolean;
}) {
  const [cursor, setCursor] = useState<string>("");
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

  // On a phone the spot sheet floats over the map's bottom edge, so the chrome
  // anchored there (zoom, ⓘ, watermark) sits underneath it. Measure how much of
  // the pane the sheet covers at rest and hand it to CSS, the mobile twin of the
  // fixed --rc-map-inset the desktop forecast strip uses.
  const [sheetInset, setSheetInset] = useState(0);
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    let tries = 0;

    const measure = () => {
      setSheetInset(mapBottomPanelInset(root.querySelector(".maplibregl-map") ?? root));
    };

    // The sheet mounts, then measures its own header before it settles on a
    // resting height, so the first frame's answer is not the final one. Watch it
    // once it exists and keep looking for a second or so until it does — on a
    // slow first paint the map is ready well before the sheet is.
    const attach = () => {
      measure();
      const panel = document.querySelector(`[${MAP_INSET_ATTR}="bottom"]`);
      if (panel && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(measure);
        ro.observe(panel);
        return;
      }
      if (tries++ < 60) raf = requestAnimationFrame(attach);
    };
    attach();

    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

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
  const mapStyle = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const build = summary ? buildSummaryStyle : buildReliefStyle;
    return build(origin) as unknown as StyleSpecification;
  }, [summary]);

  const data = useMemo(
    () => spotsToFeatureCollection(spots, hour, showReports),
    [spots, hour, showReports],
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

  // Selection drives which puck sprite a feature asks for. Hover is deliberately
  // absent: `icon-image` is a LAYOUT property, so swapping it on every mouse
  // move would relayout the whole symbol layer, and the hover already reads
  // through the rail card and the cursor change.
  const sel = selectedSlug ?? "__none__";

  // One symbol layer for every spot, curated or custom. The pill, its tail, the
  // score numeral and the ring are all baked into the sprite (see
  // lib/score-puck.ts), which is why this replaced four layers: a circle, an
  // SDF square, that square's scaled stroke copy, and a shared text layer.
  //
  // Ownership still reads through SHAPE, exactly as the square carried it:
  // `rd` is a wide rounded pill for curated spots, `sq` a square one for the
  // viewer's own. Colour stays spoken for by the score ramp.
  //
  // The tail tip sits PUCK_TIP_OFFSET above the sprite's bottom edge (the drop
  // shadow needs the room), so the icon is nudged down by that much to land the
  // tip exactly on the spot rather than the shadow.
  const spotPuckLayer: LayerProps = {
    id: SPOT_PUCK,
    type: "symbol",
    filter: expr(declutterFilter),
    layout: {
      "icon-image": expr([
        "concat",
        "rcp:", ["get", "label"], ":",
        [
          "case",
          ["==", ["get", "slug"], sel], "sel",
          ["==", ["get", "fresh"], 1], "fresh",
          "base",
        ],
        ":", ["to-string", ["get", "hot"]],
        ":", ["case", ["==", ["get", "isCustom"], 1], "sq", "rd"],
      ]),
      "icon-anchor": "bottom",
      "icon-offset": [0, PUCK_TIP_OFFSET],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "icon-opacity": expr(["get", "opacity"]) },
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
      if (f.layer.id === SPOT_PUCK) {
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

  // Hover: pointer cursor only. The puck no longer thickens on hover — its
  // sprite is chosen by a LAYOUT property, so swapping it per mouse move would
  // relayout every symbol on the map; the rail card carries the feedback.
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    setCursor(e.features?.[0] ? "pointer" : "");
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursor("");
  }, []);

  return (
    <div
      ref={wrapRef}
      className="rc-explore-map absolute inset-0"
      style={
        {
          "--rc-map-inset": stripVisible ? "128px" : "0px",
          "--rc-map-sheet-inset": `${sheetInset}px`,
        } as CSSProperties
      }
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
        interactiveLayerIds={summary ? INTERACTIVE_SUMMARY : INTERACTIVE}
        cursor={pinDropMode ? "crosshair" : cursor}
        onClick={handleClick}
        onLoad={(e) => {
          // The hatch is only referenced by rca-fill, which the summary style
          // omits entirely.
          if (!summary) attachRcaHatch(e.target); // RCA fill-pattern image
          attachScorePucks(e.target); // draw puck sprites on demand
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

        {OWM_KEY && !summary && (
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
          <Layer {...spotPuckLayer} />
        </Source>

      </Map>

      {/* Brand watermark — bottom-right corner, with the ⓘ acknowledgments
          inline to its left on the same vertical midline (the ctrl container
          is positioned via globals.css, keyed to these logo sizes).
          Both ride above whatever floats over the map's bottom edge: the
          forecast strip on desktop, the spot sheet on a phone. */}
      {showBrand && (
        <>
          <div
            className="lg:hidden pointer-events-none absolute right-2.5 z-10"
            style={{ bottom: "calc(var(--rc-map-sheet-inset, 0px) + 10px)" }}
          >
            <MapBrandLogo width={52} />
          </div>
          <div
            className="hidden lg:block pointer-events-none absolute right-2.5 z-10"
            style={{ bottom: "calc(var(--rc-map-inset, 0px) + 10px)" }}
          >
            <MapBrandLogo width={60} />
          </div>
        </>
      )}
    </div>
  );
}
