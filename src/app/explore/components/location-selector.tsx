"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, LocateFixed, MapPin, SlidersHorizontal } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TIER_PILL,
  tierFor,
  type CityNode,
  type ProvinceNode,
  type SpeciesOption,
} from "../lib/explore-data";

interface MapControlsProps {
  relief: boolean;
  labels: boolean;
  currents: boolean;
  onToggleRelief: () => void;
  onToggleLabels: () => void;
  onToggleCurrents: () => void;
  species: SpeciesOption[];
  speciesFilter: string | null;
  onSpeciesChange: (id: string | null) => void;
  onNearMe: () => void;
  locating: boolean;
}

/**
 * The rail header from the Figma ("Victoria · Vancouver Island South" + ⌄
 * and a filter button). The chevron expands an in-rail tree of locations —
 * province → region groups, each expandable down to cities — satisfying
 * "locations on the left panel, expand each location".
 */
export default function LocationSelector({
  locations,
  selectedCity,
  onSelectCity,
  onFilterClick,
  mapControls,
}: {
  locations: ProvinceNode[];
  selectedCity: CityNode | null;
  onSelectCity: (city: CityNode) => void;
  /** Mobile only — opens the map-filter sheet. Omitted on desktop (inert). */
  onFilterClick?: () => void;
  /** Desktop only — map layer controls shown in filter dropdown. */
  mapControls?: MapControlsProps;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (selectedCity) {
      initial.add(`${selectedCity.provinceCode}/${selectedCity.regionSlug}`);
    }
    return initial;
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the tree on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 shrink min-w-0 py-1 px-1 rounded hover:bg-rc-surface transition-colors"
          aria-expanded={open}
        >
          <MapPin className="w-4 h-4 text-rc-ink-mute shrink-0" />
          <span className="font-semibold text-[15px] text-rc-ink truncate">
            {selectedCity
              ? `${selectedCity.name} · ${selectedCity.regionName}`
              : "All locations"}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-rc-ink-mute shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {onFilterClick && !mapControls && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              aria-label="Filters"
              onClick={onFilterClick}
              className="flex items-center justify-center w-8 h-8 rounded border border-rc-rule text-rc-ink-soft hover:bg-rc-surface transition-colors shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="absolute left-2 right-2 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel py-1">
          {mapControls && (
            <>
              <button
                type="button"
                onClick={() => { mapControls.onNearMe(); setOpen(false); }}
                disabled={mapControls.locating}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-rc-ink hover:bg-rc-surface transition-colors disabled:opacity-60"
              >
                {mapControls.locating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rc-ink-mute shrink-0" />
                ) : (
                  <LocateFixed className="w-4 h-4 text-rc-ink-mute shrink-0" />
                )}
                Near me
              </button>
              <div className="h-px bg-rc-rule mx-2 my-1" />
            </>
          )}
          {locations.map((prov) => (
            <div key={prov.code} className="py-1">
              <div className="rc-label px-3 py-1.5">{prov.name}</div>
              {prov.regions.map((region) => {
                const key = `${prov.code}/${region.slug}`;
                const isOpen = expanded.has(key);
                return (
                  <Collapsible
                    key={key}
                    open={isOpen}
                    onOpenChange={() => toggleGroup(key)}
                  >
                    <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rc-surface transition-colors">
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-rc-ink-mute transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                      <span className="text-sm font-medium text-rc-ink truncate">
                        {region.name}
                      </span>
                      <span className="rc-label text-[9px] ml-auto shrink-0">
                        {region.cities.reduce((n, c) => n + c.spotCount, 0)}{" "}
                        spots
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {region.cities.map((city) => {
                        const tier = tierFor(city.bestScore);
                        const isSelected = selectedCity?.slug === city.slug;
                        return (
                          <button
                            key={city.slug}
                            type="button"
                            onClick={() => {
                              onSelectCity(city);
                              setOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 pl-9 pr-3 py-2 text-left transition-colors ${
                              isSelected
                                ? "bg-rc-brand-soft text-rc-brand"
                                : "hover:bg-rc-surface text-rc-ink"
                            }`}
                          >
                            <span className="text-sm truncate">{city.name}</span>
                            <span className="font-rc-mono text-[10px] text-rc-ink-mute ml-auto shrink-0">
                              {city.spotCount} spot{city.spotCount === 1 ? "" : "s"}
                            </span>
                            {city.bestScore !== null && (
                              <span
                                className={`shrink-0 px-1.5 py-0.5 rounded font-rc-mono text-[11px] font-bold ${TIER_PILL[tier]}`}
                              >
                                {city.bestScore}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
