"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapRef } from "react-map-gl/maplibre";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import {
  rescoreSpots,
  zonedHourToUtcIso,
  type CityNode,
  type ExploreData,
  type RailSpot,
  type SpeciesOption,
} from "./lib/explore-data";
import {
  buildViewportForecastDays,
  type ForecastDay,
  type ForecastStripModel,
} from "./lib/forecast-strip";
import { fetchMapForecast14d } from "@/lib/bluecaster-client";
import type { MapForecast14dPayload } from "@/lib/bluecaster";
import { useSubscription } from "@/hooks/use-subscription";
import { useExploreState } from "./lib/use-explore-state";
import ExploreTopBar from "./components/explore-top-bar";
import ExploreMap, { type StationPick } from "./components/explore-map";
import StationDrawer from "./components/station-drawer";
import LeftRail from "./components/left-rail";
import LocationSelector from "./components/location-selector";
import MobileSpotList from "./components/mobile-spot-list";
import MobileFilterSheet from "./components/mobile-filter-sheet";
import ExploreFooter from "./components/explore-footer";
import ForecastStrip from "./components/forecast-strip";

const MAP_TZ = "America/Vancouver";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function boundsOf(spots: RailSpot[]): [[number, number], [number, number]] | null {
  if (spots.length === 0) return null;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const spot of spots) {
    w = Math.min(w, spot.lng);
    e = Math.max(e, spot.lng);
    s = Math.min(s, spot.lat);
    n = Math.max(n, spot.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

export default function ExploreShell({
  data,
  bbox,
}: {
  data: ExploreData;
  bbox: string;
}) {
  const mapRef = useRef<MapRef>(null);
  const router = useRouter();
  const { isPaid } = useSubscription();
  const { citySlug, spotSlug, day, stn, setQuery } = useExploreState();

  // Mobile (<lg) map-filter sheet (species + layer toggles + near-me),
  // opened by the location header's filter button.
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Map-layer toggles + species filter (MapControls) ────────────────
  const [relief, setRelief] = useState(true);
  const [labels, setLabels] = useState(true);
  const [currents, setCurrents] = useState(false);
  const [wind, setWind] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);

  // ── Viewport tracking: the map viewport is the source of truth for which
  //    spots the rail/list/strip reflect. `viewBounds` updates on every
  //    moveend (client-side spot filter); `vpBbox` is the same box padded
  //    20% and rounded, debounced, and drives the strip's forecast fetch. ──
  const [viewBounds, setViewBounds] = useState<{ w: number; s: number; e: number; n: number } | null>(null);
  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [vpBbox, setVpBbox] = useState<string | null>(null);
  const vpTimerRef = useRef<number | null>(null);

  const handleViewportChange = useCallback(
    (b: { w: number; s: number; e: number; n: number }, c: { lat: number; lng: number }) => {
      setViewBounds(b);
      setViewCenter(c);
      if (vpTimerRef.current) window.clearTimeout(vpTimerRef.current);
      vpTimerRef.current = window.setTimeout(() => {
        const padLng = (b.e - b.w) * 0.2;
        const padLat = (b.n - b.s) * 0.2;
        const r = (v: number) => Math.round(v * 1000) / 1000;
        setVpBbox(
          `${r(b.w - padLng)},${r(b.s - padLat)},${r(b.e + padLng)},${r(b.n + padLat)}`,
        );
      }, 300);
    },
    [],
  );

  const today = data.date;
  const selectedIso = day ?? today;

  // ── Day re-scoring: refetch map/spots for the selected date, cache it,
  //    and overlay the new scores onto the (stable) base spot set. ────────
  const dayCacheRef = useRef<Map<string, MapSpotsPayload>>(new Map());
  const [dayPayload, setDayPayload] = useState<MapSpotsPayload | null>(null);

  useEffect(() => {
    if (selectedIso === today) {
      setDayPayload(null);
      return;
    }
    const cached = dayCacheRef.current.get(selectedIso);
    if (cached) {
      setDayPayload(cached);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/bluecaster/map/spots?bbox=${encodeURIComponent(bbox)}&date=${selectedIso}`,
    )
      .then((r) => (r.ok ? (r.json() as Promise<MapSpotsPayload>) : null))
      .then((p) => {
        if (cancelled || !p) return;
        dayCacheRef.current.set(selectedIso, p);
        setDayPayload(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedIso, today, bbox]);

  const effectiveSpots = useMemo(() => {
    if (selectedIso === today || !dayPayload) return data.spots;
    return rescoreSpots(data.spots, dayPayload, false);
  }, [selectedIso, today, dayPayload, data.spots]);

  // Species filter: re-score each spot to the chosen species (pins recolor,
  // rail re-ranks, forecast strip keys off it). "Best bet" (null) = unchanged.
  const displaySpots = useMemo(() => {
    if (!speciesFilter) return effectiveSpots;
    const name = data.species.find((s) => s.id === speciesFilter)?.name ?? null;
    return effectiveSpots
      .map((s) => {
        const score = s.scoresBySpecies[speciesFilter] ?? null;
        return { ...s, score, bestSpeciesId: speciesFilter, driverSpecies: name };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [effectiveSpots, speciesFilter, data.species]);

  // The hierarchy walk in buildExploreData emits one RailSpot per (city,
  // spot) membership — a shared spot (Race Rocks ∈ Victoria + Sooke) appears
  // once per member city. The old city-scoped rail hid that; the viewport
  // rail/map must dedupe by slug (spots are score-sorted, so the first copy
  // wins).
  const uniqueSpots = useMemo(() => {
    const seen = new Set<string>();
    return displaySpots.filter((s) => {
      if (seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    });
  }, [displaySpots]);

  const activeCitySlug = citySlug ?? data.defaultCitySlug;

  const selectedCity = useMemo<CityNode | null>(() => {
    if (!activeCitySlug) return null;
    for (const prov of data.locations) {
      for (const region of prov.regions) {
        const city = region.cities.find((c) => c.slug === activeCitySlug);
        if (city) return city;
      }
    }
    return null;
  }, [data.locations, activeCitySlug]);

  // The rail (and mobile list) show what the map shows: spots inside the
  // current viewport. Until the map reports its first viewport (SSR, map
  // still booting) fall back to the selected city's spots so the first paint
  // isn't empty.
  const railSpots = useMemo(() => {
    if (viewBounds) {
      return uniqueSpots.filter(
        (s) =>
          s.lng >= viewBounds.w &&
          s.lng <= viewBounds.e &&
          s.lat >= viewBounds.s &&
          s.lat <= viewBounds.n,
      );
    }
    if (!selectedCity) return uniqueSpots;
    // Pre-viewport fallback (first paint): the city's spots, deduped — the
    // hierarchy can list a shared spot under several cities.
    const seen = new Set<string>();
    return displaySpots.filter((s) => {
      if (s.citySlug !== selectedCity.slug || seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    });
  }, [displaySpots, uniqueSpots, viewBounds, selectedCity]);

  // City the viewport "is" — labels the location pill ("Victoria · South
  // Vancouver Island" → pan → "Vancouver · Lower Mainland") and anchors
  // city-derived toggles while the user roams. Prefer the city owning the
  // most spots in view (a wide frame's centre can sit over open water nearer
  // some other town); fall back to nearest-to-centre when nothing's in view.
  const nearestCity = useMemo<CityNode | null>(() => {
    if (!viewCenter) return null;
    const cityBySlug = new Map<string, CityNode>();
    for (const prov of data.locations)
      for (const region of prov.regions)
        for (const city of region.cities) cityBySlug.set(city.slug, city);

    const counts = new Map<string, number>();
    for (const s of railSpots) counts.set(s.citySlug, (counts.get(s.citySlug) ?? 0) + 1);
    let topSlug: string | null = null;
    let topCount = 0;
    for (const [slug, n] of counts) {
      if (n > topCount && cityBySlug.has(slug)) {
        topCount = n;
        topSlug = slug;
      }
    }
    if (topSlug) return cityBySlug.get(topSlug) ?? null;

    let best: CityNode | null = null;
    let bestKm = Infinity;
    for (const city of cityBySlug.values()) {
      const km = haversineKm(viewCenter.lat, viewCenter.lng, city.lat, city.lng);
      if (km < bestKm) {
        bestKm = km;
        best = city;
      }
    }
    return best;
  }, [data.locations, viewCenter, railSpots]);

  const labelCity = nearestCity ?? selectedCity;

  // Per-species best scores across the spots in view (and for the viewed
  // date) so the filter chips reflect the water the user is looking at.
  const speciesWithScores = useMemo<SpeciesOption[]>(() => {
    const best: Record<string, number> = {};
    for (const spot of railSpots) {
      for (const [sid, score] of Object.entries(spot.scoresBySpecies)) {
        if (!(sid in best) || score > best[sid]) best[sid] = score;
      }
    }
    return data.species
      .map((s) => ({ ...s, bestScore: best[s.id] ?? null }))
      .sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
  }, [railSpots, data.species]);

  // Jurisdiction auto-switch: the WDFW marine-area grid + MPAs (shipped hidden
  // in the relief style, Canada-first) turn on when the viewport sits in
  // Washington. DFO layers stay on — each grid only covers its own waters.
  const wdfwRegs =
    (labelCity?.provinceCode ?? railSpots[0]?.provinceCode) === "WA";

  // Whole 14-day strip hide/show (collapses to a "Show" chip).
  const [stripHidden, setStripHidden] = useState(false);

  // Regional peak hour across the mapped spots — with no hour scrubber, every
  // surface rests at day-peak scores; this hour only anchors the animated
  // currents field to a representative time for the selected day.
  const peakHour = useMemo(() => {
    let best = -1;
    let hr = 12;
    for (const s of railSpots) {
      for (let h = 0; h < 24; h++) {
        const v = s.hours24[h];
        if (typeof v === "number" && v > best) {
          best = v;
          hr = h;
        }
      }
    }
    return best >= 0 ? hr : null;
  }, [railSpots]);

  // A UTC instant for the animated currents field — the flow layer
  // re-predicts the tidal field for this time, so picking another day moves
  // the animation with the pins.
  const flowTimeIso = useMemo(
    () =>
      peakHour !== null
        ? zonedHourToUtcIso(selectedIso, peakHour, MAP_TZ)
        : null,
    [peakHour, selectedIso],
  );

  const selectedSpot = useMemo(
    () =>
      railSpots.find((s) => s.slug === spotSlug) ??
      displaySpots.find((s) => s.slug === spotSlug) ??
      null,
    [railSpots, displaySpots, spotSlug],
  );

  // ── Station/buoy selection (?stn=<chs|noaa|ndbc>:<sid>). The URL only
  //    carries source:sid; the click handler stashes the richer feature
  //    (name, coords) so the drawer header paints instantly. On a deep link
  //    the name arrives with the data fetch instead. ─────────────────────
  const [lastPick, setLastPick] = useState<StationPick | null>(null);

  const selectedStation = useMemo<StationPick | null>(() => {
    if (!stn) return null;
    const idx = stn.indexOf(":");
    if (idx < 1) return null;
    const source = stn.slice(0, idx);
    const sid = stn.slice(idx + 1);
    if ((source !== "chs" && source !== "noaa" && source !== "ndbc") || !sid) {
      return null;
    }
    if (lastPick && lastPick.source === source && lastPick.sid === sid) {
      return lastPick;
    }
    return {
      kind: source === "ndbc" ? "buoy" : "tide",
      source,
      sid,
      name: "",
      lat: 0,
      lng: 0,
    };
  }, [stn, lastPick]);

  // ── Forecast strip: per-day best across the spots in the current viewport
  //    (the new map/forecast-14d endpoint). Cached per bbox — panning back
  //    over familiar water doesn't refetch. ────────────────────────────────
  const fcCacheRef = useRef<Map<string, MapForecast14dPayload>>(new Map());
  const [fcPayload, setFcPayload] = useState<MapForecast14dPayload | null>(null);
  const [fcLoading, setFcLoading] = useState(false);

  useEffect(() => {
    if (!vpBbox) return;
    const cached = fcCacheRef.current.get(vpBbox);
    if (cached) {
      setFcPayload(cached);
      setFcLoading(false);
      return;
    }
    let cancelled = false;
    setFcLoading(fcCacheRef.current.size === 0);
    fetchMapForecast14d(vpBbox)
      .then((p) => {
        if (cancelled || !p?.days) return;
        if (fcCacheRef.current.size > 50) fcCacheRef.current.clear();
        fcCacheRef.current.set(vpBbox, p);
        setFcPayload(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vpBbox]);

  const stripModel: ForecastStripModel | null = useMemo(() => {
    if (!fcPayload) return null;
    return buildViewportForecastDays(fcPayload, speciesFilter, isPaid);
  }, [fcPayload, speciesFilter, isPaid]);

  // Strip header label: the pinned species, else the cross-species best fold.
  const stripSpeciesName = speciesFilter
    ? data.species.find((s) => s.id === speciesFilter)?.name ?? null
    : "Best species";

  // Frame the picked city's spots when the selection changes (search pick,
  // Near me, ?loc deep link). Panning afterwards never re-triggers this —
  // the viewport stays wherever the user takes it.
  useEffect(() => {
    const citySpots = selectedCity
      ? displaySpots.filter((s) => s.citySlug === selectedCity.slug)
      : displaySpots;
    const bounds = boundsOf(citySpots);
    if (!bounds) return;
    const desktop = typeof window !== "undefined" && window.innerWidth >= 1024;
    mapRef.current?.fitBounds(bounds, {
      padding: desktop
        ? { left: 460, top: 40, right: 80, bottom: 200 }
        : { left: 24, top: 24, right: 24, bottom: 24 },
      maxZoom: 12,
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity?.slug]);

  // The map is a single instance whose container flips between an in-flow
  // block (<lg) and a full-screen absolute pane (lg+). trackResize handles
  // size changes, but the positioning-scheme swap on a live breakpoint cross
  // needs one nudge so tiles don't stay blank.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width:1024px)");
    const onChange = () =>
      requestAnimationFrame(() => mapRef.current?.getMap()?.resize());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const handleSelectCity = useCallback(
    (city: CityNode) => {
      setQuery({ loc: city.slug, spot: null });
    },
    [setQuery],
  );

  const handleSelectSpot = useCallback(
    (slug: string) => {
      // Mobile (<lg) has no rail/drawer — go straight to the responsive spot
      // page. Desktop keeps the in-rail drawer + flyTo.
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width:1024px)").matches
      ) {
        router.push(`/explore/spot/${slug}`);
        return;
      }
      setQuery({ spot: slug, stn: null });
      const spot = displaySpots.find((s) => s.slug === slug);
      if (spot) {
        mapRef.current?.flyTo({
          center: [spot.lng, spot.lat],
          zoom: Math.max(mapRef.current.getZoom() ?? 9, 11),
          duration: 700,
        });
      }
    },
    [router, setQuery, displaySpots],
  );

  const handleCloseSpot = useCallback(() => {
    setQuery({ spot: null });
  }, [setQuery]);

  const handleSelectStation = useCallback(
    (pick: StationPick) => {
      setLastPick(pick);
      setQuery({ stn: `${pick.source}:${pick.sid}`, spot: null });
      mapRef.current?.flyTo({
        center: [pick.lng, pick.lat],
        zoom: Math.max(mapRef.current.getZoom() ?? 9, 10),
        duration: 700,
      });
    },
    [setQuery],
  );

  const handleCloseStation = useCallback(() => {
    setQuery({ stn: null });
  }, [setQuery]);

  // ── "Near me": geolocate → jump to the nearest covered city (client-side
  //    haversine over the loaded hierarchy — no API round-trip). ────────────
  const [locating, setLocating] = useState(false);

  const handleNearMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best: CityNode | null = null;
        let bestKm = Infinity;
        for (const prov of data.locations)
          for (const region of prov.regions)
            for (const city of region.cities) {
              const km = haversineKm(latitude, longitude, city.lat, city.lng);
              if (km < bestKm) {
                bestKm = km;
                best = city;
              }
            }
        if (best) setQuery({ loc: best.slug, spot: null });
        else mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 9, duration: 800 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [data.locations, setQuery]);

  const handleSelectDay = useCallback(
    (d: ForecastDay) => {
      setQuery({ day: d.iso === today ? null : d.iso });
    },
    [setQuery, today],
  );

  const initialCenter = selectedCity
    ? { lat: selectedCity.lat, lng: selectedCity.lng }
    : { lat: 50.5, lng: -126.5 };
  const initialZoom = selectedCity ? 9 : 4.5;

  // Remember the last viewed city (nearest to the viewport) — the catch
  // wizard's location fallback (geo-fallback.ts) centers its pin here when a
  // photo has no GPS.
  useEffect(() => {
    if (!labelCity) return;
    try {
      localStorage.setItem(
        "rc:lastCity",
        JSON.stringify({ lat: labelCity.lat, lng: labelCity.lng, name: labelCity.name }),
      );
    } catch {
      /* storage unavailable (private mode) — fallback chain continues */
    }
  }, [labelCity]);

  return (
    <div className="relative pt-16 lg:pt-0 min-h-dvh lg:min-h-0 lg:h-full">
      <ExploreTopBar />

      {/* Mobile-only location header (in-flow) — the screenshot's pill +
          filter button. Desktop shows the same selector inside the rail. */}
      <div className="lg:hidden bg-rc-panel border-b border-rc-rule relative z-10">
        <LocationSelector
          locations={data.locations}
          selectedCity={labelCity}
          onSelectCity={handleSelectCity}
          onFilterClick={() => setFilterOpen(true)}
        />
      </div>

      {/* The single map instance. Mobile: a contained in-flow block.
          Desktop: the full-screen absolute pane, exactly as before. */}
      <div className="relative h-[45dvh] min-h-[280px] w-full lg:absolute lg:inset-x-0 lg:top-16 lg:bottom-0 lg:h-auto lg:min-h-0 lg:w-auto">
        <ExploreMap
          mapRef={mapRef}
          spots={uniqueSpots}
          selectedSlug={selectedSpot?.slug ?? null}
          onSelect={handleSelectSpot}
          onSelectStation={handleSelectStation}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          relief={relief}
          labels={labels}
          currents={currents}
          wind={wind}
          hour={null}
          flowTimeIso={flowTimeIso}
          stripVisible={!stripHidden}
          wdfwRegs={wdfwRegs}
          onViewportChange={handleViewportChange}
        />
      </div>

      {/* Mobile-only document flow: spot list + footer (in-flow). */}
      <MobileSpotList spots={railSpots} tz={MAP_TZ} onSelectSpot={handleSelectSpot} />
      <ExploreFooter />

      <LeftRail
        locations={data.locations}
        selectedCity={labelCity}
        spots={railSpots}
        selectedSpot={selectedSpot}
        selectedStation={selectedStation}
        date={selectedIso}
        tz={MAP_TZ}
        bottomInset={stripHidden ? 64 : 152}
        onSelectCity={handleSelectCity}
        onSelectSpot={handleSelectSpot}
        onCloseSpot={handleCloseSpot}
        onCloseStation={handleCloseStation}
        mapControls={{
          relief,
          labels,
          currents,
          wind,
          onToggleRelief: () => setRelief((v) => !v),
          onToggleLabels: () => setLabels((v) => !v),
          onToggleCurrents: () => setCurrents((v) => !v),
          onToggleWind: () => setWind((v) => !v),
          species: speciesWithScores,
          speciesFilter,
          onSpeciesChange: setSpeciesFilter,
          onNearMe: handleNearMe,
          locating,
        }}
      />

      {/* Mobile-only station/buoy sheet — the rail (and its drawer slot) is
          desktop-only, so stations get a bottom sheet on small screens. */}
      {selectedStation && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 h-[60dvh] bg-rc-panel border-t border-rc-rule rounded-t-xl shadow-rc-panel overflow-hidden">
          <StationDrawer
            pick={selectedStation}
            tz={MAP_TZ}
            onBack={handleCloseStation}
          />
        </div>
      )}

      <ForecastStrip
        model={stripModel}
        speciesName={stripSpeciesName}
        selectedIso={selectedIso}
        loading={fcLoading}
        onSelectDay={handleSelectDay}
        hidden={stripHidden}
        onHide={() => setStripHidden(true)}
        onShow={() => setStripHidden(false)}
      />

      {/* Mobile-only map-filter sheet (species + layers + near-me). */}
      <MobileFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        relief={relief}
        labels={labels}
        currents={currents}
        onToggleRelief={() => setRelief((v) => !v)}
        onToggleLabels={() => setLabels((v) => !v)}
        onToggleCurrents={() => setCurrents((v) => !v)}
        species={data.species}
        speciesFilter={speciesFilter}
        onSpeciesChange={setSpeciesFilter}
        onNearMe={handleNearMe}
        locating={locating}
      />
    </div>
  );
}
