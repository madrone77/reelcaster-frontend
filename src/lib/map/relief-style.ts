// Builder for the bathymetric color-relief + hillshade base style — the Explore
// map's nautical-chart substrate. VERBATIM port of bluecaster's
// lib/bluecaster/map/relief-style.ts so /explore renders at full parity with
// bluecaster's /test/map/1 (same relief raster + contours + land + DFO/RCA/WDFW
// regulatory grids + marine structures + tide stations + border + place labels).
// Keep this in sync with the bluecaster source on any chart change.
//
// Tile hosting: relief raster + contour vector + land PMTiles are read per
// z/x/y by this app's own /api/map/tiles/[set]/{z}/{x}/{y} proxy as immutable
// responses (no pmtiles protocol client-side). The regulatory / marine / tide /
// place GeoJSON + glyph fonts are served same-origin from public/. `origin` is
// passed "" at the call site so every URL is root-relative same-origin.

import { tileUrlTemplate } from "./tile-sets";

const LAND_COLOR = "#EDE490"; // V17 sun-faded lemon land
const LABEL_COLOR = "#33442d"; // Discovery-Island slate-green

// Zoom ranges match the prototype's `hybrid` variant (the dark-deep wide-region
// bake): relief native 10 m at z14, overzoomed for display; contours z9–14.
const RELIEF_MINZOOM = 8;
const RELIEF_MAXZOOM = 14;
const CONTOUR_MINZOOM = 9;
const CONTOUR_MAXZOOM = 14;

const TIER_MINZOOM: Record<number, number> = { 0: 8, 1: 10.5, 2: 12, 3: 13.5, 4: 14.5 };
const TIER_SIZE: Record<number, number> = { 0: 16, 1: 13.5, 2: 12, 3: 11, 4: 10 };

function placeLayers() {
  return [0, 1, 2, 3, 4].map((t) => ({
    id: "places-t" + t,
    type: "symbol",
    source: "places",
    minzoom: TIER_MINZOOM[t],
    filter: ["==", ["get", "tier"], t],
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Open Sans Semibold"],
      "text-size": TIER_SIZE[t],
      "text-letter-spacing": 0.02,
      "text-max-width": 7,
      "text-padding": 6,
      "symbol-sort-key": ["get", "tier"],
    },
    paint: {
      "text-color": LABEL_COLOR,
      "text-halo-color": "rgba(255,255,255,0.92)",
      "text-halo-width": 1.5,
      "text-halo-blur": 0.2,
    },
  }));
}

/**
 * Build the relief base style at full /bathy-relief parity. `origin` is the
 * absolute base URL serving the regulatory/marine/tide/place GeoJSON + glyph
 * fonts (this app's origin); relief/contour/land tiles come from the per-tile
 * proxy regardless of origin. Pass "" for root-relative same-origin URLs.
 *
 * WDFW (Washington) layers are included but start hidden (visibility: "none"),
 * matching the prototype's Canada-first default. CA (DFO + RCA) layers visible.
 */
