"use client";

// The city's marks on real bathymetry, each carrying its score, each naming
// itself under the pointer.
//
// Deliberately NOT the Explore map. That component is a whole application —
// filter chips, drawers, sort, flow fields, a mobile sheet — and it exists to
// let somebody work. This is a picture of a city that answers one question on
// hover, on a page whose reader has been here for four seconds and has not
// decided to stay.
//
// What it DOES share is everything a mark looks like: the style, the palette,
// the tier vocabulary, the score puck and the screen-space declutter behind
// it. A reader who scrolls this map and then opens Explore should be looking
// at the same pins, not at a second dialect of them.
//
// It replaces the Explore-derived map that used to sit lower down the page, so
// a city page still draws exactly one MapLibre canvas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapGL, {
  AttributionControl,
  Layer,
  NavigationControl,
  Source,
  type LayerProps,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type {
  ExpressionSpecification,
  LngLatBoundsLike,
  Map as MlMap,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildReliefStyle } from "@/lib/map/relief-style";
import { MAP_CUSTOM_ATTRIBUTION } from "@/lib/map/map-brand";
import { TIER_PIN, tierFor, type Tier } from "@/app/explore/lib/explore-data";
import {
  attachScorePucks,
  ensureScorePucks,
  puckIconId,
  puckIconImageExpr,
  PUCK_TIP_OFFSET,
} from "@/app/explore/lib/score-puck";
import { declutterHiddenSlugs } from "@/app/explore/lib/spot-geojson";
import { formatHour12 } from "@/lib/time-format";
import { bottomLabel, cellAt, chopLabel, phaseAt } from "../hub/hub-data";
import { recognitionLabel, type RankedSpot } from "./featured";
import { legacySpotPath } from "@/lib/paths";

const SPOT_SOURCE = "city-spots";
const SPOT_PUCK = "city-spot-puck";
const INTERACTIVE = [SPOT_PUCK];

const expr = (e: unknown) => e as ExpressionSpecification;

/**
 * The zoom below which this stops being a chart.
 *
 * The relief raster is `minzoom: 8` and every place-label tier starts at 8, so
 * under 9 the seabed is an overzoomed smear and the map carries no names at
 * all — the reader cannot tell which water they are being shown, directly
 * under a heading that promises the banks and drop-offs of their own city.
 * Vancouver was opening at 7.18 on a phone, which is where the blob came from.
 *
 * ⚠ 9 is the floor for RELIEF AND NAMES, not for soundings. `contour-line` is
 * `minzoom: 10` — the LAYER, not its source, which starts at 9 and reads like
 * the answer without being it. So the depth contours only draw from 10, and
 * this opens one stop under them: the shaded relief still shows the banks and
 * the drop-offs, but the hairlines are a pinch away. Raising this to 10 buys
 * them at the cost of the frame no longer holding the city's name, which on a
 * 291px phone column is the trade, not a bug to fix. Same substrate rule the
 * baked hero reels follow.
 *
 * Nothing stops a reader zooming out past it. This is only where we open.
 */
const CHART_FLOOR_ZOOM = 9;

/**
 * Share of the roster the opening frame may leave outside it.
 *
 * A city's marks are not evenly spread: Vancouver's 40 run 30 within 32 km of
 * downtown and then a tail out to 70 km (Gulf Islands, Sechelt). Fitting the
 * full extent lets those last few cost every reader 1.3 zoom levels, which on
 * a phone is the difference between a chart and a blob. The tail is still
 * DRAWN and still one pinch away — it just does not get to pick the frame.
 */
const FIT_TRIM = 0.15;

