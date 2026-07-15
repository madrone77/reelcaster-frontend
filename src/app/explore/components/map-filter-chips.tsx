"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  TIER_SCORE_TEXT,
  tierFor,
  type SpeciesOption,
} from "../lib/explore-data";

export interface MapFilterChipsProps {
  relief: boolean;
  currents: boolean;
  wind: boolean;
  onToggleRelief: () => void;
  onToggleCurrents: () => void;
  onToggleWind: () => void;
  species: SpeciesOption[];
  speciesFilter: string | null;
  onSpeciesChange: (id: string | null) => void;
}

/**
 * Surfaced map-filter chips for the left rail — Bathymetry / Currents / Wind as
 * inline layer-toggle chips, plus a "Species" chip that opens the species
 * dropdown. Replaces the old filter-icon dropdown.
 */
export default function MapFilterChips({
  relief,
  currents,
  wind,
  onToggleRelief,
  onToggleCurrents,
  onToggleWind,
  species,
  speciesFilter,
  onSpeciesChange,
}: MapFilterChipsProps) {
  const [bestOpen, setBestOpen] = useState(false);
  const bestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bestOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!bestRef.current?.contains(e.target as Node)) setBestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [bestOpen]);

  const toggles: Array<[string, boolean, () => void]> = [
    ["Bathymetry", relief, onToggleRelief],
    ["Currents", currents, onToggleCurrents],
    ["Wind", wind, onToggleWind],
  ];

  const selected = species.find((s) => s.id === speciesFilter);
  const bestLabel = selected ? selected.name : "Species";
  const bestActive = speciesFilter !== null || bestOpen;
  const allBestScore = species.reduce<number | null>(
    (max, s) =>
      s.bestScore !== null && (max === null || s.bestScore > max)
        ? s.bestScore
        : max,
    null,
  );

  const chipBase = "px-2.5 py-1 rounded text-[11px] transition-colors";
  const chipOn = "bg-rc-brand-soft border border-rc-brand text-rc-ink font-semibold";
  // Explicitly white, not transparent: in the rail these sit on a white panel
  // so a bare outline looked fine, but the chips also overlay the map on the
  // marketing section — where the bathymetry showed straight through the label.
  const chipOff =
    "bg-rc-panel border border-rc-rule text-rc-ink-soft font-medium hover:bg-rc-surface";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {toggles.map(([label, active, onToggle]) => (
        <button
          key={label}
          type="button"
          onClick={onToggle}
          aria-pressed={active}
          className={`${chipBase} ${active ? chipOn : chipOff}`}
        >
          {label}
        </button>
      ))}

      {species.length > 0 && (
        <div ref={bestRef} className="relative">
          <button
            type="button"
            onClick={() => setBestOpen((v) => !v)}
            aria-expanded={bestOpen}
            className={`${chipBase} flex items-center gap-1 ${bestActive ? chipOn : chipOff}`}
          >
            <span className="truncate max-w-[110px]">{bestLabel}</span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${bestOpen ? "rotate-180" : ""}`}
            />
          </button>

          {bestOpen && (
            <div className="absolute right-0 top-full mt-1 z-40 w-48 max-h-[240px] overflow-y-auto bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel p-1">
              {[{ id: null, name: "All", bestScore: allBestScore }, ...species].map(
                (s) => {
                  const isSel = speciesFilter === s.id;
                  return (
                    <button
                      key={s.id ?? "__all"}
                      type="button"
                      onClick={() => {
                        onSpeciesChange(s.id);
                        setBestOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 pl-3 pr-2 py-1 text-[11px] rounded transition-colors ${
                        isSel
                          ? "bg-rc-brand-soft text-rc-ink font-semibold"
                          : "text-rc-ink-soft font-medium hover:bg-rc-surface"
                      }`}
                    >
                      <span className="truncate min-w-0">{s.name}</span>
                      {s.bestScore !== null && (
                        <span
                          className={`shrink-0 font-rc-mono tabular-nums ${TIER_SCORE_TEXT[tierFor(s.bestScore)]}`}
                        >
                          ({s.bestScore})
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