export function buildReliefStyle(origin: string): Record<string, unknown> {
  const asset = (f: string) => `${origin}/${f}`;
  return {
    version: 8,
    glyphs: `${origin}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      relief: {
        type: "raster",
        tiles: [tileUrlTemplate(origin, "relief-webp-2026-06")],
        tileSize: 256,
        minzoom: RELIEF_MINZOOM,
        maxzoom: RELIEF_MAXZOOM,
      },
      contours: {
        type: "vector",
        tiles: [tileUrlTemplate(origin, "contours-z14-2026-06")],
        minzoom: CONTOUR_MINZOOM,
        maxzoom: CONTOUR_MAXZOOM,
      },
      // Explicit tiles + zoom range (the archive header's z4–14).
      land: { type: "vector", tiles: [tileUrlTemplate(origin, "land-2026-05")], minzoom: 4, maxzoom: 14 },
      subareas: { type: "geojson", data: asset("dfo_subareas_salish.geojson") },
      rca: { type: "geojson", data: asset("rca_salish.geojson") },
      // WA-side counterparts (WDFW): marine-area grid (analog of DFO subareas),
      // MPAs (analog of RCAs). Source: WDFW ArcGIS services.
      wdfwma: { type: "geojson", data: asset("wdfw_marine_areas_salish.geojson") },
      wdfwmpa: { type: "geojson", data: asset("wdfw_mpa_salish.geojson") },
      border: { type: "geojson", data: asset("usca_border_salish.geojson") },
      // Man-made marine features (OSM): breakwaters/jetties, marinas, slips, ramps.
      marine: { type: "geojson", data: asset("marine_features_salish.geojson") },
      // Tide-prediction stations (CHS Canada + NOAA US).
      tides: { type: "geojson", data: asset("tide_stations_salish.geojson") },
      // Weather buoys + C-MAN stations (NOAA NDBC, ECCC/DFO, partner) with
      // live observations — regenerate via BlueCaster scripts/build-buoy-stations.ts.
      buoys: { type: "geojson", data: asset("buoy_stations_salish.geojson") },
      places: { type: "geojson", data: asset("region_places.geojson") },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#AFD2E6" } },
      {
        id: "color-relief",
        type: "raster",
        source: "relief",
        paint: { "raster-resampling": "linear", "raster-fade-duration": 0 },
      },
      {
        id: "contour-line",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        minzoom: 10,
        paint: {
          "line-color": "rgba(20,44,74,0.62)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 0.85],
        },
      },
      {
        id: "contour-labels",
        type: "symbol",
        source: "contours",
        "source-layer": "contours",
        filter: ["==", ["%", ["get", "elev"], 20], 0],
        minzoom: 12,
        layout: {
          "symbol-placement": "line",
          // Pin to the one self-hosted font (we only ship Open Sans Semibold);
          // without this it defaults to "Open Sans Regular" → 404 glyph fetches.
          "text-font": ["Open Sans Semibold"],
          "text-field": ["concat", ["to-string", ["round", ["*", ["abs", ["get", "elev"]], 3.28084]]], " ft"],
          "text-size": 11,
          "text-letter-spacing": 0.05,
          "symbol-spacing": 350,
        },
        paint: { "text-color": "#08233b", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.2 },
      },
      // DFO subarea grid (boundaries + white casing) — drawn under land so the
      // land fill trims onshore edges.
      {
        id: "subarea-lines-casing",
        type: "line",
        source: "subareas",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(255,255,255,0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.0, 14, 3.4],
        },
      },
      {
        id: "subarea-lines",
        type: "line",
        source: "subareas",
        paint: {
          "line-color": "rgba(45,66,96,0.75)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 1.1],
        },
      },
      // WDFW marine-area grid (WA analog of the DFO subarea grid) — teal, hidden
      // by default (Canada-first); consumer toggles for jurisdiction.
      {
        id: "wdfw-ma-casing",
        type: "line",
        source: "wdfwma",
        layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
        paint: {
          "line-color": "rgba(255,255,255,0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.0, 14, 3.4],
        },
      },
      {
        id: "wdfw-ma-lines",
        type: "line",
        source: "wdfwma",
        layout: { visibility: "none" },
        paint: {
          "line-color": "rgba(15,108,108,0.78)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 1.1],
        },
      },
      // Rockfish Conservation Areas.
      { id: "rca-fill", type: "fill", source: "rca", paint: { "fill-color": "#c83b2d", "fill-opacity": 0.14 } },
      {
        id: "rca-outline",
        type: "line",
        source: "rca",
        paint: {
          "line-color": "rgba(176,38,28,0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 14, 1.6],
          "line-dasharray": [3, 2],
        },
      },
      // WDFW Marine Protected Areas (WA analog of RCAs) — teal-green, hidden by default.
      {
        id: "wdfw-mpa-fill",
        type: "fill",
        source: "wdfwmpa",
        layout: { visibility: "none" },
        paint: { "fill-color": "#0f8a6c", "fill-opacity": 0.14 },
      },
      {
        id: "wdfw-mpa-outline",
        type: "line",
        source: "wdfwmpa",
        layout: { visibility: "none" },
        paint: {
          "line-color": "rgba(13,110,86,0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 14, 1.6],
          "line-dasharray": [3, 2],
        },
      },
      // Opaque land on top of relief + regulatory slivers.
      { id: "land", type: "fill", source: "land", "source-layer": "land", paint: { "fill-color": LAND_COLOR, "fill-antialias": true } },
      // --- Man-made marine features (OSM). Drawn ABOVE the land mask so shore-
      //     attached structures (e.g. the Ogden Point breakwater) read over both
      //     water and land. Zoom-gated to limit clutter. ---
      {
        id: "marina-fill",
        type: "fill",
        source: "marine",
        minzoom: 10,
        filter: ["==", ["get", "kind"], "marina"],
        paint: { "fill-color": "rgba(31,64,224,0.10)" },
      },
      {
        id: "marina-line",
        type: "line",
        source: "marine",
        minzoom: 10,
        filter: ["==", ["get", "kind"], "marina"],
        paint: {
          "line-color": "rgba(31,64,224,0.55)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 1.4],
        },
      },
      // Marina slips / docks (OSM man_made=pier, filtered to marina footprints).
      {
        id: "slip-line",
        type: "line",
        source: "marine",
        minzoom: 14,
        filter: ["==", ["get", "kind"], "slip"],
        paint: {
          "line-color": "#7a6f5e",
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 17, 1.8],
        },
      },
      // Breakwaters / major piers: a BOLD solid dark structure line with white
      // casing, distinctly heavier than the thin jurisdiction grid.
      {
        id: "structure-casing",
        type: "line",
        source: "marine",
        minzoom: 9,
        filter: ["match", ["get", "kind"], ["breakwater", "jetty", "pier_structure"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(255,255,255,0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 16, 5.5],
        },
      },
      {
        id: "structure-line",
        type: "line",
        source: "marine",
        minzoom: 9,
        filter: ["match", ["get", "kind"], ["breakwater", "jetty", "pier_structure"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#3a3a3a",
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.1, 16, 3.2],
        },
      },
      {
        id: "ramp-line",
        type: "line",
        source: "marine",
        minzoom: 12,
        filter: ["==", ["get", "kind"], "ramp"],
        paint: {
          "line-color": "#0f7a5f",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 15, 2.4],
        },
      },
      {
        id: "ramp-point",
        type: "circle",
        source: "marine",
        minzoom: 12,
        filter: ["all", ["==", ["get", "kind"], "ramp"], ["==", ["geometry-type"], "Point"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 15, 4.5],
          "circle-color": "#0f7a5f",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      },
      {
        id: "marina-point",
        type: "circle",
        source: "marine",
        minzoom: 10,
        filter: ["all", ["==", ["get", "kind"], "marina"], ["==", ["geometry-type"], "Point"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 5.5],
          "circle-color": "#1F40E0",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.2,
        },
      },
      {
        id: "marina-label",
        type: "symbol",
        source: "marine",
        minzoom: 12.5,
        filter: ["==", ["get", "kind"], "marina"],
        layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Semibold"], "text-size": 11, "text-optional": true, "text-padding": 6 },
        paint: { "text-color": "#16357a", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.3 },
      },
      {
        id: "rca-labels",
        type: "symbol",
        source: "rca",
        minzoom: 11.5,
        layout: { "text-field": ["get", "NAME"], "text-font": ["Open Sans Semibold"], "text-size": 10.5, "text-max-width": 8, "text-padding": 4, "symbol-placement": "point" },
        paint: { "text-color": "#8f1f17", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.4 },
      },
      {
        id: "wdfw-mpa-labels",
        type: "symbol",
        source: "wdfwmpa",
        minzoom: 11.5,
        layout: { "text-field": ["get", "NAME"], "text-font": ["Open Sans Semibold"], "text-size": 10.5, "text-max-width": 8, "text-padding": 4, "symbol-placement": "point", visibility: "none" },
        paint: { "text-color": "#0b5a47", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.4 },
      },
      ...placeLayers(),
      {
        id: "subarea-labels",
        type: "symbol",
        source: "subareas",
        minzoom: 10.5,
        layout: {
          "text-field": ["concat", "DFO Tidal Area ", ["get", "LABEL"]],
          "text-font": ["Open Sans Semibold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10.5, 10, 14, 13],
          "text-padding": 8,
        },
        paint: { "text-color": "#2d4260", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.4, "text-opacity": 0.9 },
      },
      // WDFW marine-area codes — hidden by default (jurisdiction toggle).
      {
        id: "wdfw-ma-labels",
        type: "symbol",
        source: "wdfwma",
        minzoom: 10.5,
        layout: {
          "text-field": ["concat", "WDFW Marine Area ", ["get", "MA_NUM"]],
          "text-font": ["Open Sans Semibold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10.5, 10, 14, 13],
          "text-padding": 8,
          visibility: "none",
        },
        paint: { "text-color": "#0f6c6c", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.4, "text-opacity": 0.9 },
      },
      // International boundary, above land.
      {
        id: "border-casing",
        type: "line",
        source: "border",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(255,255,255,0.9)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.4, 14, 6.0],
        },
      },
      {
        id: "border-line",
        type: "line",
        source: "border",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "rgba(58,46,92,0.92)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.8, 14, 3.2],
          "line-dasharray": [4, 2],
        },
      },
      // Country names ride along the border line, offset to each side.
      {
        id: "country-ca",
        type: "symbol",
        source: "border",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 360,
          "text-field": "Canada",
          "text-font": ["Open Sans Semibold"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.18,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 18],
          "text-offset": [0, 1.1],
          "text-keep-upright": true,
          "text-padding": 4,
        },
        paint: { "text-color": "#2b2350", "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 2.0 },
      },
      {
        id: "country-us",
        type: "symbol",
        source: "border",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 360,
          "text-field": "United States",
          "text-font": ["Open Sans Semibold"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.18,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 18],
          "text-offset": [0, -1.1],
          "text-keep-upright": true,
          "text-padding": 4,
        },
        paint: { "text-color": "#2b2350", "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 2.0 },
      },
      // Tide stations — clickable donut markers; labels at mid-zoom.
      {
        id: "tide-station",
        type: "circle",
        source: "tides",
        minzoom: 9,
        paint: {
          "circle-color": "#ffffff",
          "circle-stroke-color": "#0b6e9c",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 1.6, 14, 3],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.2, 14, 6.5],
        },
      },
      {
        id: "tide-label",
        type: "symbol",
        source: "tides",
        minzoom: 11.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Semibold"],
          "text-size": 11,
          "text-offset": [0, 0.9],
          "text-anchor": "top",
          "text-optional": true,
          "text-padding": 6,
        },
        paint: { "text-color": "#0b5273", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.3 },
      },
      // Weather buoys — clickable amber markers (live wind/wave/water-temp).
      // Visible from further out than tide donuts: only ~18 in the region.
      {
        id: "buoy-marker",
        type: "circle",
        source: "buoys",
        minzoom: 7,
        paint: {
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 7, 1.4, 14, 2.5],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 14, 8],
        },
      },
      {
        id: "buoy-label",
        type: "symbol",
        source: "buoys",
        minzoom: 9.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Semibold"],
          "text-size": 11,
          "text-offset": [0, 0.9],
          "text-anchor": "top",
          "text-optional": true,
          "text-padding": 6,
        },
        paint: { "text-color": "#92400e", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.3 },
      },
    ],
  };
}
