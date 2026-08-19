"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  ChevronDown,
  Fish,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  TIER_PILL,
  tierFor,
  type CityNode,
  type ProvinceNode,
  type SpeciesOption,
} from "../lib/explore-data";
import {
  groupResults,
  useFlatNavigation,
  useSearch,
  type SearchResult,
} from "../lib/use-search";

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

const KIND_ICON = {
  spot: MapPin,
  city: Building2,
  region: MapIcon,
  species: Fish,
} as const;

/**
 * The rail header pill ("Victoria · South Vancouver Island" + ⌄) and the
 * Explore search.
 *
 * The map is viewport-driven — spots, rail and the 14-day strip always reflect
 * what's in view — so search is how you MOVE the viewport to something you
 * can't see yet.
 *
 * Two modes share one panel:
 *  - **Empty query — browse.** The flat city list, as before. Still the fastest
 *    path when you just want to hop between covered cities.
 *  - **Typing — search.** A debounced server query across spots, cities, areas
 *    and species. Results arrive pre-ranked and flat; we group them for display
 *    but never re-sort inside a group, because that order IS the ranking.
 *
 * Picking a result moves the map (or, for species, applies the filter). It
 * never filters the rail by name — the rail follows the viewport, always.
 */
export default function LocationSelector({
  locations,
  selectedCity,
  onSelectCity,
  onSelectSpot,
  onSelectRegion,
  onSelectSpecies,
  onFilterClick,
  mapControls,
  near,
}: {
  locations: ProvinceNode[];
  /** City the pill labels — the nearest covered city to the viewport centre. */
  selectedCity: CityNode | null;
  onSelectCity: (city: CityNode) => void;
  /** Search pick: fly to the spot's own coordinates and open its card. */
  onSelectSpot: (slug: string, lat: number, lng: number) => void;
  /** Search pick: frame a whole area from its bbox [w,s,e,n]. */
  onSelectRegion: (bbox: number[]) => void;
  /** Search pick: pin the species filter rather than moving the map. */
  onSelectSpecies: (id: string, name: string) => void;
  /** Mobile only — opens the map-filter sheet. Omitted on desktop (inert). */
  onFilterClick?: () => void;
  /** Desktop only — supplies the "Near me" action. */
  mapControls?: MapControlsProps;
  /** Viewport centre, used only to break ties between equally good matches. */
  near?: { lat: number; lng: number };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searching = query.trim().length >= 2;
  const { results, loading, truncated, settled } = useSearch(query, near);
  const groups = useMemo(() => groupResults(results), [results]);
  const [flat, active, setActive, handleNavKey] = useFlatNavigation(groups);

  // On mobile the panel is a portaled bottom sheet (outside rootRef), so the
  // scrim + Escape own dismissal there; the outside-click close is desktop-only.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Close on outside click (desktop) / Escape (both).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (isMobile) return;
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
  }, [open, isMobile]);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  // Keep the keyboard-selected row in view as arrows walk past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-nav-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Flat city list for browse mode (hierarchy order — cities are pre-sorted by
  // best score within each region).
  const cities = useMemo(() => {
    const all: CityNode[] = [];
    for (const prov of locations)
      for (const region of prov.regions) all.push(...region.cities);
    return all;
  }, [locations]);

  const pickCity = (city: CityNode) => {
    setOpen(false);
    onSelectCity(city);
  };

  const pickResult = (r: SearchResult) => {
    setOpen(false);
    switch (r.kind) {
      case "spot":
        // Fly to the result's OWN coordinates rather than looking the spot up
        // in the loaded payload — the whole point of search is reaching a spot
        // that isn't in the viewport yet, so it usually isn't loaded.
        if (r.lat !== null && r.lng !== null) onSelectSpot(r.slug, r.lat, r.lng);
        break;
      case "city": {
        // Prefer the real CityNode so the pill, deep link and framing behave
        // exactly as a browse pick. Falls back to a synthetic node for a city
        // that isn't in the SSR tree.
        const node =
          cities.find((c) => c.slug === r.slug) ??
          ({
            slug: r.slug,
            name: r.name,
            regionName: r.label ?? "",
            lat: r.lat ?? 0,
            lng: r.lng ?? 0,
            spotCount: Number(r.meta?.spot_count ?? 0),
            bestScore: null,
          } as CityNode);
        onSelectCity(node);
        break;
      }
      case "region":
        if (r.bbox && r.bbox.length === 4) onSelectRegion(r.bbox);
        break;
      case "species":
        onSelectSpecies(r.id, r.name);
        break;
    }
  };

  const rowClass = (isActive: boolean, isSelected = false) =>
    `w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
      isSelected
        ? "bg-rc-brand-soft text-rc-brand"
        : isActive
          ? "bg-rc-surface text-rc-ink"
          : "hover:bg-rc-surface text-rc-ink"
    }`;

  // Shared panel content, rendered into either the desktop anchored dropdown
  // or the mobile portaled bottom sheet.
  const panelBody = (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-rc-rule">
        <Search className="w-4 h-4 text-rc-ink-mute shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (searching) {
              const picked = handleNavKey(e);
              if (picked) pickResult(picked);
              return;
            }
            if (e.key === "Enter" && cities.length > 0) pickCity(cities[0]);
          }}
          placeholder="Search spots, cities, species…"
          aria-label="Search spots, cities, areas and species"
          className="w-full bg-transparent text-sm text-rc-ink outline-none placeholder:text-rc-ink-mute"
        />
        {loading && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rc-ink-mute shrink-0" />
        )}
      </div>

      <div ref={listRef}>
        {!searching && mapControls && (
          <>
            <button
              type="button"
              onClick={() => {
                mapControls.onNearMe();
                setOpen(false);
              }}
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

        {/* Browse mode — the flat city list. */}
        {!searching &&
          cities.map((city) => {
            const tier = tierFor(city.bestScore);
            const isSelected = selectedCity?.slug === city.slug;
            return (
              <button
                key={city.slug}
                type="button"
                onClick={() => pickCity(city)}
                className={rowClass(false, isSelected)}
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
          })}

        {/* Search mode — grouped, rank-ordered results. */}
        {searching &&
          groups.map((group) => (
            <div key={group.kind}>
              <div className="px-3 pt-2 pb-1 rc-label text-[9px] text-rc-ink-mute">
                {group.heading}
              </div>
              {group.items.map((r) => {
                const Icon = KIND_ICON[r.kind];
                const navIndex = flat.indexOf(r);
                return (
                  <button
                    key={`${r.kind}:${r.id}`}
                    type="button"
                    data-nav-index={navIndex}
                    onMouseEnter={() => setActive(navIndex)}
                    onClick={() => pickResult(r)}
                    className={rowClass(navIndex === active)}
                  >
                    <Icon className="w-3.5 h-3.5 text-rc-ink-mute shrink-0" />
                    <span className="text-sm truncate">{r.name}</span>
                    {r.owned && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-rc-brand-soft text-rc-brand rc-label text-[9px]">
                        Yours
                      </span>
                    )}
                    {r.label && (
                      <span className="rc-label text-[9px] truncate shrink min-w-0">
                        {r.label}
                      </span>
                    )}
                    {r.kind === "city" && r.meta?.spot_count != null && (
                      <span className="font-rc-mono text-[10px] text-rc-ink-mute ml-auto shrink-0">
                        {String(r.meta.spot_count)} spot
                        {Number(r.meta.spot_count) === 1 ? "" : "s"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

        {/* Only claim "no matches" once a response has actually landed —
            otherwise the first keystroke flashes an empty state before the
            debounce has even fired. */}
        {searching && settled && !loading && groups.length === 0 && (
          <div className="px-3 py-3 text-sm text-rc-ink-mute">
            No matches for “{query.trim()}”
          </div>
        )}

        {searching && truncated && groups.length > 0 && (
          <div className="px-3 py-2 text-[11px] text-rc-ink-mute border-t border-rc-rule mt-1">
            Showing the closest matches — keep typing to narrow.
          </div>
        )}
      </div>
    </>
  );

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
              // Mobile-only (desktop passes mapControls instead), so it can be
              // sized for a thumb rather than a cursor.
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-rc-rule text-rc-ink-soft hover:bg-rc-surface transition-colors shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Desktop — anchored dropdown below the pill. */}
      {open && !isMobile && (
        <div className="absolute left-2 right-2 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel py-1">
          {panelBody}
        </div>
      )}

      {/* Mobile — a bottom sheet (matching the filter sheet, so location +
          filter open the same way). Portaled to <body> so it escapes the
          header's stacking context and layers above the map + spot sheet. */}
      {open &&
        isMobile &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setOpen(false)}
            />
            {/* Rides above the floating tab bar, like the filter sheet it sits
                beside in the header. The clearance already carries the safe
                area, so the sheet's own padding does not repeat it. */}
            <div
              style={{ bottom: "var(--rc-tabbar-clearance)" }}
              className="fixed inset-x-0 z-[61] max-h-[75vh] overflow-y-auto bg-rc-panel rounded-t-2xl shadow-rc-panel animate-slide-up pb-2"
            >
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1 w-9 rounded-full bg-rc-rule" />
              </div>
              {panelBody}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
