"use client";

import { Mountain, Tag, Waves, Fish, LocateFixed, Loader2 } from "lucide-react";
import type { SpeciesOption } from "../lib/explore-data";

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

function Chip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Mountain;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? "bg-rc-brand-soft text-rc-brand"
          : "text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink-soft"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/**
 * Floating map-layer controls — relief/labels/currents toggles + species
 * filter. Docked bottom-left, clear of the rail (desktop) and the bottom
 * sheet peek (mobile). Mirrors BlueCaster's MapExplorer toggle set.
 */
export default function MapControls({
  relief,
  labels,
  currents,
  onToggleRelief,
  onToggleLabels,
  onToggleCurrents,
  species,
  speciesFilter,
  onSpeciesChange,
  onNearMe,
  locating,
}: MapControlsProps) {
  return (
    <div className="fixed z-30 bottom-28 left-1/2 -translate-x-1/2 lg:bottom-6 lg:left-[420px] lg:translate-x-0 flex items-center gap-1 bg-rc-panel/95 backdrop-blur border border-rc-rule rounded-xl shadow-rc-panel p-1.5">
      <button
        type="button"
        onClick={onNearMe}
        disabled={locating}
        aria-label="Find spots near me"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink-soft transition-colors disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <LocateFixed className="w-3.5 h-3.5" />
        )}
        Near me
      </button>
      <span className="w-px h-5 bg-rc-rule mx-0.5" aria-hidden />
      <Chip active={relief} onClick={onToggleRelief} icon={Mountain} label="Relief" />
      <Chip active={labels} onClick={onToggleLabels} icon={Tag} label="Labels" />
      <Chip active={currents} onClick={onToggleCurrents} icon={Waves} label="Currents" />

      {species.length > 0 && (
        <>
          <span className="w-px h-5 bg-rc-rule mx-0.5" aria-hidden />
          <label className="flex items-center gap-1.5 pl-1 pr-1">
            <Fish className="w-3.5 h-3.5 text-rc-ink-mute" />
            <select
              value={speciesFilter ?? ""}
              onChange={(e) => onSpeciesChange(e.target.value || null)}
              aria-label="Filter by species"
              className="bg-transparent text-xs font-semibold text-rc-ink-soft focus:outline-none cursor-pointer pr-1 max-w-[9rem]"
            >
              <option value="">Best bet</option>
              {species.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
