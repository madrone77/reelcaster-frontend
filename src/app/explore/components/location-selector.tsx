"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import {
  TIER_PILL,
  tierFor,
  type CityNode,
  type ProvinceNode,
} from "../lib/explore-data";

/**
 * City search. Picking a city does NOT filter the spot list — it flies the map
 * to that city at a fixed zoom, and the rail then lists whatever is in view.
 * (The old province → region → city tree implied cities *contain* spots; they
 * don't. Spots are geographic; the viewport decides what you see.)
 */
export default function LocationSelector({
  locations,
  selectedCity,
  onSelectCity,
  onFilterClick,
}: {
  locations: ProvinceNode[];
  selectedCity: CityNode | null;
  onSelectCity: (city: CityNode) => void;
  /** Mobile only — opens the map-filter sheet. Omitted on desktop (inert). */
  onFilterClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten the hierarchy once — it's only a browse affordance now.
  const allCities = useMemo(
    () => locations.flatMap((prov) => prov.regions.flatMap((r) => r.cities)),
    [locations],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCities;
    return allCities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.regionName.toLowerCase().includes(q),
    );
  }, [allCities, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus the field when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = (city: CityNode) => {
    onSelectCity(city);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-rc-surface transition-colors min-w-0"
          aria-expanded={open}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-rc-brand-soft shrink-0">
            <MapPin className="w-4 h-4 text-rc-brand" />
          </span>
          <span className="font-semibold text-[15px] text-rc-ink truncate">
            {selectedCity ? selectedCity.name : "Search a city"}
          </span>
          <Search className="w-4 h-4 text-rc-ink-mute shrink-0 ml-auto" />
        </button>
        <button
          type="button"
          aria-label="Filters"
          onClick={onFilterClick}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-rc-rule text-rc-ink-soft hover:bg-rc-surface transition-colors shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="absolute left-2 right-2 top-full z-20 mt-1 bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-rc-rule">
            <Search className="w-4 h-4 text-rc-ink-mute shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) pick(results[0]);
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search a city…"
              className="flex-1 bg-transparent text-sm text-rc-ink placeholder:text-rc-ink-mute outline-none py-1"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQuery("")}
                className="text-rc-ink-mute hover:text-rc-ink shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto py-1">
            {results.map((city) => {
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
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{city.name}</span>
                    <span className="block text-[11px] text-rc-ink-mute truncate">
                      {city.regionName}
                    </span>
                  </span>
                  {city.bestScore !== null && (
                    <span
                      className={`ml-auto shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${TIER_PILL[tier]}`}
                    >
                      {city.bestScore}
                    </span>
                  )}
                </button>
              );
            })}

            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-rc-ink-mute">
                No city matches “{query}”.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
