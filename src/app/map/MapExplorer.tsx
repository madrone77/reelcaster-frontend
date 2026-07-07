"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { BathyMap } from "./BathyMap";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CitySelector } from "./CitySelector";
import { ForecastStrip } from "./ForecastStrip";
import { SpotDetail } from "./SpotDetail";
import type { Forecast14d, StripDay } from "./scoring-ui";
import {
  cursorValue,
  scoreColor,
  scoreVerdict,
  currentLocalHour,
  hourLabel,
  shortDate,
  type MapSpot,
  type SpeciesMeta,
  type SpotsScores,
} from "./scoring-ui";

const SRC = "rc-spots";
const CIRCLE = "rc-spots-circles";
const LABEL = "rc-spots-labels";

// Relief base: the "Depth contours" toggle shows/hides the contour lines + labels
// over the always-on color-relief raster.
const CONTOUR_LAYERS = ["contour-line", "contour-labels"];

const NONE = " ";

// Selected puck = white disc with a colored ring (matches the design); others =
// solid score-colored disc with a white ring.
function circleColorExpr(selectedId: string | null) {
  return [
    "case",
    ["==", ["get", "spotId"], selectedId ?? NONE], "#ffffff",
    ["get", "color"],
  ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>;
}
function strokeColorExpr(selectedId: string | null) {
  return [
    "case",
    ["==", ["get", "spotId"], selectedId ?? NONE], ["get", "color"],
    "#ffffff",
  ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>;
}
function strokeWidthExpr(selectedId: string | null, hoveredId: string | null) {
  return [
    "case",
    ["==", ["get", "spotId"], selectedId ?? NONE], 4,
    ["==", ["get", "spotId"], hoveredId ?? NONE], 2.5,
    1.5,
  ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>;
}
// NOTE: a "zoom" expression must be top-level (can't be nested in "case"), so
// radius is a plain zoom interpolate; the selected puck is distinguished by the
// white fill + thick colored ring instead of a size bump.
const RADIUS_EXPR = [
  "interpolate", ["linear"], ["zoom"], 8, 12, 12, 15, 15, 17,
] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>;
function labelColorExpr(selectedId: string | null) {
  return [
    "case",
    ["==", ["get", "spotId"], selectedId ?? NONE], ["get", "color"],
    ["get", "txtColor"],
  ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export function MapExplorer() {
  const [date, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState(7);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showBathy, setShowBathy] = useState(true);
  const [activeTab, setActiveTab] = useState<"explore" | "species" | "report" | "notifications">("explore");
  const [showForecast, setShowForecast] = useState(true);
  const [fc14, setFc14] = useState<Forecast14d | null>(null);

  const [data, setData] = useState<SpotsScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<{ w: number; s: number; e: number; n: number } | null>(null);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [layersReady, setLayersReady] = useState(false);

  // ── data: all published spots for the date ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    fetch(`/api/bluecaster/map/spots?${qs.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`spots ${r.status}`);
        return r.json() as Promise<SpotsScores>;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (!date) {
          setDate(d.date);
          setHour(currentLocalHour(d.tz));
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const speciesList = useMemo<SpeciesMeta[]>(() => {
    if (!data) return [];
    return Object.values(data.species).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const ranked = useMemo(() => {
    if (!data) return [] as Array<{ spot: MapSpot; score: number | null; speciesId: string | null }>;
    return data.spots
      .map((spot) => ({ spot, ...cursorValue(spot, filter, hour) }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [data, filter, hour]);

  // Only spots within the current map viewport (rail lists what's in view).
  const visibleRanked = useMemo(() => {
    if (!bounds) return ranked;
    return ranked.filter(
      ({ spot }) =>
        spot.lng >= bounds.w && spot.lng <= bounds.e && spot.lat >= bounds.s && spot.lat <= bounds.n,
    );
  }, [ranked, bounds]);

  // Focal spot for the 14-day strip: the selected spot, else the top in-view one.
  const focalSpotId = selectedId ?? visibleRanked[0]?.spot.id ?? null;

  const selectedSpot = useMemo(
    () => (selectedId && data ? data.spots.find((s) => s.id === selectedId) ?? null : null),
    [selectedId, data],
  );

  // Species the strip is pinned to: the active filter, else the focal spot's best.
  const pinnedSpeciesId = useMemo(() => {
    if (!data) return null;
    return filter ?? data.spots.find((s) => s.id === focalSpotId)?.best_species_id ?? null;
  }, [data, filter, focalSpotId]);
  const pinnedSpeciesName = pinnedSpeciesId && data?.species[pinnedSpeciesId] ? data.species[pinnedSpeciesId].name : null;

  // 14-day forecast for the focal spot (drives the strip).
  useEffect(() => {
    if (!focalSpotId) return;
    let cancelled = false;
    fetch(`/api/bluecaster/spots/${encodeURIComponent(focalSpotId)}/forecast-14d`)
      .then((r) => (r.ok ? (r.json() as Promise<Forecast14d>) : null))
      .then((d) => {
        if (!cancelled && d?.daily14) setFc14(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focalSpotId]);

  // Species-pinned daily series: peak score + peak hour per day from the grid.
  const stripDays = useMemo<StripDay[]>(() => {
    if (!fc14?.daily14) return [];
    const grid = pinnedSpeciesId ? fc14.hourlyScoreGrid?.[pinnedSpeciesId] : undefined;
    return fc14.daily14.map((d, i) => {
      let score = d.score;
      let peakHour: number | null = null;
      const dayHours = grid?.[i];
      if (dayHours) {
        let mx = -1;
        for (let h = 0; h < dayHours.length; h++) {
          const v = dayHours[h];
          if (v != null && v > mx) {
            mx = v;
            peakHour = h;
          }
        }
        if (mx >= 0) score = mx;
      }
      return { iso: d.iso, dow: d.dow, date: d.date, score, peakHour };
    });
  }, [fc14, pinnedSpeciesId]);

  // GeoJSON for the puck source.
  const fc = useMemo(() => {
    type Feat = {
      type: "Feature";
      geometry: { type: "Point"; coordinates: [number, number] };
      properties: Record<string, string | number>;
    };
    const features: Feat[] = [];
    if (data) {
      for (const spot of data.spots) {
        const cv = cursorValue(spot, filter, hour);
        const has = cv.score !== null;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [spot.lng, spot.lat] },
          properties: {
            spotId: spot.id,
            label: has ? String(Math.round(cv.score! * 100)) : "·",
            color: scoreColor(cv.score),
            txtColor: has ? "#ffffff" : "#475569",
            opacity: has ? 1 : 0.6,
          },
        });
      }
    }
    return { type: "FeatureCollection" as const, features };
  }, [data, filter, hour]);

  // ── map ready ──────────────────────────────────────────────────────────────
  const onMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: "rc-spot-popup" });
    // Track the visible viewport so the rail lists only spots in view. The rail
    // panel covers the left ~405px, so inset the west edge to its right edge —
    // the list then reflects spots actually visible to the right of the rail.
    const RAIL_RIGHT_PX = 405;
    const updateBounds = () => {
      const b = map.getBounds();
      let west = b.getWest();
      try {
        const h = map.getContainer().clientHeight || 1;
        const insetWest = map.unproject([RAIL_RIGHT_PX, h / 2]).lng;
        if (Number.isFinite(insetWest)) west = insetWest;
      } catch {
        /* fall back to full west */
      }
      setBounds({ w: west, s: b.getSouth(), e: b.getEast(), n: b.getNorth() });
    };
    map.on("moveend", updateBounds);
    map.on("load", updateBounds);
    updateBounds();
    setMapEpoch((ep) => ep + 1);
  }, []);

  // ── puck layers ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0) return;
    let done = false;

    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features?.length) {
        map.getCanvas().style.cursor = "pointer";
        setHoveredId((e.features[0].properties as { spotId: string }).spotId);
      }
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      setHoveredId(null);
    };
    const onClickSpot = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features?.length) setSelectedId((e.features[0].properties as { spotId: string }).spotId);
    };
    const add = () => {
      if (done) return;
      try {
        if (!map.getSource(SRC)) {
          map.addSource(SRC, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
        if (!map.getLayer(CIRCLE)) {
          map.addLayer({
            id: CIRCLE,
            type: "circle",
            source: SRC,
            paint: {
              "circle-radius": RADIUS_EXPR,
              "circle-color": circleColorExpr(null),
              "circle-opacity": ["get", "opacity"],
              "circle-stroke-width": strokeWidthExpr(null, null),
              "circle-stroke-color": strokeColorExpr(null),
            },
          });
        }
        if (!map.getLayer(LABEL)) {
          map.addLayer({
            id: LABEL,
            type: "symbol",
            source: SRC,
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Regular"],
              "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 14, 12],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: { "text-color": ["get", "txtColor"] },
          });
        }
        done = true;
        map.off("styledata", add);
        map.off("load", add);
        map.on("mousemove", CIRCLE, onMove);
        map.on("mouseleave", CIRCLE, onLeave);
        map.on("click", CIRCLE, onClickSpot);
        setLayersReady(true);
      } catch {
        /* style not parsed yet — retry on styledata/load */
      }
    };

    add();
    map.on("styledata", add);
    map.on("load", add);

    return () => {
      map.off("styledata", add);
      map.off("load", add);
      map.off("mousemove", CIRCLE, onMove);
      map.off("mouseleave", CIRCLE, onLeave);
      map.off("click", CIRCLE, onClickSpot);
      for (const id of [LABEL, CIRCLE]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SRC)) map.removeSource(SRC);
      setLayersReady(false);
    };
  }, [mapEpoch]);

  // Push features on score/hour/filter changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReady) return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData(fc as unknown as Parameters<maplibregl.GeoJSONSource["setData"]>[0]);
  }, [fc, layersReady]);

  // Selection / hover highlight via paint expressions.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReady || !map.getLayer(CIRCLE)) return;
    map.setPaintProperty(CIRCLE, "circle-color", circleColorExpr(selectedId));
    map.setPaintProperty(CIRCLE, "circle-stroke-color", strokeColorExpr(selectedId));
    map.setPaintProperty(CIRCLE, "circle-stroke-width", strokeWidthExpr(selectedId, hoveredId));
    if (map.getLayer(LABEL)) map.setPaintProperty(LABEL, "text-color", labelColorExpr(selectedId));
  }, [selectedId, hoveredId, layersReady]);

  // Hover popup.
  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup || !data) return;
    const row = hoveredId ? ranked.find((r) => r.spot.id === hoveredId) : null;
    if (!row) {
      popup.remove();
      return;
    }
    const { spot, score, speciesId } = row;
    const speciesName = speciesId && data.species[speciesId] ? data.species[speciesId].name : "—";
    const pct = score === null ? "—" : `${Math.round(score * 100)}`;
    popup
      .setLngLat([spot.lng, spot.lat])
      .setHTML(
        `<div class="rc-pop">
          <div class="rc-pop-name">${escapeHtml(spot.name)}</div>
          <div class="rc-pop-row"><span class="rc-pop-dot" style="background:${scoreColor(score)}"></span>
            <strong>${pct}</strong><span class="rc-pop-verdict">${scoreVerdict(score)}</span></div>
          <div class="rc-pop-species">${escapeHtml(speciesName)}</div>
        </div>`,
      )
      .addTo(map);
  }, [hoveredId, ranked, data]);

  // Pan to selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || !data) return;
    const spot = data.spots.find((s) => s.id === selectedId);
    if (spot) map.easeTo({ center: [spot.lng, spot.lat], duration: 500 });
  }, [selectedId, data]);

  // Depth-contours toggle over the relief base.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0) return;
    const apply = () => {
      if (!map.getLayer("contour-line")) return false;
      for (const id of CONTOUR_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showBathy ? "visible" : "none");
      }
      return true;
    };
    if (!apply()) {
      const onStyle = () => {
        if (apply()) map.off("styledata", onStyle);
      };
      map.on("styledata", onStyle);
      return () => {
        map.off("styledata", onStyle);
      };
    }
  }, [showBathy, mapEpoch, layersReady]);

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-rcc-bg">
      <BathyMap onReady={onMapReady} />

      <TopBar active={activeTab} onSelect={setActiveTab} notificationCount={1} />

      {showForecast && stripDays.length > 0 && (
        <ForecastStrip
          days={stripDays}
          speciesName={pinnedSpeciesName}
          selectedIso={date}
          onPickDate={(iso) => setDate(iso)}
          onHide={() => setShowForecast(false)}
          onUpgrade={() => alert("Boat Pro — extended forecast + currents. Billing wiring is a follow-up.")}
        />
      )}

      <CitySelector label="Victoria · Vancouver Island South" />

      {data && selectedSpot ? (
        (() => {
          const cv = cursorValue(selectedSpot, filter, hour);
          const sid = cv.speciesId ?? selectedSpot.best_species_id;
          const strip = (sid && selectedSpot.scores[sid]?.hours) || [];
          const peakHour = sid ? selectedSpot.scores[sid]?.peak_hour ?? null : null;
          const spName = sid && data.species[sid] ? data.species[sid].name : null;
          return (
            <SpotDetail
              spot={selectedSpot}
              speciesName={spName}
              score={cv.score}
              peakHour={peakHour}
              hour={hour}
              strip={strip}
              cond={fc14?.hourlyConditionsGrid?.[0]?.[hour] ?? null}
              dateLabel={date ? shortDate(date) : null}
              areaLabel="Victoria · Vancouver Island South"
              topPx={132}
              onClose={() => setSelectedId(null)}
              onScrubHour={setHour}
            />
          );
        })()
      ) : data ? (
        <Sidebar
          ranked={visibleRanked}
          species={data.species}
          hour={hour}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          topPx={132}
        />
      ) : null}

      {/* Restore the forecast strip when hidden */}
      {!showForecast && (
        <button
          onClick={() => setShowForecast(true)}
          className="pointer-events-auto absolute right-3 top-16 z-10 rounded-[4px] bg-rcc-surface px-3 py-1.5 text-xs font-medium text-rcc-brand shadow-sm ring-1 ring-rcc-line"
        >
          Show 14-day forecast
        </button>
      )}

      {/* Compact controls: species filter + depth contours */}
      <div className="pointer-events-auto absolute bottom-16 left-3 z-10 flex items-center gap-2 rounded-[4px] bg-rcc-surface px-3 py-2 shadow-sm ring-1 ring-rcc-line">
        <select
          value={filter ?? ""}
          onChange={(e) => setFilter(e.target.value || null)}
          className="rounded-md border border-rcc-line bg-white px-2 py-1 text-xs text-rcc-ink"
        >
          <option value="">Best species</option>
          {speciesList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-rcc-ink">
          <input type="checkbox" checked={showBathy} onChange={(e) => setShowBathy(e.target.checked)} />
          Depth contours
        </label>
      </div>

      {/* Hour scrubber */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-[4px] bg-rcc-surface px-4 py-2 shadow-sm ring-1 ring-rcc-line">
          <span className="w-12 font-mono text-xs font-semibold text-rcc-ink">{hourLabel(hour)}</span>
          <input
            type="range"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-64 accent-rcc-brand"
          />
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-rcc-bg/60">
          <span className="text-sm text-rcc-muted">Loading spots…</span>
        </div>
      )}
      {error && (
        <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          Couldn’t load spots: {error}
        </div>
      )}
    </div>
  );
}
