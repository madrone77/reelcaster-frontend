"use client";

import { useState } from "react";
import { ChevronUp, X } from "lucide-react";
import {
  type CityNode,
  type ProvinceNode,
  type RailSpot,
} from "../lib/explore-data";
import LocationSelector from "./location-selector";
import SpotCard from "./spot-card";
import SpotDrawer from "./spot-drawer";

/**
 * Mobile (<lg) replacement for the left rail: a bottom sheet with a peek
 * bar. Collapsed it shows a one-line summary; expanded it hosts the same
 * list / drawer content. The map stays interactive behind the peek bar.
 */
export default function MobileSheet({
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
  const [expanded, setExpanded] = useState(false);

  // A pin tap selects a spot → force the sheet open in drawer mode.
  const open = expanded || selectedSpot !== null;

  const best = spots.find((s) => s.score !== null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-rc-panel border-t border-rc-rule shadow-rc-panel rounded-t-2xl px-4 py-3 flex items-center gap-2 safe-area-bottom"
      >
        <span className="text-sm font-semibold text-rc-ink truncate">
          {spots.length} spot{spots.length === 1 ? "" : "s"}
          {selectedCity ? ` · ${selectedCity.name}` : ""}
        </span>
        {best && (
          <span className="font-rc-mono text-xs text-rc-ink-mute truncate">
            best {best.score} · {best.name}
          </span>
        )}
        <ChevronUp className="w-4 h-4 text-rc-ink-mute ml-auto shrink-0" />
      </button>
    );
  }

  return (
    <>
      <div
        className="lg:hidden fixed inset-0 bg-black/30 z-30"
        onClick={() => {
          setExpanded(false);
          onCloseSpot();
        }}
      />
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 max-h-[80vh] h-[70vh] bg-rc-panel rounded-t-2xl shadow-rc-panel flex flex-col animate-slide-up safe-area-bottom">
        {selectedSpot ? (
          <SpotDrawer
            spot={selectedSpot}
            date={date}
            tz={tz}
            onBack={onCloseSpot}
          />
        ) : (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pr-2">
              <div className="flex-1 min-w-0">
                <LocationSelector
                  locations={locations}
                  selectedCity={selectedCity}
                  onSelectCity={onSelectCity}
                />
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close"
                className="p-2 rounded-md text-rc-ink-mute hover:bg-rc-surface shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
              {spots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  tz={tz}
                  onSelect={() => onSelectSpot(spot.slug)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
