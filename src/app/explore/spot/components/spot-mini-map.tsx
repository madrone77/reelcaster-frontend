"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, ChevronLeft } from "lucide-react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/maplibre";
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { attachRcaHatch, ensureRcaHatch } from "@/lib/map/rca-hatch";
import { useFlow, useFlowLayer, type FlowKind } from "../../lib/use-flow";
import {
  attachScorePucks,
  ensureScorePuck,
  PUCK_TIP_OFFSET,
  NO_DATA_LABEL,
} from "../../lib/score-puck";
import MapHourBar from "./map-hour-bar";
import type { LiveSpot, SunHours } from "@/lib/bluecaster/live-spot-types";

/** GeoJSON source + symbol layer that carry this spot's score puck. */
const PUCK_SOURCE = "spot-puck-src";
const PUCK_LAYER = "spot-puck";

/** The base map under everything. Exactly one of these is always showing. */
type Base = "bathy" | "satellite";

// Neither needs an API key: satellite runs on Esri's free World Imagery tiles.
const BASE_TABS: [Base, string][] = [
  ["bathy", "Bathymetry"],
  ["satellite", "Satellite"],
];

// Currents and Winds are our own animated flow fields, and they behave
// differently from the two above: at most one runs at a time, and clicking the
// one already running turns it off and hands the map back to whichever base
// tab was chosen before. All four used to be one radio group, so "stop the
// animation" was impossible to ask for, and a reader who had picked Satellite
// lost it for good the moment they looked at the tide.
const FLOW_TABS: [FlowKind, string][] = [
  ["currents", "Currents"],
  ["wind", "Winds"],
];

const SAT_LAYER = "spot-sat";

const TAB = "px-2 py-1 rounded text-[10px] font-semibold transition-colors";
const TAB_ON = "bg-rc-brand text-white";
const TAB_OFF = "bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel";

/**
 * Compact spot map. Reuses the bathymetric relief style, the WebGL flow engine
 * AND the score puck from the Explore map, framed on a single spot.
 * Four tabs: Bathymetry / Satellite (Esri World Imagery, keyless) / Currents /
 * Winds. Currents and Winds are the same animated field overlay on two
 * different sources; Satellite is a raster declared in the style and toggled
 * by visibility.
 */
/**
 * The scrubber's half of the props. Optional as a group: the ad frame and any
 * other caller that has no hourly series still gets the map, just without the
 * time bar (and so without a flow field that claims an hour it can't name).
 */
export type SpotMapHours = {
  hour: number;
  onSelectHour: (hour: number) => void;
  nowHour: number;
  isToday: boolean;
  scrubbed: boolean;
  onNow: () => void;
  /** "Wed" when the strip is on another day, null on today. */
  dayLabel: string | null;
  scores: (number | null)[] | null;
  wind: (number | null)[];
  gust: (number | null)[];
  windDir: (number | null)[];
  /** Signed knots, +flood / −ebb. */
  current: (number | null)[] | null;
  sun: SunHours;
};