/** Tier word under the score in the tooltip. Same vocabulary as the strip. */
const TIER_WORD: Record<Tier, string> = {
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

/**
 * The centre that holds the most marks at a given zoom — where the city is
 * busiest, rather than the middle of its bounding box.
 *
 * Candidates are the marks themselves, so the answer is always real water with
 * a mark on it, and 40 of them is 1,600 comparisons done once on load. Ties go
 * to the candidate nearest the city pin, which is what keeps a city whose
 * marks bunch evenly in two places from opening on the one that is not the
 * city.
 */
function busiestCenter(
  rows: RankedSpot[],
  zoom: number,
  boxW: number,
  boxH: number,
  cityLng: number,
  cityLat: number,
): { lng: number; lat: number } | null {
  if (rows.length < 2) return null;
  const worldPx = 512 * 2 ** zoom;
  const degPerPx = 360 / worldPx;
  // Count inside 80% of the viewport, so a mark only counts when its puck is
  // clear of the edge rather than half off it.
  const halfLng = (boxW / 2) * degPerPx * 0.8;
  // A degree of latitude covers more pixels than a degree of longitude by
  // 1/cos(lat), so the same pixel budget buys fewer degrees of it.
  const halfLat =
    (boxH / 2) * degPerPx * Math.cos((cityLat * Math.PI) / 180) * 0.8;

  const kx = Math.cos((cityLat * Math.PI) / 180);
  let best: { lng: number; lat: number } | null = null;
  let bestCount = -1;
  let bestAway = Infinity;
  for (const cand of rows) {
    const { lng, lat } = cand.spot;
    let count = 0;
    for (const r of rows) {
      if (
        Math.abs(r.spot.lng - lng) <= halfLng &&
        Math.abs(r.spot.lat - lat) <= halfLat
      ) {
        count++;
      }
    }
    const away = Math.hypot((lng - cityLng) * kx, lat - cityLat);
    if (count > bestCount || (count === bestCount && away < bestAway)) {
      best = { lng, lat };
      bestCount = count;
      bestAway = away;
    }
  }
  return best;
}

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
  const [mapObj, setMapObj] = useState<MlMap | null>(null);
  // Zoom snapshot for the declutter, quantised to quarter-steps so the hidden
  // set recomputes a few times per pinch rather than every frame. Overlap
  // depends on zoom alone here — no rotation, and panning cannot change it.
  const [declutterZoom, setDeclutterZoom] = useState(CHART_FLOOR_ZOOM);

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
      // two pucks still touch. Same rule the Explore pins use.
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
            // Carried so a click can navigate to the mark's OWN city, which is
            // not always the city this map belongs to.
            path: r.spot.path ?? '',
            label: String(r.entry.peak),
            // Both report signals stay off. They are Pro-gated on Explore, and
            // this body is public and CDN-cached, so it cannot resolve a tier
            // to gate them on — the same reason `spotsToFeatureCollection`
            // defaults `showReports` to false.
            fresh: 0,
            hot: 0,
            // Every mark here is curated, so every puck is the rounded pill.
            // `sq` is not a styling choice on this shape: it means the viewer
            // created the spot, and nothing on a city page did.
            isCustom: 0,
          },
        })),
    }),
    [rows],
  );

  // ── Draw the pucks before the map asks for them ─────────────────────────
  //
  // A symbol tile is laid out the moment its source has data, and any icon
  // missing at that instant is left off the tile for good. Registering from
  // the feature list has no such window; `addImage` also reloads a tile that
  // already went out bare, so a late pass still repairs itself. Same contract
  // as the Explore map, and the same bug if it is skipped: a map that opens
  // with no pins until something makes it retile.
  const puckIds = useMemo(
    () => [...new Set(data.features.map((f) => puckIconId(f.properties, null)))],
    [data],
  );

  useEffect(() => {
    // `mapObj` is not read — it is a dependency so this re-runs once the map
    // exists, since `mapRef` is a ref and setting it re-renders nothing.
    const map = mapRef.current?.getMap();
    if (map) ensureScorePucks(map, puckIds);
  }, [puckIds, mapObj]);

  const imagesAttachedTo = useRef<MlMap | null>(null);
  const attachMapImages = useCallback(
    (map: MlMap) => {
      if (imagesAttachedTo.current !== map) {
        imagesAttachedTo.current = map;
        attachScorePucks(map);
      }
      ensureScorePucks(map, puckIds);
    },
    [puckIds],
  );

  // Overlapping marks: hide the lower-scored puck at this zoom, and let it
  // reappear as the pair separates. Vancouver stacks eight inside the harbour
  // at any zoom that also holds Howe Sound, and a stack of half-numerals is
  // worse than one clean one.
  const hiddenSlugs = useMemo(
    () =>
      declutterHiddenSlugs(
        rows.map((r) => ({
          slug: r.spot.slug,
          lat: r.spot.lat,
          lng: r.spot.lng,
          score: r.entry.peak,
        })),
        null,
        declutterZoom,
        null,
      ),
    [rows, declutterZoom],
  );

  /**
   * Frame the roster's CORE, not the city centre and not its full extent.
   *
   * Not the centre, because a city's marks routinely sit 20 km off the pin the
   * geocoder gave it. Not the full extent either: fitBounds fits the outermost
   * mark in every direction, so the furthest few decide the zoom for all of
   * them. Dropping the outer `FIT_TRIM` by distance from the median mark is
   * what buys back the zoom, and it costs nothing a pinch does not undo.
   */
  const bounds = useMemo((): LngLatBoundsLike | null => {
    if (rows.length < 2) return null;
    const pts = rows.map((r) => [r.spot.lng, r.spot.lat] as [number, number]);

    // Median rather than mean: the tail is exactly what must not move the
    // point everything is measured from.
    const median = (xs: number[]) => {
      const sorted = [...xs].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const mLng = median(pts.map((q) => q[0]));
    const mLat = median(pts.map((q) => q[1]));
    // Longitude degrees are narrower this far north, so weight them by the
    // latitude before comparing the two axes.
    const kx = Math.cos((mLat * Math.PI) / 180);
    const away = (q: [number, number]) =>
      Math.hypot((q[0] - mLng) * kx, q[1] - mLat);

    const core = [...pts]
      .sort((a, b) => away(a) - away(b))
      .slice(0, Math.max(2, Math.ceil(pts.length * (1 - FIT_TRIM))));

    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [lng, lat] of core) {
      w = Math.min(w, lng);
      e = Math.max(e, lng);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
    // Co-located marks give zero extent, which fitBounds cannot zoom to.
    if (w === e && s === n) return null;
    return [
      [w, s],
      [e, n],
    ];
  }, [rows]);

  /**
   * Open on the core, then refuse to sit below the chart's own floor.
   *
   * The padding scales with the box because a flat 40px is a sixth of a phone
   * column: at 291px wide it left 211px to hold 74 km of water, which is where
   * the blob came from. `fitBounds` has a `maxZoom` and no floor of its own,
   * so the floor is applied after it.
   *
   * Raising the zoom keeps `fitBounds`' centre, and that centre is the middle
   * of a BOX, which is nobody's water. Vancouver's core bbox centres on Bowen
   * Island, so a floored frame opened on an empty channel with the city itself
   * off the bottom corner. When the floor bites, the centre is re-chosen for
   * the marks instead.
   */
  const frameToRoster = useCallback(
    (map: MlMap) => {
      if (!bounds) {
        setDeclutterZoom(Math.round(map.getZoom() * 4) / 4);
        return;
      }
      const box = map.getContainer();
      const pad = Math.max(
        10,
        Math.round(Math.min(box.clientWidth, box.clientHeight) * 0.06),
      );
      map.fitBounds(bounds, {
        // Extra at the top so a puck's body, which sits above its tail tip,
        // is never half off the edge.
        padding: { top: pad + 20, bottom: pad, left: pad, right: pad },
        duration: 0,
        maxZoom: 12,
      });
      if (map.getZoom() < CHART_FLOOR_ZOOM) {
        map.setZoom(CHART_FLOOR_ZOOM);
        const c = busiestCenter(
          rows,
          CHART_FLOOR_ZOOM,
          box.clientWidth,
          box.clientHeight,
          cityLng,
          cityLat,
        );
        if (c) map.setCenter(c);
      }
      setDeclutterZoom(Math.round(map.getZoom() * 4) / 4);
    },
    [bounds, rows, cityLat, cityLng],
  );

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
      const props = ev.features?.[0]?.properties as
        | { slug?: string; path?: string }
        | undefined;
      const slug = props?.slug;
      // `path` rides on the feature for the same reason city-shell looks one
      // up: the map draws marks homed in other cities.
      if (slug) router.push(props?.path || legacySpotPath(slug));
    },
    [router],
  );

  /**
   * One symbol layer for every mark: the same score puck Explore draws, with
   * the pill, its tail, the numeral and the ring all baked into the sprite.
   *
   * It replaces a circle plus a text layer, and the point is not decoration.
   * A disc has no tail, so at this many marks over this much water there was
   * nothing saying WHICH pixel each number belonged to; a puck points at its
   * own coordinate. It is also the marker a reader meets again the moment they
   * open Explore, which is the next thing this page asks them to do.
   *
   * The one signal lost is size: the old dot drew larger for a regularly
   * fished mark. A puck is a constant size at every zoom, which is what keeps
   * the baked numeral crisp, so recognition now reads only where it always
   * read in words — the badge in the hover card, and the list above the map.
   *
   * The tail tip sits PUCK_TIP_OFFSET above the sprite's bottom edge (the drop
   * shadow needs the room), so the icon is nudged down by that much to land
   * the tip on the mark rather than the shadow.
   */
  const spotPuckLayer: LayerProps = {
    id: SPOT_PUCK,
    type: "symbol",
    // Always a filter (an empty list keeps everything) so react-map-gl diffs a
    // filter change rather than toggling the property on and off.
    filter: expr(["!", ["in", ["get", "slug"], ["literal", hiddenSlugs]]]),
    layout: {
      "icon-image": expr(puckIconImageExpr(null)),
      "icon-anchor": "bottom",
      "icon-offset": [0, PUCK_TIP_OFFSET],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  };

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
        // Earliest hook that fires with a map — the pucks have to be registered
        // before the spot source hands the worker anything to lay out.
        onStyleData={(e) => attachMapImages(e.target)}
        onLoad={(e) => {
          attachMapImages(e.target); // no-op when styledata already did it
          collapseAttribution(e.target.getContainer());
          frameToRoster(e.target);
          setMapObj(e.target);
        }}
        onZoom={(e) => setDeclutterZoom(Math.round(e.viewState.zoom * 4) / 4)}
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
          <Layer {...spotPuckLayer} />
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
              style={{ color: TIER_PIN[hover.tier] }}
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
