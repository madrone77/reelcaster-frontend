"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Map, {
  Marker,
  Source,
  Layer,
  type LayerProps,
  type MapRef,
} from "react-map-gl/maplibre";
import type { ExpressionSpecification, Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import {
  attachScorePucks,
  ensureScorePucks,
  puckIconId,
  puckIconImageExpr,
  PUCK_TIP_OFFSET,
  NO_DATA_LABEL,
} from "@/app/explore/lib/score-puck";
import { tierFor } from "@/app/explore/lib/explore-data";

const SOURCE_ID = "mk-spots";
const SPOT_PUCK = "mk-spot-puck";

/**
 * Everything in the relief style that is neither bathymetry nor a spot.
 *
 * The regulatory work (RCA hatch, subarea and marine-area boundaries, MPAs)
 * and the station markers are real product features, and on Explore they are
 * the point. On a marketing still they are noise: red polygons and scattered
 * dots that a visitor cannot interpret and did not ask about. Hidden here so
 * the picture says one thing — depth, and where the fish are.
 */
const CLUTTER_LAYERS = new Set([
  "subarea-lines-casing", "subarea-lines", "subarea-labels",
  "wdfw-ma-casing", "wdfw-ma-lines", "wdfw-ma-labels",
  "rca-fill", "rca-outline", "rca-labels",
  "wdfw-mpa-fill", "wdfw-mpa-outline", "wdfw-mpa-labels",
  "tide-station", "tide-label", "buoy-marker", "buoy-label",
  "border-casing", "border-line", "country-ca", "country-us",
]);

/** How many of the best spots the highlight card cycles through, and how long
 *  each one holds. Slow enough to read the card, quick enough to feel alive. */
const FEATURED_COUNT = 5;
const ROTATE_MS = 4200;

const expr = (e: unknown) => e as ExpressionSpecification;

export interface MapSpot {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  score: number | null;
  /** Per-species peak score, keyed by species id. Retained on the type because
   *  the callers build it from the same payload; this map no longer filters. */
  scoresBySpecies: Record<string, number>;
}

/** Plain-English verdict under the score, so the card explains the number. */
function verdictOf(score: number | null): string {
  const t = tierFor(score);
  if (t === "good") return "Good conditions";
  if (t === "fair") return "Worth a look";
  if (t === "poor") return "Slow today";
  return "No live score";
}

/**
 * The marketing map: a still of the real product, not a working copy of it.
 *
 * It draws the same bathymetric relief and the same score pucks Explore does
 * (`buildReliefStyle`, `attachScorePucks`), so the picture cannot drift from
 * the thing it is selling. What it deliberately does NOT carry is Explore's
 * controls — no bathymetry / currents / species chips, no wind overlay, no
 * navigation control — and it does not take pan, zoom or click. A visitor
 * reading the landing page should look at it, not operate it.
 *
 * Instead of controls it cycles a card through the best few spots, anchored to
 * each one in turn, so the scores on screen are explained rather than left as
 * bare numbers.
 */
export default function MarketingMap({
  spots,
  center,
  zoom,
  fallback = null,
}: {
  spots: MapSpot[];
  center: { lat: number; lng: number };
  zoom: number;
  /** Drawn instead of the map once the GPU context is gone. */
  fallback?: ReactNode;
}) {
  const [mapObj, setMapObj] = useState<MlMap | null>(null);
  const mapRef = useRef<MapRef | null>(null);

  /**
   * The GPU can be taken away mid-session.
   *
   * A browser drops a WebGL context whenever it needs the memory back, and a
   * headless crawler rendering on software GL does it routinely. MapLibre
   * responds by tearing its own internals down, so the map object survives as
   * a shell whose style is null. The next React update then hands that shell
   * to react-map-gl's `setProps`, which reads `style._loaded` and throws —
   * and the rotation below guarantees an update every few seconds, so the
   * throw is not merely possible, it is scheduled.
   *
   * Uncaught, that throw reaches Next's global error page, which replaces the
   * document head and turns the whole page into "Application error: a
   * client-side exception has occurred". Google rendered the homepage during
   * one of those windows and indexed the error as the page's description.
   *
   * So the loss is watched for directly: once the context is gone the map is
   * unmounted and the still illustration takes the slot. The boundary in
   * map-section.tsx stays as the backstop for whatever this does not predict.
   */
  const [gpuLost, setGpuLost] = useState(false);

  // Absolute origin is REQUIRED — MapLibre resolves vector-tile URLs inside a
  // Web Worker that can't expand root-relative paths, so contour + land tiles
  // would silently load zero features. Same reason as ExploreMap.
  const mapStyle = useMemo(() => {
    const style = buildReliefStyle(
      typeof window !== "undefined" ? window.location.origin : "",
    );
    // Strip the style back to depth + land in the STYLE ITSELF, rather than
    // hiding the layers once the map has loaded.
    //
    // A layer that is already hidden when the style is parsed is never laid
    // out at all, which buys two things. The red polygons and station dots
    // cannot flash on screen for the second before an effect could hide them.
    // And `rca-fill` never asks for the hatch pattern, which this map has no
    // reason to register: it was the one "could not be loaded" warning left on
    // the homepage console.
    //
    // Unknown ids are simply not found: the style evolves, and a layer that
    // has been renamed should quietly not hide rather than throw and take the
    // homepage's map down with it.
    for (const layer of style.layers as Array<{
      id: string;
      layout?: Record<string, unknown>;
    }>) {
      if (CLUTTER_LAYERS.has(layer.id)) {
        layer.layout = { ...layer.layout, visibility: "none" };
      }
    }
    return style as unknown as StyleSpecification;
  }, []);

  /** The best few, high to low — what the card cycles through. */
  const featured = useMemo(
    () =>
      [...spots]
        .filter((s) => s.score !== null)
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        .slice(0, FEATURED_COUNT),
    [spots],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const featuredCount = featured.length;
  useEffect(() => {
    if (featuredCount < 2 || gpuLost) return;
    const id = window.setInterval(
      () => setActiveIdx((i) => (i + 1) % featuredCount),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [featuredCount, gpuLost]);

  const active = featured[activeIdx] ?? null;
  const activeSlug = active?.slug ?? "__none__";

  const data = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      // Ascending score so the best puck paints last and sits on top.
      features: [...spots]
        .sort((a, b) => (a.score ?? -1) - (b.score ?? -1))
        .map((s, i) => ({
          type: "Feature" as const,
          id: i,
          geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] as [number, number] },
          properties: {
            slug: s.slug,
            label: s.score === null ? NO_DATA_LABEL : String(s.score),
            opacity: s.score === null ? 0.6 : 1,
            // Marketing has no viewer, so no reports and no owned spots: every
            // puck is a plain curated one.
            fresh: 0,
            hot: 0,
            isCustom: 0,
          },
        })),
    }),
    [spots],
  );

  // The featured spot wears the same selected ring Explore gives a chosen spot,
  // built by the same rule so the ids cannot drift from the sprites we draw.
  // Memoised on the slug alone: `icon-image` is a layout property, so rebuilding
  // it every render would relayout every puck on each tick of the rotation.
  const iconImage = useMemo(
    () => expr(puckIconImageExpr(activeSlug)),
    [activeSlug],
  );

  // Draw the sprites before the layer asks for them. A `styleimagemissing`
  // listener alone is too late: the pucks are laid out as soon as the source
  // has data, which on a cold homepage is well before `load` fires, and an
  // icon that was missing then leaves the map bare. Same fix, same reason, as
  // ExploreMap. See ensureScorePucks.
  const puckIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of data.features) ids.add(puckIconId(f.properties, activeSlug));
    return [...ids];
  }, [data, activeSlug]);

  const attachedTo = useRef<MlMap | null>(null);
  const attachMapImages = useCallback(
    (map: MlMap) => {
      if (attachedTo.current !== map) {
        attachedTo.current = map;
        attachScorePucks(map); // backstop for anything unpredicted
      }
      ensureScorePucks(map, puckIds);
    },
    [puckIds],
  );

  useEffect(() => {
    // `mapObj` is not read — it is here so this re-runs once the map exists.
    const map = mapRef.current?.getMap();
    if (map) attachMapImages(map);
  }, [attachMapImages, mapObj]);

  const puckLayer: LayerProps = useMemo(
    () => ({
      id: SPOT_PUCK,
      type: "symbol",
      layout: {
        "icon-image": iconImage,
        "icon-anchor": "bottom",
        "icon-offset": [0, PUCK_TIP_OFFSET],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": expr(["get", "opacity"]) },
    }),
    [iconImage],
  );

  // Keep the featured spot in frame without letting the visitor drive: a slow
  // ease as the card moves on, rather than a jump.
  const first = useRef(true);
  useEffect(() => {
    if (!mapObj || !active || gpuLost) return;
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      mapObj.easeTo({ center: [active.lng, active.lat], duration: 1600 });
    } catch {
      // The map went away between the render and this effect. Nothing to
      // animate, and nothing worth reporting.
      setGpuLost(true);
    }
  }, [mapObj, active, gpuLost]);

  // `webglcontextlost` fires on the canvas itself, ahead of anything MapLibre
  // reports, which is the whole point: React must stop rendering the map
  // before the next update reaches it.
  useEffect(() => {
    if (!mapObj) return;
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = mapObj.getCanvas();
    } catch {
      setGpuLost(true);
      return;
    }
    const onLost = () => setGpuLost(true);
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas?.removeEventListener("webglcontextlost", onLost);
  }, [mapObj]);

  if (gpuLost) return <>{fallback}</>;

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom }}
        mapStyle={mapStyle}
        // A picture, not an instrument: no drag, scroll, keyboard or dblclick.
        interactive={false}
        attributionControl={false}
        ref={mapRef}
        onError={(e) => {
          // MapLibre reports "Failed to initialize WebGL" here when the
          // context could never be created at all, which is the same outcome
          // as losing one: no map, show the still.
          if (/webgl/i.test(String(e?.error?.message ?? ""))) setGpuLost(true);
        }}
        onStyleData={(e) => attachMapImages(e.target)}
        onLoad={(e) => {
          attachMapImages(e.target);
          setMapObj(e.target);
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Source id={SOURCE_ID} type="geojson" data={data}>
          <Layer {...puckLayer} />
        </Source>

        {active && (
          <Marker
            latitude={active.lat}
            longitude={active.lng}
            anchor="bottom"
            // Clear the puck: its pill stands ~40px over the coordinate.
            offset={[0, -46]}
          >
            <div
              key={active.slug}
              className="pointer-events-none w-[248px] rounded border border-rc-rule/60 bg-rc-panel/95 px-3 py-2 shadow-rc-bar backdrop-blur-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                {/* Wraps rather than truncates: spot names run long ("Howe
                    Sound (Pam Rock / Worlcombe)") and a clipped name on a
                    marketing still reads as a bug. */}
                <span className="text-[13px] font-semibold leading-snug text-rc-ink">
                  {active.name}
                </span>
                <span className="shrink-0 font-rc-mono text-[15px] font-bold text-rc-ink">
                  {active.score}
                </span>
              </div>
              <div className="mt-0.5 font-rc-mono text-[10px] uppercase tracking-[0.06em] text-rc-ink-mute">
                {verdictOf(active.score)}
              </div>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}
