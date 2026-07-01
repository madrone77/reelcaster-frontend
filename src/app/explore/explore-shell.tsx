"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapRef } from "react-map-gl/maplibre";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import {
  rescoreSpots,
  type CityNode,
  type ExploreData,
  type RailSpot,
} from "./lib/explore-data";
import {
  buildForecastDays,
  type ForecastDay,
  type ForecastStripModel,
} from "./lib/forecast-strip";
import { fetchForecast14d } from "@/lib/bluecaster-client";
import type { Forecast14dPayload } from "@/lib/bluecaster/live-spot-types";
import { useSubscription } from "@/hooks/use-subscription";
import { useExploreState } from "./lib/use-explore-state";
import ExploreTopBar from "./components/explore-top-bar";
import ExploreMap from "./components/explore-map";
import MapControls from "./components/map-controls";
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
  const { citySlug, spotSlug, day, setQuery } = useExploreState();

  // Mobile (<lg) map-filter sheet (species + layer toggles + near-me),
  // opened by the location header's filter button.
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Map-layer toggles + species filter (MapControls) ────────────────
  const [relief, setRelief] = useState(true);
  const [labels, setLabels] = useState(true);
  const [currents, setCurrents] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);

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

  const railSpots = useMemo(
    () =>
      selectedCity
        ? displaySpots.filter((s) => s.citySlug === selectedCity.slug)
        : displaySpots,
    [displaySpots, selectedCity],
  );

  const selectedSpot = useMemo(
    () => displaySpots.find((s) => s.slug === spotSlug) ?? null,
    [displaySpots, spotSlug],
  );

  // ── Forecast strip: 14-day grid for the anchor spot (the selected spot,
  //    or the top-scoring spot in view). Cached per slug. ─────────────────
  const anchorSpot = useMemo(
    () => selectedSpot ?? railSpots.find((s) => s.score !== null) ?? railSpots[0] ?? null,
    [selectedSpot, railSpots],
  );

  const fcCacheRef = useRef<Map<string, Forecast14dPayload>>(new Map());
  const [fcPayload, setFcPayload] = useState<Forecast14dPayload | null>(null);
  const [fcLoading, setFcLoading] = useState(false);

  useEffect(() => {
    const slug = anchorSpot?.slug;
    if (!slug) {
      setFcPayload(null);
      return;
    }
    const cached = fcCacheRef.current.get(slug);
    if (cached) {
      setFcPayload(cached);
      setFcLoading(false);
      return;
    }
    let cancelled = false;
    setFcLoading(true);
    fetchForecast14d(slug)
      .then((p) => {
        if (cancelled) return;
        fcCacheRef.current.set(slug, p);
        setFcPayload(p);
      })
      .catch(() => {
        if (!cancelled) setFcPayload(null);
      })
      .finally(() => {
        if (!cancelled) setFcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchorSpot?.slug]);

  const stripModel: ForecastStripModel | null = useMemo(() => {
    if (!fcPayload || !anchorSpot) return null;
    return buildForecastDays(fcPayload, anchorSpot.bestSpeciesId, isPaid);
  }, [fcPayload, anchorSpot, isPaid]);

  // Keep the map framed on the selected location's spots.
  useEffect(() => {
    const bounds = boundsOf(railSpots);
    if (!bounds) return;
    const desktop = typeof window !== "undefined" && window.innerWidth >= 1024;
    mapRef.current?.fitBounds(bounds, {
      padding: desktop
        ? { left: 460, top: 100, right: 80, bottom: 60 }
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
      setQuery({ spot: slug });
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

  return (
    <div className="relative pt-14 lg:pt-0 min-h-dvh lg:min-h-0 lg:h-full">
      <ExploreTopBar />

      {/* Mobile-only location header (in-flow) — the screenshot's pill +
          filter button. Desktop shows the same selector inside the rail. */}
      <div className="lg:hidden bg-rc-panel border-b border-rc-rule relative z-10">
        <LocationSelector
          locations={data.locations}
          selectedCity={selectedCity}
          onSelectCity={handleSelectCity}
          onFilterClick={() => setFilterOpen(true)}
        />
      </div>

      {/* The single map instance. Mobile: a contained in-flow block.
          Desktop: the full-screen absolute pane, exactly as before. */}
      <div className="relative h-[45dvh] min-h-[280px] w-full lg:absolute lg:inset-x-0 lg:top-14 lg:bottom-0 lg:h-auto lg:min-h-0 lg:w-auto">
        <ExploreMap
          mapRef={mapRef}
          spots={railSpots}
          selectedSlug={selectedSpot?.slug ?? null}
          onSelect={handleSelectSpot}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          relief={relief}
          labels={labels}
          currents={currents}
        />
      </div>

      {/* Mobile-only document flow: spot list + footer (in-flow). */}
      <MobileSpotList spots={railSpots} onSelectSpot={handleSelectSpot} />
      <ExploreFooter />

      {/* Desktop-only floating panels (unchanged). */}
      <MapControls
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

      <LeftRail
        locations={data.locations}
        selectedCity={selectedCity}
        spots={railSpots}
        selectedSpot={selectedSpot}
        date={selectedIso}
        tz={MAP_TZ}
        onSelectCity={handleSelectCity}
        onSelectSpot={handleSelectSpot}
        onCloseSpot={handleCloseSpot}
      />

      <ForecastStrip
        model={stripModel}
        speciesName={anchorSpot?.driverSpecies ?? null}
        selectedIso={selectedIso}
        loading={fcLoading}
        onSelectDay={handleSelectDay}
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
