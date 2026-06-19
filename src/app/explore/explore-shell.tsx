"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchForecast14d, fetchNearbyByCoords } from "@/lib/bluecaster-client";
import type { Forecast14dPayload } from "@/lib/bluecaster/live-spot-types";
import { useSubscription } from "@/hooks/use-subscription";
import { useExploreState } from "./lib/use-explore-state";
import ExploreTopBar from "./components/explore-top-bar";
import ExploreMap from "./components/explore-map";
import MapControls from "./components/map-controls";
import LeftRail from "./components/left-rail";
import MobileSheet from "./components/mobile-sheet";
import ForecastStrip, { MobileForecastStrip } from "./components/forecast-strip";

const MAP_TZ = "America/Vancouver";

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
  const { isPaid } = useSubscription();
  const { citySlug, spotSlug, day, setQuery } = useExploreState();

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
        : { left: 40, top: 80, right: 40, bottom: 120 },
      maxZoom: 12,
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity?.slug]);

  const handleSelectCity = useCallback(
    (city: CityNode) => {
      setQuery({ loc: city.slug, spot: null });
    },
    [setQuery],
  );

  const handleSelectSpot = useCallback(
    (slug: string) => {
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
    [setQuery, displaySpots],
  );

  const handleCloseSpot = useCallback(() => {
    setQuery({ spot: null });
  }, [setQuery]);

  // ── "Near me": geolocate → jump to the nearest covered city, else fit the
  //    map to the returned nearby spots / user point. ──────────────────────
  const [locating, setLocating] = useState(false);
  const coveredCitySlugs = useMemo(() => {
    const set = new Set<string>();
    for (const prov of data.locations)
      for (const region of prov.regions)
        for (const city of region.cities) set.add(city.slug);
    return set;
  }, [data.locations]);

  const handleNearMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const near = await fetchNearbyByCoords(latitude, longitude);
          const citySlug = near?.nearest_city?.slug ?? null;
          if (citySlug && coveredCitySlugs.has(citySlug)) {
            setQuery({ loc: citySlug, spot: null });
          } else {
            const spots = near?.nearby_spots ?? [];
            if (spots.length > 0) {
              let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
              for (const sp of spots) {
                w = Math.min(w, sp.lng);
                e = Math.max(e, sp.lng);
                s = Math.min(s, sp.lat);
                n = Math.max(n, sp.lat);
              }
              mapRef.current?.fitBounds(
                [[w, s], [e, n]],
                { padding: 80, maxZoom: 11, duration: 800 },
              );
            } else {
              mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 9, duration: 800 });
            }
          }
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [coveredCitySlugs, setQuery]);

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
    <div className="relative h-full">
      <ExploreTopBar />

      <div className="absolute inset-x-0 top-14 bottom-0">
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

      <MobileForecastStrip
        model={stripModel}
        selectedIso={selectedIso}
        onSelectDay={handleSelectDay}
      />

      <MobileSheet
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
    </div>
  );
}
