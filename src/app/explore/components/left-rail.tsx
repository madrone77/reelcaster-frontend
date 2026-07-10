"use client";

import {
  type CityNode,
  type ProvinceNode,
  type RailSpot,
} from "../lib/explore-data";
import LocationSelector from "./location-selector";
import SpotCard from "./spot-card";
import SpotDrawer from "./spot-drawer";

/**
 * The single floating left slot (384px, 24px gutter) per the Figma spec.
 * Holds the location selector + spot list OR the spot drawer — never both;
 * the swap crossfades in place. Panels never push the map.
 */
export default function LeftRail({
  locations,
  selectedCity,
  spots,
  selectedSpot,
  date,
  tz,
  onSelectCity,
  onSelectSpot,
  onCloseSpot,
}: {
  locations: ProvinceNode[];
  selectedCity: CityNode | null;
  spots: RailSpot[];
  selectedSpot: RailSpot | null;
  date: string;
  tz: string;
  onSelectCity: (city: CityNode) => void;
  onSelectSpot: (slug: string) => void;
  onCloseSpot: () => void;
}) {
  return (
    <aside className="hidden lg:flex flex-col fixed left-6 top-20 bottom-6 w-96 z-30 bg-rc-panel rounded-xl border border-rc-rule shadow-rc-panel overflow-hidden">
      {selectedSpot ? (
        <div key={selectedSpot.id} className="h-full animate-fade-in">
          <SpotDrawer
            spot={selectedSpot}
            date={date}
            tz={tz}
            onBack={onCloseSpot}
          />
        </div>
      ) : (
        <div className="flex flex-col h-full animate-fade-in">
          <LocationSelector
            locations={locations}
            selectedCity={selectedCity}
            onSelectCity={onSelectCity}
          />

          <div className="rc-label text-[9px] px-4 pt-1 pb-2">
            {spots.length > 0
              ? `${spots.length} spot${spots.length === 1 ? "" : "s"} in view`
              : "Spots in view"}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
            {spots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                onSelect={() => onSelectSpot(spot.slug)}
              />
            ))}

            {spots.length === 0 && (
              <div className="text-center py-10 px-4">
                <p className="text-sm font-semibold text-rc-ink mb-1">
                  No spots in view
                </p>
                <p className="text-xs text-rc-ink-mute">
                  Pan or zoom out to find spots, or search a city above.
                  Coverage is rolling out across BC, WA, and OR.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
