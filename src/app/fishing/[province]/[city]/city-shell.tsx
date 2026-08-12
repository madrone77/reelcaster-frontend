"use client";

// AllTrails-style city explorer: breadcrumb + H1 header, a scrollable rail of
// the same SpotCards Explore renders, and a big city map filling the rest.
// Desktop is a side-by-side split (rail | map) under the sticky marketing
// header; mobile stacks map-then-list in the document flow. Card and pin
// selection reuse Explore's drawers so the page stays fully interactive.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MapRef } from "react-map-gl/maplibre";
import ExploreMap, {
  type StationPick,
} from "../../../explore/components/explore-map";
import SpotCard from "../../../explore/components/spot-card";
import SpotDrawer from "../../../explore/components/spot-drawer";
import StationDrawer from "../../../explore/components/station-drawer";
import MapFilterChips from "../../../explore/components/map-filter-chips";
import MobileSpotList from "../../../explore/components/mobile-spot-list";
import SortControl, {
  sortSpots,
  type SortKey,
} from "../../../explore/components/sort-control";
import {
  zonedHourToUtcIso,
  type RailSpot,
  type SpeciesOption,
} from "../../../explore/lib/explore-data";
import type { FreshCatchesResponse } from "../../../explore/lib/fresh-catch-types";
import { fetchFreshCatches } from "@/lib/bluecaster-client";
import { useAuth } from "@/contexts/auth-context";
import type { FishingCity } from "../../lib/fishing-data";

const MAP_TZ = "America/Vancouver";

