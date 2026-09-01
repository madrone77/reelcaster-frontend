"use client";

// The interactive half of a city page: a ranked spot rail beside a map.
//
// This used to be the WHOLE page — a header above a `calc(100dvh-64px)` split
// — and that height was the reason the page had nothing else on it. Anything
// placed after a viewport-tall map is off the bottom of the screen on desktop,
// which is why the species guides had been pushed ABOVE the split rather than
// below it, where they belong. Bounding the map to a fixed band turns the page
// back into a page: this is now one section in a scroll, not the destination.
//
// Everything else about the interaction is unchanged and still shares
// Explore's components, so a card, a pin and a drawer behave here exactly as
// they do there.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapRef } from "react-map-gl/maplibre";
import ExploreMap, {
  type StationPick,
} from "@/app/explore/components/explore-map";
import SpotCard from "@/app/explore/components/spot-card";
import SpotDrawer from "@/app/explore/components/spot-drawer";
import StationDrawer from "@/app/explore/components/station-drawer";
import MapFilterChips from "@/app/explore/components/map-filter-chips";
import MobileSpotList from "@/app/explore/components/mobile-spot-list";
import SortControl, {
  sortSpots,
  type SortKey,
} from "@/app/explore/components/sort-control";
import {
  zonedHourToUtcIso,
  type RailSpot,
  type SpeciesOption,
} from "@/app/explore/lib/explore-data";
import type { FreshCatchesResponse } from "@/app/explore/lib/fresh-catch-types";
import { useFlowLayer } from "@/app/explore/lib/use-flow";
import {
  fetchFreshCatches,
  fetchSpotsOutlook14d,
  type SpotsOutlook14dPayload,
} from "@/lib/bluecaster-client";
import { spotDaysFrom } from "@/app/explore/components/spot-day-strip";
import { useAuth } from "@/contexts/auth-context";
import type { FishingCity } from "@/app/fishing/lib/fishing-data";

const MAP_TZ = "America/Vancouver";

export default function CityShell({
  city,
  spots,
  species,
  date,
}: {
  city: FishingCity;
  spots: RailSpot[];
  species: SpeciesOption[];
  date: string;
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
  // Currents and Wind share one piece of state, so only ever one of them draws.
  const { currents, wind, toggleCurrents, toggleWind } = useFlowLayer();
  const [freshCatches, setFreshCatches] = useState<FreshCatchesResponse | null>(
    null,
  );
  // Every card's next 14 days in one read. undefined = still loading, so the
  // strip holds its space instead of the rail reflowing.
  const [outlook, setOutlook] = useState<
    SpotsOutlook14dPayload | null | undefined
  >(undefined);

  // Scraped catch reports, keyed by spot id, so a spot wears the same badge
  // here as it does on Explore. Additive: the page renders whole without it,
  // which is what a crawler gets. Re-runs when the session resolves, because
  // the Pro gate lives in the route and reads the access token.
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

  // One request for the whole rail rather than one per card. The horizon is
  // applied by the proxy (anon 2 days, free 7, Pro 14), so days past the
  // caller's tier arrive as nulls and each cell draws its own lock.
  useEffect(() => {
    let cancelled = false;
    setOutlook(undefined);
    fetchSpotsOutlook14d({ citySlug: city.slug })
      .then((p) => {
        if (!cancelled) setOutlook(p);
      })
      .catch(() => {
        if (!cancelled) setOutlook(null);
      });
    return () => {
      cancelled = true;
    };
  }, [city.slug, userId]);

  // Species filter re-scores every card and pin; null = best species per spot.
  const displaySpots = useMemo(() => {
    if (!speciesFilter) return spots;
    const name = species.find((s) => s.id === speciesFilter)?.name ?? null;
    return spots
      .map((s) => {
        const score = s.scoresBySpecies[speciesFilter] ?? null;
        return {
          ...s,
          score,
          bestSpeciesId: speciesFilter,
          driverSpecies: name,
        };
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
      // Mobile has no rail or drawer, so go straight to the spot page.
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

  // One map instance flips between the mobile block and the desktop pane, so
  // nudge GL on the breakpoint cross or tiles stay blank.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width:1024px)");
    const onChange = () =>
      requestAnimationFrame(() => mapRef.current?.getMap()?.resize());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="spots"
          className="text-xl font-semibold text-rc-ink"
        >
          {spots.length} spot{spots.length === 1 ? "" : "s"} around {city.name}
        </h2>
        <p className="font-rc-mono text-[11px] text-rc-ink-soft">
          Scores update through the day
        </p>
      </div>

      {/* Bounded band, not a viewport. See the note at the top of the file. */}
      <div className="rounded-lg border border-rc-rule overflow-hidden lg:flex">
        <aside className="hidden lg:flex h-[560px] flex-col w-[380px] shrink-0 border-r border-rc-rule bg-rc-panel">
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
                  <div className="rc-label text-[9px]">Ranked for today</div>
                  {railSpots.length > 1 && (
                    <SortControl sort={sort} onSort={setSort} />
                  )}
                </div>
                <MapFilterChips
                  relief={relief}
                  currents={currents}
                  wind={wind}
                  onToggleRelief={() => setRelief((v) => !v)}
                  onToggleCurrents={toggleCurrents}
                  onToggleWind={toggleWind}
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
                      showDayStrip
                      // The rail is under 400px. Fourteen labelled cells would
                      // be ~26px each, so this draws the shape of the
                      // fortnight and leaves the numbers to the spot page.
                      dayStripDensity="compact"
                      days14={
                        outlook === undefined
                          ? undefined
                          : spotDaysFrom(outlook, spot.id)
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        <div className="relative h-[380px] sm:h-[440px] lg:h-[560px] lg:flex-1">
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
            flowTimeIso={flowTimeIso}
            wdfwRegs={city.provinceCode === "WA"}
          />
        </div>
      </div>

      {/* Mobile list (the component is lg:hidden internally). */}
      <MobileSpotList
        spots={displaySpots}
        tz={MAP_TZ}
        onSelectSpot={handleSelectSpot}
        freshCatches={freshCatches}
      />
    </section>
  );
}
