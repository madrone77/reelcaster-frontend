"use client";

import { Fragment, useMemo, useState } from "react";
import { MapPinPlus } from "lucide-react";
import AdSlot from "@/app/components/ads/ad-slot";
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
import type { FreshCatchesResponse } from "../lib/fresh-catch-types";

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
  scrubHour,
  bottomInset,
  onSelectCity,
  onSelectSpot,
  onSearchSelectSpot,
  onSearchSelectRegion,
  onSearchSelectSpecies,
  searchNear,
  onCloseSpot,
  onCloseStation,
  onSpotHourHover,
  onSetAlert,
  freshCatches,
  mapControls,
  onCreateCustomSpot,
}: {
  locations: ProvinceNode[];
  selectedCity: CityNode | null;
  spots: RailSpot[];
  selectedSpot: RailSpot | null;
  selectedStation: StationPick | null;
  date: string;
  tz: string;
  /** Hour scrubbed on the 14-day strip (0–23) or null = day peak — forwarded
      to the spot drawer so scrubbing articulates the selected spot's card. */
  scrubHour: number | null;
  /** px gap from the viewport bottom — keeps the rail clear of the docked strip. */
  bottomInset: number;
  onSelectCity: (city: CityNode) => void;
  onSelectSpot: (slug: string) => void;
  /** Search picks — carry their own coordinates, since a searched spot is
      usually outside the viewport and so absent from the loaded payload. */
  onSearchSelectSpot: (slug: string, lat: number, lng: number) => void;
  onSearchSelectRegion: (bbox: number[]) => void;
  onSearchSelectSpecies: (id: string, name: string) => void;
  /** Viewport centre — tie-break only, never a filter. */
  searchNear?: { lat: number; lng: number };
  onCloseSpot: () => void;
  onCloseStation: () => void;
  /** Drawer 24h-chart hover hour (null on leave) — retunes the currents flow. */
  onSpotHourHover?: (hour: number | null) => void;
  /** Opens the create-alert modal in place for the drawer's spot. */
  onSetAlert?: (spot: RailSpot) => void;
  /** Scraped catch reports keyed by spot id. Already Pro-gated by the route —
   *  a free viewer's entries carry `locked: true` and no numbers. */
  freshCatches?: FreshCatchesResponse | null;
  mapControls: MapControlsProps;
  /** Arms map pin-drop for a new custom spot (Pro). Absent → the action is
   *  hidden (free viewers, or while placement is already armed). */
  onCreateCustomSpot?: () => void;
}) {
  const [sort, setSort] = useState<SortKey>("score");
  const sortedSpots = useMemo(() => sortSpots(spots, sort), [spots, sort]);

  // Names for the drawer's per-species report split. mapControls.species is the
  // map payload's dict, which has already had catch-and-release species dropped
  // — anything missing from it folds into "Other species" rather than being
  // named, which keeps intel consistent with what the map is willing to rank.
  const speciesNames = useMemo(
    () => Object.fromEntries(mapControls.species.map((s) => [s.id, s.name])),
    [mapControls.species],
  );

  // The spot list wants the full column (it scrolls); a drawer does not — it
  // has a fixed amount to say, and pinning it to the viewport floor stranded
  // ~400px of empty panel between the 24h chart and the action buttons. Cap
  // the drawer instead of anchoring it, so it ends where its content ends and
  // still scrolls if the viewport is too short to hold it.
  const drawerOpen = Boolean(selectedSpot || selectedStation);

  return (
    <aside
      style={
        drawerOpen
          ? { maxHeight: `calc(100vh - 72px - ${bottomInset}px)` }
          : { bottom: `${bottomInset}px` }
      }
      className="hidden lg:flex flex-col fixed left-6 top-[72px] w-96 z-30 bg-rc-panel/88 backdrop-blur-md rounded-xl border border-rc-rule shadow-rc-panel overflow-hidden transition-[bottom] duration-200"
    >
      {selectedSpot ? (
        <div key={selectedSpot.id} className="animate-fade-in flex flex-col min-h-0">
          <SpotDrawer
            spot={selectedSpot}
            date={date}
            tz={tz}
            scrubHour={scrubHour}
            onBack={onCloseSpot}
            onHourHover={onSpotHourHover}
            onSetAlert={onSetAlert}
            fresh={freshCatches?.spots[selectedSpot.id]}
            freshDays={freshCatches?.days ?? 21}
            freshSpeciesNames={speciesNames}
          />
        </div>
      ) : selectedStation ? (
        <div
          key={`${selectedStation.source}:${selectedStation.sid}`}
          className="animate-fade-in flex flex-col min-h-0"
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
              onSelectSpot={onSearchSelectSpot}
              onSelectRegion={onSearchSelectRegion}
              onSelectSpecies={onSearchSelectSpecies}
              near={searchNear}
              mapControls={mapControls}
            />
            <div className="px-3 pt-1 pb-2.5">
              <div className="pb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="rc-label text-[9px]">Viewing all spots</div>
                  <div className="text-[15px] font-semibold text-rc-ink mt-0.5">
                    {spots.length} spot{spots.length === 1 ? "" : "s"}
                  </div>
                </div>
                {onCreateCustomSpot && (
                  <button
                    type="button"
                    onClick={onCreateCustomSpot}
                    className="shrink-0 flex items-center gap-1.5 rounded-full bg-rc-brand px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
                  >
                    <MapPinPlus className="h-4 w-4 shrink-0" />
                    Create custom spot
                  </button>
                )}
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
                {sortedSpots.map((spot, i) => (
                  <Fragment key={spot.id}>
                    <SpotCard
                      spot={spot}
                      tz={tz}
                      onSelect={() => onSelectSpot(spot.slug)}
                      fresh={freshCatches?.spots[spot.id]}
                    />
                    {/* Card-shaped unit in the flow of the list, never over the
                        map. Sits after the third spot so the top of the rail is
                        the ranking itself; a short list gets it at the foot
                        instead of not at all. */}
                    {i === Math.min(2, sortedSpots.length - 1) && (
                      <AdSlot placement="exploreList" only="desktop" />
                    )}
                  </Fragment>
                ))}
              </div>

              {spots.length === 0 && (
                <div className="text-center py-10 px-4">
                  <p className="text-sm font-semibold text-rc-ink mb-1">
                    No published spots here yet
                  </p>
                  <p className="text-xs text-rc-ink-mute">
                    Coverage is rolling out across BC, WA, and OR, and new spots are
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