export default function CityShell({
  city,
  provincePath,
  spots,
  species,
  date,
  intro,
}: {
  city: FishingCity;
  provincePath: string;
  spots: RailSpot[];
  species: SpeciesOption[];
  date: string;
  intro: string | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [station, setStation] = useState<StationPick | null>(null);
  const [sort, setSort] = useState<SortKey>("score");
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [relief, setRelief] = useState(true);
  const [currents, setCurrents] = useState(false);
  const [wind, setWind] = useState(false);
  const [freshCatches, setFreshCatches] = useState<FreshCatchesResponse | null>(
    null,
  );

  // Scraped catch reports, keyed by spot id — the same payload Explore's rail
  // joins on, so a spot wears the same badge here as it does there. This page
  // is server-rendered for crawlers; the badge is a client-side additive layer
  // on top, so a failed fetch (or a bot that never runs it) still gets the
  // whole page. Re-runs when the session resolves: the Pro gate lives in the
  // route and reads the access token, so a pass fired before Supabase
  // rehydrates would leave a Pro angler holding the locked payload.
  useEffect(() => {
    let cancelled = false;
    fetchFreshCatches()
      .then((p) => {
        if (!cancelled && p) setFreshCatches(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Species filter re-scores every card/pin to the chosen species (same
  // mapping Explore applies); "Best bet" (null) = best species per spot.
  const displaySpots = useMemo(() => {
    if (!speciesFilter) return spots;
    const name = species.find((s) => s.id === speciesFilter)?.name ?? null;
    return spots
      .map((s) => {
        const score = s.scoresBySpecies[speciesFilter] ?? null;
        return { ...s, score, bestSpeciesId: speciesFilter, driverSpecies: name };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [spots, speciesFilter, species]);

  const railSpots = useMemo(
    () => sortSpots(displaySpots, sort),
    [displaySpots, sort],
  );

  const selectedSpot = useMemo(
    () => displaySpots.find((s) => s.slug === selectedSlug) ?? null,
    [displaySpots, selectedSlug],
  );

  // Anchor the animated currents field to the city's peak hour of the day.
  const flowTimeIso = useMemo(() => {
    if (!date) return null;
    let best = -1;
    let hr = 12;
    for (const s of displaySpots) {
      for (let h = 0; h < 24; h++) {
        const v = s.hours24[h];
        if (typeof v === "number" && v > best) {
          best = v;
          hr = h;
        }
      }
    }
    return best >= 0 ? zonedHourToUtcIso(date, hr, MAP_TZ) : null;
  }, [displaySpots, date]);

  const handleSelectSpot = useCallback(
    (slug: string) => {
      // Mobile has no rail/drawer — go straight to the spot page.
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width:1024px)").matches
      ) {
        router.push(`/explore/spot/${slug}`);
        return;
      }
      setStation(null);
      setSelectedSlug(slug);
      const spot = displaySpots.find((s) => s.slug === slug);
      if (spot) {
        mapRef.current?.flyTo({
          center: [spot.lng, spot.lat],
          zoom: Math.max(mapRef.current.getZoom() ?? 9, 11),
          duration: 700,
        });
      }
    },
    [router, displaySpots],
  );

  const handleSelectStation = useCallback((pick: StationPick) => {
    setSelectedSlug(null);
    setStation(pick);
    mapRef.current?.flyTo({
      center: [pick.lng, pick.lat],
      zoom: Math.max(mapRef.current.getZoom() ?? 9, 10),
      duration: 700,
    });
  }, []);

  // One map instance flips between the mobile in-flow block and the desktop
  // split pane — nudge GL on the breakpoint cross so tiles don't stay blank.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width:1024px)");
    const onChange = () =>
      requestAnimationFrame(() => mapRef.current?.getMap()?.resize());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const scored = spots.filter((s) => s.score !== null);
  const best = scored.length
    ? scored.reduce((a, b) => ((b.score ?? -1) > (a.score ?? -1) ? b : a))
    : null;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-5">
        <nav
          aria-label="Breadcrumb"
          className="font-rc-mono text-[11px] text-rc-ink-mute"
        >
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-rc-ink transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={provincePath}
                className="hover:text-rc-ink transition-colors"
              >
                Fishing in {city.provinceName}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-rc-ink-soft" aria-current="page">
              {city.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mt-2">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-rc-ink">
              Fishing in {city.name}, {city.provinceCode}
            </h1>
            <p className="font-rc-mono text-[12px] text-rc-ink-soft mt-1.5">
              {spots.length} spot{spots.length === 1 ? "" : "s"} ·{" "}
              {city.regionName}
              {best?.driverSpecies ? (
                <>
                  {" "}
                  · best today: {best.driverSpecies} {best.score}
                </>
              ) : null}
            </p>
          </div>
        </div>

        {intro && (
          <p className="text-rc-ink-soft mt-3 max-w-3xl text-[15px]">{intro}</p>
        )}
      </div>

      {/* ── Split: rail | map ──────────────────────────────────────── */}
      <div className="border-t border-rc-rule lg:flex">
        <aside className="hidden lg:flex h-[calc(100dvh-64px)] flex-col w-[400px] shrink-0 border-r border-rc-rule bg-rc-panel">
          {selectedSpot ? (
            <div
              key={selectedSpot.id}
              className="animate-fade-in h-full overflow-y-auto"
            >
              <SpotDrawer
                spot={selectedSpot}
                date={date}
                tz={MAP_TZ}
                onBack={() => setSelectedSlug(null)}
              />
            </div>
          ) : station ? (
            <div
              key={`${station.source}:${station.sid}`}
              className="h-full animate-fade-in"
            >
              <StationDrawer
                pick={station}
                tz={MAP_TZ}
                onBack={() => setStation(null)}
              />
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-0 animate-fade-in">
              <div className="border-b border-rc-rule px-3 pt-3 pb-2.5">
                <div className="flex items-end justify-between pb-2">
                  <div>
                    <div className="rc-label text-[9px]">
                      Viewing all spots
                    </div>
                    <div className="text-[15px] font-semibold text-rc-ink mt-0.5">
                      {railSpots.length} spot
                      {railSpots.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {railSpots.length > 1 && (
                    <SortControl sort={sort} onSort={setSort} />
                  )}
                </div>
                <MapFilterChips
                  relief={relief}
                  currents={currents}
                  wind={wind}
                  onToggleRelief={() => setRelief((v) => !v)}
                  onToggleCurrents={() => setCurrents((v) => !v)}
                  onToggleWind={() => setWind((v) => !v)}
                  species={species}
                  speciesFilter={speciesFilter}
                  onSpeciesChange={setSpeciesFilter}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-3 pt-3 pb-3 space-y-3">
                  {railSpots.map((spot) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      tz={MAP_TZ}
                      onSelect={() => handleSelectSpot(spot.slug)}
                      fresh={freshCatches?.spots[spot.id]}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        <div className="relative h-[45dvh] min-h-[280px] lg:h-[calc(100dvh-64px)] lg:flex-1">
          <ExploreMap
            mapRef={mapRef}
            spots={displaySpots}
            selectedSlug={selectedSpot?.slug ?? null}
            onSelect={handleSelectSpot}
            onSelectStation={handleSelectStation}
            initialCenter={{ lat: city.lat, lng: city.lng }}
            initialZoom={9.5}
            relief={relief}
            labels={true}
            currents={currents}
            wind={wind}
            hour={null}
            flowTimeIso={flowTimeIso}
            wdfwRegs={city.provinceCode === "WA"}
          />
        </div>
      </div>

      {/* Mobile list (component is lg:hidden internally). */}
      <MobileSpotList
        spots={displaySpots}
        tz={MAP_TZ}
        onSelectSpot={handleSelectSpot}
        freshCatches={freshCatches}
      />
    </div>
  );
}
