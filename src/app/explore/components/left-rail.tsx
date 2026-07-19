"use client";

import { useMemo, useState } from "react";
import {
  type CityNode,
  type ProvinceNode,
  type RailSpot,
  type SpeciesOption,
} from "../lib/explore-data";
import LocationSelector from "./location-selector";
import MapFilterChips from "./map-filter-chips";
import SortControl, { type SortKey, sortSpots } from "./sort-control";
import SpotCard from "./spot-card";
import SpotDrawer from "./spot-drawer";
import StationDrawer from "./station-drawer";
import type { StationPick } from "./explore-map";

interface MapControlsProps {
  relief: boolean;
  labels: boolean;
  currents: boolean;
  wind: boolean;
  onToggleRelief: () => void;
  onToggleLabels: () => void;
  onToggleCurrents: () => void;
  onToggleWind: () => void;
  species: SpeciesOption[];
  speciesFilter: string | null;
  onSpeciesChange: (id: string | null) => void;
  onNearMe: () => void;
  locating: boolean;
}

/**
 * The single floating left slot (384px, 24px gutter) per the Figma spec.
 * Holds the location selector + spot list OR the spot/station drawer —
 * never both; the swap crossfades in place. Panels never push the map.
 */
export default function LeftRail({
  locations,
  selectedCity,
  spots,
  selectedSpot,
  selectedStation,
  date,
  tz,
  bottomInset,
  onSelectCity,
  onSelectSpot,
  onCloseSpot,
  onCloseStation,
  onSpotHourHover,
  mapControls,
}: {
  locations: ProvinceNode[];
  selectedCity: CityNode | null;
  spots: RailSpot[];
  selectedSpot: RailSpot | null;
  selectedStation: StationPick | null;
  date: string;
  tz: string;
  /** px gap from the viewport bottom — keeps the rail clear of the docked strip. */
  bottomInset: number;
  onSelectCity: (city: CityNode) => void;
  onSelectSpot: (slug: string) => void;
  onCloseSpot: () => void;
  onCloseStation: () => void;
  /** Drawer 24h-chart hover hour (null on leave) — retunes the currents flow. */
  onSpotHourHover?: (hour: number | null) => void;
  mapControls: MapControlsProps;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const sortedSpots = useMemo(() => sortSpots(spots, sort), [spots, sort]);

  return (
    <aside
      style={{ bottom: `${bottomInset}px` }}
      className="hidden lg:flex flex-col fixed left-6 top-[72px] w-96 z-30 bg-rc-panel/88 backdrop-blur-md rounded-xl border border-rc-rule shadow-rc-panel overflow-hidden transition-[bottom] duration-200"
    >
      {selectedSpot ? (
        <div key={selectedSpot.id} className="animate-fade-in h-full overflow-y-auto">
          <SpotDrawer
            spot={selectedSpot}
            date={date}
            tz={tz}
            onBack={onCloseSpot}
            onHourHover={onSpotHourHover}
          />
        </div>
      ) : selectedStation ? (
        <div
          key={`${selectedStation.source}:${selectedStation.sid}`}
          className="h-full animate-fade-in"
        >
          <StationDrawer pick={selectedStation} tz={tz} onBack={onCloseStation} />
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0 animate-fade-in">
          {/* Sticky header — location, "Viewing all spots", and the map-filter
              chips. Breaker line below; the spot list scrolls beneath. */}
          <div className="border-b border-[#E5E9EF]">
            <LocationSelector
              locations={locations}
              selectedCity={selectedCity}
              onSelectCity={onSelectCity}
              mapControls={mapControls}
            />
            <div className="px-3 pt-1 pb-2.5">
              <div className="pb-2">
                <div className="rc-label text-[9px]">Viewing all spots</div>
                <div className="text-[15px] font-semibold text-rc-ink mt-0.5">
                  {spots.length} spot{spots.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <MapFilterChips
                  relief={mapControls.relief}
                  currents={mapControls.currents}
                  wind={mapControls.wind}
                  onToggleRelief={mapControls.onToggleRelief}
                  onToggleCurrents={mapControls.onToggleCurrents}
                  onToggleWind={mapControls.onToggleWind}
                  species={mapControls.species}
                  speciesFilter={mapControls.speciesFilter}
                  onSpeciesChange={mapControls.onSpeciesChange}
                />
                {spots.length > 1 && (
                  <div className="ml-auto shrink-0">
                    <SortControl sort={sort} onSort={setSort} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Padding lives on the inner wrapper so the scrollbar sits outside
              it — keeps the cards visually centered (equal left/right gap). */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-3 pt-3 pb-3">
              <div className="space-y-3">
                {sortedSpots.map((spot) => (
                  <SpotCard
                    key={spot.id}
                    spot={spot}
                    tz={tz}
                    onSelect={() => onSelectSpot(spot.slug)}
                  />
                ))}
              </div>

              {spots.length === 0 && (
                <div className="text-center py-10 px-4">
                  <p className="text-sm font-semibold text-rc-ink mb-1">
                    No published spots here yet
                  </p>
                  <p className="text-xs text-rc-ink-mute">
                    Coverage is rolling out across BC, WA, and OR — new spots are
                    added every week.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
