"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, ChevronLeft } from "lucide-react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/maplibre";
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { attachRcaHatch, ensureRcaHatch } from "@/lib/map/rca-hatch";
import { useFlow } from "../../lib/use-flow";
import {
  attachScorePucks,
  ensureScorePuck,
  PUCK_TIP_OFFSET,
  NO_DATA_LABEL,
} from "../../lib/score-puck";
import type { LiveSpot } from "@/lib/bluecaster/live-spot-types";

/** GeoJSON source + symbol layer that carry this spot's score puck. */
const PUCK_SOURCE = "spot-puck-src";
const PUCK_LAYER = "spot-puck";

type Layer = "bathy" | "satellite" | "currents" | "winds";

// None of the four needs an API key. Satellite runs on Esri's free World
// Imagery tiles; Currents and Winds are our own animated flow fields.
const TABS: [Layer, string][] = [
  ["bathy", "Bathymetry"],
  ["satellite", "Satellite"],
  ["currents", "Currents"],
  ["winds", "Winds"],
];

const SAT_LAYER = "spot-sat";

/**
 * Compact spot map. Reuses the bathymetric relief style, the WebGL flow engine
 * AND the score puck from the Explore map, framed on a single spot.
 * Four tabs: Bathymetry / Satellite (Esri World Imagery, keyless) / Currents /
 * Winds. Currents and Winds are the same animated field overlay on two
 * different sources; Satellite is a raster declared in the style and toggled
 * by visibility.
 */
export default function SpotMiniMap({
  spot,
  score,
  timeIso,
  hideExploreLink = false,
}: {
  spot: LiveSpot;
  score: number | null;
  /** UTC instant both flow tabs are drawn at; null = model "now". */
  timeIso?: string | null;
  /** Drop the corner link out to /explore. Set on the ad frame of the spot
   *  page, where it is an exit sitting on top of the most tappable element on
   *  the page, pointing at a map that sells nothing in particular. */
  hideExploreLink?: boolean;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapObj, setMapObj] = useState<MlMap | null>(null);
  /** The map the styleimagemissing listeners are already on. */
  const imagesAttachedTo = useRef<MlMap | null>(null);
  const [layer, setLayer] = useState<Layer>("bathy");
  const [expanded, setExpanded] = useState(false);

  useFlow({ map: mapObj, kind: "currents", enabled: layer === "currents", timeIso: timeIso ?? null });
  useFlow({ map: mapObj, kind: "wind", enabled: layer === "winds", timeIso: timeIso ?? null });

  // Resize the map when it toggles to/from fullscreen so it fills the container.
  useEffect(() => {
    const t = setTimeout(() => mapObj?.resize(), 60);
    return () => clearTimeout(t);
  }, [expanded, mapObj]);

  // Let Escape collapse the fullscreen map.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const mapStyle = useMemo(
    () =>
      buildReliefStyle(
        typeof window !== "undefined" ? window.location.origin : "",
      ) as unknown as StyleSpecification,
    [],
  );

  // One feature, so the icon id is computed here rather than as a GL
  // expression. Ring is always "sel": this IS the spot the reader chose, and
  // cobalt means the same thing on Explore. The report signals stay off,
  // because they are Pro-gated on the map payload and this page carries no
  // such flag. The shape stays curated ("rd") for the same reason: nothing
  // here tells a viewer's own spot apart from a published one.
  const puckIcon = `rcp:${score ?? NO_DATA_LABEL}:sel:0:rd`;
  const puckData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          id: 0,
          geometry: {
            type: "Point" as const,
            coordinates: [spot.lng, spot.lat] as [number, number],
          },
          properties: {},
        },
      ],
    }),
    [spot.lng, spot.lat],
  );

  // Draw the puck before the layer asks for it, both on the way in and on
  // every hour scrub (the icon id carries the score, so scrubbing asks for an
  // id that has never been drawn).
  //
  // Waiting to be asked does not work. The symbol tile is laid out as soon as
  // the source has data, and an icon missing at that instant is left off the
  // tile; `load` is later still, because it waits on every source in the
  // relief style. Registering from `onLoad` did put the pin back, since
  // `addImage` reloads the tiles that wanted the image, but only once `load`
  // arrived: measured on prod, the map was up at 5.1s on a throttled
  // connection and the pin did not appear until 8.1s.
  const attachMapImages = useCallback(
    (map: MlMap) => {
      if (imagesAttachedTo.current !== map) {
        imagesAttachedTo.current = map;
        // Listeners, once per map. They cover a style reload and any id these
        // two passes could not predict.
        attachScorePucks(map);
        attachRcaHatch(map);
      } else {
        ensureRcaHatch(map); // a style reload drops every registered image
      }
      ensureScorePuck(map, puckIcon);
    },
    [puckIcon],
  );

  useEffect(() => {
    // `mapObj` is not read — it is here so this re-runs once the map exists,
    // since `mapRef` is a ref and changing it re-renders nothing.
    const map = mapRef.current?.getMap();
    if (map) attachMapImages(map);
  }, [attachMapImages, mapObj]);

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-[60] bg-rc-panel"
          : "relative h-72 rounded overflow-hidden border border-rc-rule bg-rc-surface"
      }
    >
      {/* Layer tabs */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              layer === key
                ? "bg-rc-brand text-white"
                : "bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Back to the Explore map — only in the compact view */}
      {!expanded && !hideExploreLink && (
        <Link
          href="/explore"
          aria-label="Back to map"
          className="absolute bottom-2 left-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
      )}

      {/* Expand / collapse — stays on this spot's map; never leaves the page */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse map" : "Expand map"}
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rc-panel/90 text-rc-ink-soft text-[11px] font-semibold hover:bg-rc-panel transition-colors"
      >
        {expanded ? (
          <Minimize2 className="w-3 h-3" />
        ) : (
          <Maximize2 className="w-3 h-3" />
        )}
        {expanded ? "Close map" : "Expand map"}
      </button>

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
        // `styledata`, not `load`: the images have to exist before the first
        // symbol tile is laid out, and `load` waits on every source in the
        // relief style. See the note on attachMapImages.
        onStyleData={(e) => attachMapImages(e.target)}
        onLoad={(e) => {
          attachMapImages(e.target); // no-op if styledata already did it
          setMapObj(e.target);
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Satellite raster — declared so react-map-gl manages it (it reconciles
            the style and would wipe an imperatively-added layer). Renders above
            the relief base; visibility follows the active tab. Esri's free World
            Imagery service — no key required. */}
        <Source
          id={SAT_LAYER}
          type="raster"
          tiles={[
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ]}
          tileSize={256}
          attribution="Esri, Maxar, Earthstar Geographics"
        >
          <Layer
            id={SAT_LAYER}
            type="raster"
            layout={{ visibility: layer === "satellite" ? "visible" : "none" }}
          />
        </Source>

        {/* The same puck Explore draws: pill body, tail on the coordinate,
            score baked into the sprite. Declared last so it paints over the
            satellite raster. */}
        <Source id={PUCK_SOURCE} type="geojson" data={puckData}>
          <Layer
            id={PUCK_LAYER}
            type="symbol"
            layout={{
              "icon-image": puckIcon,
              "icon-anchor": "bottom",
              // Pushes the icon down so the TAIL TIP, not the shadow, lands on
              // the spot.
              "icon-offset": [0, PUCK_TIP_OFFSET],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