export default function SpotMiniMap({
  spot,
  score,
  timeIso,
  hours,
  hideExploreLink = false,
}: {
  spot: LiveSpot;
  score: number | null;
  /** UTC instant both flow tabs are drawn at; null = model "now". */
  timeIso?: string | null;
  /** Hourly series + scrub wiring for the time bar. Omit to hide the bar. */
  hours?: SpotMapHours;
  /** Drop the corner link out to /explore. Set on the ad frame of the spot
   *  page, where it is an exit sitting on top of the most tappable element on
   *  the page, pointing at a map that sells nothing in particular. */
  hideExploreLink?: boolean;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapObj, setMapObj] = useState<MlMap | null>(null);
  /** The map the styleimagemissing listeners are already on. */
  const imagesAttachedTo = useRef<MlMap | null>(null);
  const [base, setBase] = useState<Base>("bathy");
  const { flow, currents, wind, toggleCurrents, toggleWind } = useFlowLayer();
  const [expanded, setExpanded] = useState(false);
  // Tracks the same 1024px line the layout uses, because that is the line the
  // map's shape changes on: below it the map is full-bleed, above it it is a
  // boxed column. Starts false so the server and the first client render
  // agree; the effect corrects it on mount.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width:1024px)");
    const sync = () => setPhone(!mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useFlow({ map: mapObj, kind: "currents", enabled: currents, timeIso: timeIso ?? null });
  useFlow({ map: mapObj, kind: "wind", enabled: wind, timeIso: timeIso ?? null });

  // Resize the map when it toggles to/from fullscreen so it fills the container.
  useEffect(() => {
    const t = setTimeout(() => mapObj?.resize(), 60);
    return () => clearTimeout(t);
  }, [expanded, mapObj]);

  // Let Escape collapse the fullscreen map, and hold the page still behind it.
  // Expanding is now a phone's only way into a map it can drag, so the page
  // underneath must not drift while a finger works the map on top of it.
  // Without the lock you collapse the map and land somewhere you never scrolled
  // to.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
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

  // The time bar only makes sense over a field that HAS a time. Bathymetry and
  // satellite are the same picture at 4am and 4pm, and a clock over them would
  // be an instrument reading nothing.
  const barOn = flow != null && !!hours;

  // A phone's inline map is a picture, not something you drive.
  //
  // It runs full-bleed at 45svh, so it spans the entire screen width with no
  // page left beside it to put a thumb on, and MapLibre pans on one finger by
  // default. Together those ate the scroll. Measured on prod at 390x664: a
  // swipe starting on the map moved the page 0px, while the same swipe just
  // below it moved 326px. The map lands directly under the fold and 86% of the
  // page sits below it, so for anyone whose thumb came down on the map the page
  // simply stopped, and everything under it read as not existing.
  //
  // So below `lg` the inline map takes no gestures at all and a tap expands it
  // instead. Expanded it is fullscreen, there is nothing behind it to scroll,
  // and every gesture comes back. Desktop is untouched: there the map is a
  // boxed column with page either side of it to scroll on.
  const inert = phone && !expanded;

  // Set on the map object rather than passed to <Map>, because whether
  // react-map-gl re-applies these after construction is a detail of its
  // version and this has to hold on every flip of `expanded`. The handlers
  // each carry their own enable/disable, so this is the whole switch.
  useEffect(() => {
    if (!mapObj) return;
    const flip = inert ? "disable" : "enable";
    mapObj.dragPan[flip]();
    mapObj.dragRotate[flip]();
    mapObj.touchZoomRotate[flip]();
    mapObj.touchPitch[flip]();
    mapObj.doubleClickZoom[flip]();
  }, [mapObj, inert]);

  // The corner controls sit on the map's bottom edge, which is where the bar
  // docks. Lift them clear rather than letting the bar cover them.
  const cornerBottom = barOn ? "bottom-[74px]" : "bottom-2";

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-[60] bg-rc-panel"
          : // On a phone the map breaks the page gridline and runs to both
            // edges, at 45svh rather than the boxed 288px. As a card it was a
            // thumbnail with a white gutter down either side, and the floating
            // tab bar spent its life sitting on that gutter — the one thing on
            // the page that read as a hole rather than as water. Full width, it
            // is a surface the rest of the page scrolls over, and the bar
            // floats on the map the way it does on Explore.
            //
            // `svh`, not `dvh`: the map must not re-measure itself every time
            // mobile Safari collapses its URL bar mid-scroll. The small
            // viewport unit is the one height that holds still.
            //
            // 45svh, down from the 60svh it shipped at. At 60 the map plus
            // the tab bar over it was very nearly the whole screen, so the
            // sections under it read as an edge rather than as more page.
            // A quarter off leaves the map big enough to orient by and puts
            // roughly half the screen back on the content below it.
            //
            // Desktop is untouched — it sits in a two-column band beside the
            // score, where a full-bleed map would have nothing to be beside.
            "relative -mx-4 h-[45svh] overflow-hidden border-y border-rc-rule bg-rc-surface sm:-mx-6 lg:mx-0 lg:h-72 lg:rounded lg:border"
      }
    >
      {/* Layer tabs: base map first, then the two flow overlays. */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1">
        {BASE_TABS.map(([key, label]) => {
          // Lit only when it is what the map is actually showing. A running
          // flow covers the base, so nothing here claims to be on until the
          // flow is switched off and the remembered base comes back.
          const on = !flow && base === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setBase(key)}
              aria-pressed={on}
              className={`${TAB} ${on ? TAB_ON : TAB_OFF}`}
            >
              {label}
            </button>
          );
        })}
        {FLOW_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={key === "currents" ? toggleCurrents : toggleWind}
            aria-pressed={flow === key}
            className={`${TAB} ${flow === key ? TAB_ON : TAB_OFF}`}
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
          className={`absolute ${cornerBottom} left-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-rc-panel/90 text-rc-ink-soft hover:bg-rc-panel transition-colors`}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
      )}

      {/* Expand / collapse — stays on this spot's map; never leaves the page */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse map" : "Expand map"}
        className={`absolute ${cornerBottom} right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rc-panel/90 text-rc-ink-soft text-[11px] font-semibold hover:bg-rc-panel transition-colors`}
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
            // Hidden while a flow runs. The raster sits on top of the whole
            // style, so leaving it up would bury the flow, and dropping it
            // below the flow instead would put the land mask over the imagery
            // at every shoreline. A flow therefore shows over the relief base,
            // and the chosen base comes back the moment the flow is off.
            layout={{
              visibility: base === "satellite" && !flow ? "visible" : "none",
            }}
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

      {/* Tap target over the inert map. The handlers above are already off, so
          the canvas takes no touches either way; this is here to give the map
          back something to do, since a map that answers nothing at all reads as
          broken rather than as deliberate. A swipe that scrolls the page does
          not fire a click, so scrolling past the map stays free.

          Under the controls at z-10, so the layer tabs, the Explore link, the
          expand button and the hour bar all keep taking their own taps. Hidden
          from the accessibility tree and untabbable on purpose: the labelled
          "Expand map" button is this same action, and one control per action is
          enough to offer. */}
      {inert && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setExpanded(true)}
          className="absolute inset-0 z-[5]"
        />
      )}

      {/* The hour the two flow fields are drawn at, and the control for it.
          Docked inside the map rather than under it so the field, its reading
          and its clock are one instrument — and so the reader never has to
          scroll a thousand pixels to the 24h chart to change what the map is
          showing. Same component and same shared hour on both breakpoints. */}
      {barOn && hours && flow && (
        <MapHourBar
          kind={flow}
          hour={hours.hour}
          onSelectHour={hours.onSelectHour}
          nowHour={hours.nowHour}
          isToday={hours.isToday}
          scrubbed={hours.scrubbed}
          onNow={hours.onNow}
          dayLabel={hours.dayLabel}
          scores={hours.scores}
          wind={hours.wind}
          gust={hours.gust}
          windDir={hours.windDir}
          current={hours.current}
          sun={hours.sun}
        />
      )}
    </div>
  );
}
