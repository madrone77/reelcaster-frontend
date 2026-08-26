"use client";

// The city's marks on real bathymetry, each carrying its score, each naming
// itself under the pointer.
//
// Deliberately NOT the Explore map. That component is a whole application —
// filter chips, drawers, sort, flow fields, decluttering, a mobile sheet — and
// it exists to let somebody work. This is a picture of a city that answers one
// question on hover, on a page whose reader has been here for four seconds and
// has not decided to stay. It shares the style, the palette and the tier
// vocabulary; it shares none of the machinery.
//
// It replaces the Explore-derived map that used to sit lower down the page, so
// a city page still draws exactly one MapLibre canvas.

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapGL, {
  AttributionControl,
  Layer,
  NavigationControl,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { MAP_CUSTOM_ATTRIBUTION } from "@/lib/map/map-brand";
import { tierFor, type Tier } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";
import { bottomLabel, cellAt, chopLabel, phaseAt } from "../hub/hub-data";
import { recognitionLabel, type RankedSpot } from "./featured";

const SPOT_SOURCE = "city-spots";
const SPOT_DOT = "city-spot-dot";
const SPOT_LABEL = "city-spot-label";
const INTERACTIVE = [SPOT_DOT, SPOT_LABEL];

/**
 * Pin fill by tier. Solid, not the soft tint the paper UI uses — a 3% mint
 * wash is invisible over bathymetry, and these dots have to read at a glance
 * against a blue-grey seabed.
 */
const TIER_FILL: Record<Tier, string> = {
  prime: "#15803D",
  good: "#3D8B4F",
  fair: "#C97A1C",
  poor: "#B23A2F",
  none: "#94A3B8",
};

/** Tier word under the score in the tooltip. Same vocabulary as the strip. */
const TIER_WORD: Record<Tier, string> = {
  prime: "Prime",
  good: "Good",
  fair: "Fair",
  poor: "Tough",
  none: "No score",
};

type HoverCard = {
  name: string;
  score: number | null;
  tier: Tier;
  /** "Regularly fished" / "Known mark", or null when the mark has no record
   *  worth printing. Never a count — those are Pro. */
  recognition: string | null;
  peakLabel: string | null;
  /** "Late ebb", "High slack"… at the mark's own peak hour. */
  phase: string | null;
  /** "Light ripple", "Chop"… */
  chop: string | null;
  /** "Rock reef", "Kelp"… the only physical descriptor the product has. */
  bottom: string | null;
  /** Pointer position in container px. */
  x: number;
  y: number;
};

export default function CitySpotMap({
  rows,
  cityLat,
  cityLng,
}: {
  /** Every mark that SCORED today, best-known first. The list above shows a
   *  handful; the map shows all of these, which is the point of it. */
  rows: RankedSpot[];
  cityLat: number;
  cityLng: number;
}) {
  const router = useRouter();
  const mapRef = useRef<MapRef | null>(null);
  const [hover, setHover] = useState<HoverCard | null>(null);

  const mapStyle = useMemo(() => {
    // Absolute origin is REQUIRED — MapLibre builds vector-tile URLs inside a
    // worker that cannot resolve root-relative paths, and the failure is
    // silent (zero features, no error). Same note as the Explore map.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return buildReliefStyle(origin) as unknown as StyleSpecification;
  }, []);

  const bySlug = useMemo(() => {
    const m = new Map<string, RankedSpot>();
    for (const r of rows) m.set(r.spot.slug, r);
    return m;
  }, [rows]);

  const data = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      // Ascending score, so the best mark paints LAST and wins the hover where
      // two dots overlap. Same rule the Explore pins use.
      features: [...rows]
        .sort((a, b) => a.entry.peak - b.entry.peak)
        .map((r, i) => ({
          type: "Feature" as const,
          id: i,
          geometry: {
            type: "Point" as const,
            coordinates: [r.spot.lng, r.spot.lat] as [number, number],
          },
          properties: {
            slug: r.spot.slug,
            label: String(r.entry.peak),
            fill: TIER_FILL[tierFor(r.entry.peak)],
            // Popular marks draw a touch larger. The dot is the only place on
            // this page where a reader can see, without reading anything, that
            // some of these names carry more history than others.
            radius: r.spot.trackRecord === "popular" ? 15 : 12,
          },
        })),
    }),
    [rows],
  );

  /** Frame the whole roster, not the city centre — a city's marks routinely
   *  sit 20 km off the pin the geocoder gave it. */
  const bounds = useMemo((): LngLatBoundsLike | null => {
    if (!rows.length) return null;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const r of rows) {
      w = Math.min(w, r.spot.lng);
      e = Math.max(e, r.spot.lng);
      s = Math.min(s, r.spot.lat);
      n = Math.max(n, r.spot.lat);
    }
    // A single-spot city has zero extent, which fitBounds cannot zoom to.
    if (w === e && s === n) return null;
    return [
      [w, s],
      [e, n],
    ];
  }, [rows]);

  const onMouseMove = useCallback(
    (ev: MapLayerMouseEvent) => {
      const f = ev.features?.[0];
      const slug = f?.properties?.slug as string | undefined;
      const row = slug ? bySlug.get(slug) : undefined;
      if (!row) {
        setHover(null);
        return;
      }
      const { spot, entry } = row;
      const cell = cellAt(spot, entry.peak_hour);
      setHover({
        name: spot.name,
        score: entry.peak,
        tier: tierFor(entry.peak),
        recognition: recognitionLabel(spot),
        peakLabel: formatHour12(entry.peak_hour),
        phase: phaseAt(spot, entry.peak_hour),
        chop: chopLabel(cell),
        bottom: bottomLabel(spot.bottom),
        x: ev.point.x,
        y: ev.point.y,
      });
    },
    [bySlug],
  );

  /**
   * Collapse the attribution to its (i) button.
   *
   * MapLibre's `compact` attribution renders EXPANDED on first paint and only
   * closes once something interacts with the map, so a visitor's first sight
   * of this map is four lines of licence text over the water it is meant to be
   * showing. That is fine on Explore, where somebody is already working the
   * map; it is the wrong first impression on a page bought with an ad click.
   *
   * The control is a `<details>`, so dropping `open` collapses it and fires
   * the toggle handler that clears MapLibre's own `-show` class. Clicking the
   * (i) still opens it, which is what keeps the attribution honoured: it is
   * one tap away, not removed.
   */
  const collapseAttribution = useCallback((container: HTMLElement) => {
    const el = container.querySelector<HTMLDetailsElement>(
      ".maplibregl-ctrl-attrib.maplibregl-compact",
    );
    if (!el) return;
    el.removeAttribute("open");
    el.classList.remove("maplibregl-compact-show");
  }, []);

  const onClick = useCallback(
    (ev: MapLayerMouseEvent) => {
      const slug = ev.features?.[0]?.properties?.slug as string | undefined;
      if (slug) router.push(`/explore/spot/${slug}`);
    },
    [router],
  );

  return (
    // Deliberately tall on desktop, and this is not a styling preference.
    // fitBounds fits BOTH axes, so the roster's narrower axis decides the zoom
    // and the wider one gets the slack. Seattle's marks run 1.1° of latitude
    // and 0.5° of longitude, so a 2:1 letterbox fits the height and then fills
    // the remaining width with inland Washington — which is past the extent of
    // the `land-2026-05` tileset, so it draws as bare background and reads as
    // a broken map. A squarer frame spends that slack on water instead. The
    // tileset extent is a product-wide limit, not something this page can fix;
    // framing is what this page controls.
    <div className="relative h-[420px] lg:h-[640px] rounded overflow-hidden border border-rc-rule">
      <MapGL
        ref={mapRef}
        initialViewState={{ latitude: cityLat, longitude: cityLng, zoom: 9 }}
        mapStyle={mapStyle}
        minZoom={5}
        maxZoom={14}
        interactiveLayerIds={INTERACTIVE}
        cursor={hover ? "pointer" : "grab"}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        onLoad={(e) => {
          collapseAttribution(e.target.getContainer());
          if (bounds) {
            e.target.fitBounds(bounds, {
              padding: { top: 56, bottom: 40, left: 40, right: 40 },
              duration: 0,
              maxZoom: 12,
            });
          }
        }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <AttributionControl
          compact
          position="bottom-right"
          customAttribution={MAP_CUSTOM_ATTRIBUTION}
        />

        <Source id={SPOT_SOURCE} type="geojson" data={data}>
          {/* Two circles: a white collar so a dark pin still reads over deep
              water, and the tier fill inside it. */}
          <Layer
            id={SPOT_DOT}
            type="circle"
            paint={{
              "circle-radius": ["get", "radius"],
              "circle-color": ["get", "fill"],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
              "circle-opacity": 0.95,
            }}
          />
          <Layer
            id={SPOT_LABEL}
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-font": ["Open Sans Semibold"],
              "text-size": 12,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            }}
            paint={{ "text-color": "#FFFFFF" }}
          />
        </Source>
      </MapGL>

      {/* The readout. An HTML card rather than a MapLibre Popup: a popup is a
          map ANCHOR, so it re-projects on every frame of a pan and lags the
          cursor by a frame. This is pinned to the pointer in container px. */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-[210px] rounded border border-rc-rule bg-rc-panel shadow-lg px-3 py-2"
          style={{
            // Flip to the other side of the cursor near the right/bottom edge
            // so the card never hangs off the map.
            left: hover.x > 240 ? hover.x - 222 : hover.x + 14,
            top: hover.y > 200 ? hover.y - 118 : hover.y + 14,
          }}
        >
          <div className="text-[13px] font-semibold text-rc-ink leading-tight">
            {hover.name}
          </div>
          {hover.recognition && (
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-rc-ink-soft mt-0.5">
              {hover.recognition}
            </div>
          )}
          <div className="flex items-baseline gap-2 mt-1.5">
            <span
              className="text-[24px] font-bold leading-none tracking-[-0.04em]"
              style={{ color: TIER_FILL[hover.tier] }}
            >
              {hover.score ?? "—"}
            </span>
            <span className="font-rc-mono text-[10px] text-rc-ink-soft">
              {TIER_WORD[hover.tier]}
              {hover.peakLabel ? ` · peaks ${hover.peakLabel}` : ""}
            </span>
          </div>
          {(hover.phase || hover.chop || hover.bottom) && (
            <div className="font-rc-mono text-[10px] text-rc-ink-soft mt-1 leading-snug">
              {[hover.phase, hover.chop, hover.bottom]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
