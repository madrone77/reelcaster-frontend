"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, LocateFixed, MapPin, Search, SlidersHorizontal } from "lucide-react";
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
 * The rail header pill ("Victoria · South Vancouver Island" + ⌄). The map is
 * viewport-driven — spots, rail and the 14-day strip always reflect what's in
 * view — so this is just a fast way to MOVE the viewport: a flat city search
 * (plus "Near me") that flies the map to the picked city. The pill label
 * tracks the nearest covered city to the viewport centre as the user pans.
 */
export default function LocationSelector({
  locations,
  selectedCity,
  onSelectCity,
  onFilterClick,
  mapControls,
}: {
  locations: ProvinceNode[];
  /** City the pill labels — the nearest covered city to the viewport centre. */
  selectedCity: CityNode | null;
  onSelectCity: (city: CityNode) => void;
  /** Mobile only — opens the map-filter sheet. Omitted on desktop (inert). */
  onFilterClick?: () => void;
  /** Desktop only — supplies the "Near me" action. */
  mapControls?: MapControlsProps;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  // Flat searchable city list (hierarchy order), matched on city or region name.
  const cities = useMemo(() => {
    const all: CityNode[] = [];
    for (const prov of locations)
      for (const region of prov.regions) all.push(...region.cities);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.regionName.toLowerCase().includes(q),
    );
  }, [locations, query]);

  const pick = (city: CityNode) => {
    setOpen(false);
    onSelectCity(city);
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
          {/* City search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-rc-rule">
            <Search className="w-4 h-4 text-rc-ink-mute shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cities.length > 0) pick(cities[0]);
              }}
              placeholder="Search city…"
              className="w-full bg-transparent text-sm text-rc-ink outline-none placeholder:text-rc-ink-mute"
            />
          </div>

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

          {cities.length === 0 ? (
            <div className="px-3 py-3 text-sm text-rc-ink-mute">
              No cities match “{query}”
            </div>
          ) : (
            cities.map((city) => {
              const tier = tierFor(city.bestScore);
              const isSelected = selectedCity?.slug === city.slug;
              return (
                <button
                  key={city.slug}
                  type="button"
                  onClick={() => pick(city)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-rc-brand-soft text-rc-brand"
                      : "hover:bg-rc-surface text-rc-ink"
                  }`}
                >
                  <span className="text-sm truncate">{city.name}</span>
                  <span className="rc-label text-[9px] truncate shrink min-w-0">
                    {city.regionName}
                  </span>
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
            })
          )}
        </div>
      )}
    </div>
  );
}
