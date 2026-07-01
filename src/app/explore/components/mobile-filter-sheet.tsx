"use client";

import {
  Mountain,
  Tag,
  Waves,
  Fish,
  LocateFixed,
  Loader2,
  X,
} from "lucide-react";
import type { SpeciesOption } from "../lib/explore-data";

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
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

function LayerChip({
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
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? "bg-rc-brand-soft text-rc-brand"
          : "bg-rc-surface text-rc-ink-mute hover:text-rc-ink-soft"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/**
 * Mobile (<lg) filter sheet opened by the location header's filter button —
 * the mobile home for the desktop MapControls (species + layer toggles +
 * near-me), which are hidden on mobile. Same handler props as MapControls.
 */
export default function MobileFilterSheet({
  open,
  onClose,
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
}: MobileFilterSheetProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="lg:hidden fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-rc-panel rounded-t-2xl shadow-rc-panel animate-slide-up safe-area-bottom">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="rc-label text-[10px]">Map filters</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-md text-rc-ink-mute hover:bg-rc-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-5">
          {species.length > 0 && (
            <div>
              <div className="rc-label text-[9px] mb-1.5">Species</div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rc-surface">
                <Fish className="w-4 h-4 text-rc-ink-mute shrink-0" />
                <select
                  value={speciesFilter ?? ""}
                  onChange={(e) => onSpeciesChange(e.target.value || null)}
                  aria-label="Filter by species"
                  className="flex-1 bg-transparent text-sm font-semibold text-rc-ink-soft focus:outline-none cursor-pointer"
                >
                  <option value="">Best bet</option>
                  {species.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <div className="rc-label text-[9px] mb-1.5">Chart layers</div>
            <div className="flex flex-wrap gap-2">
              <LayerChip active={relief} onClick={onToggleRelief} icon={Mountain} label="Relief" />
              <LayerChip active={labels} onClick={onToggleLabels} icon={Tag} label="Labels" />
              <LayerChip active={currents} onClick={onToggleCurrents} icon={Waves} label="Currents" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onNearMe();
              onClose();
            }}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-rc-rule text-sm font-semibold text-rc-ink-soft hover:bg-rc-surface transition-colors disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LocateFixed className="w-4 h-4" />
            )}
            Find spots near me
          </button>
        </div>
      </div>
    </>
  );
}
