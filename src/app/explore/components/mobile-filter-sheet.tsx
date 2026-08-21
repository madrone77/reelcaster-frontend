"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Mountain,
  Tag,
  Waves,
  Wind,
  Target,
  LocateFixed,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { TIER_PILL, tierFor, type SpeciesOption } from "../lib/explore-data";

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
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

/** One species in the picker: a full-width row, thumb-sized, with the best
 *  score anywhere in view on the right so the choice is informed. */
function SpeciesRow({
  label,
  hint,
  score,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  score?: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
        active ? "bg-rc-brand-soft" : "hover:bg-rc-surface"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-semibold ${
            active ? "text-rc-brand" : "text-rc-ink"
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-xs text-rc-ink-mute">
            {hint}
          </span>
        )}
      </span>
      {score != null && (
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 font-rc-mono text-[11px] font-semibold ${
            TIER_PILL[tierFor(score)]
          }`}
        >
          {score}
        </span>
      )}
      <Check
        className={`w-4 h-4 shrink-0 ${active ? "text-rc-brand" : "text-transparent"}`}
        aria-hidden
      />
    </button>
  );
}

/**
 * Mobile (<lg) filter sheet opened by the location header's filter button —
 * the mobile home for the desktop MapControls (species + layer toggles +
 * near-me), which are hidden on mobile. Same handler props as MapControls.
 *
 * Species is a pushed subview of full-width rows, not the <select> the desktop
 * bar uses. A native select on a phone hands the choice to a menu the page has
 * no say over: it opened as a cramped desktop-sized list of 11px rows in the
 * corner of the screen, nothing like the sheet it belonged to, and unreadable
 * in a session replay. Rows also have somewhere to put each species' best
 * score, which a select cannot show at all.
 */
export default function MobileFilterSheet({
  open,
  onClose,
  relief,
  labels,
  currents,
  wind,
  onToggleRelief,
  onToggleLabels,
  onToggleCurrents,
  onToggleWind,
  species,
  speciesFilter,
  onSpeciesChange,
  onNearMe,
  locating,
}: MobileFilterSheetProps) {
  const [pane, setPane] = useState<"filters" | "species">("filters");

  // The sheet stays mounted while closed, so a reopen would otherwise land on
  // whichever pane it was left on.
  useEffect(() => {
    if (!open) setPane("filters");
  }, [open]);

  // Best score first: the order the payload hands over is object-key order,
  // which is arbitrary, and "which species is worth chasing" is the whole
  // question this list answers.
  const ranked = useMemo(
    () =>
      [...species].sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1)),
    [species],
  );

  if (!open) return null;

  const selected = species.find((s) => s.id === speciesFilter) ?? null;

  const pickSpecies = (id: string | null) => {
    onSpeciesChange(id);
    onClose();
  };

  return (
    <>
      {/* Backdrop and sheet both clear the floating tab bar's z-50: the bar is
          part of what this sheet covers, so it dims with everything else
          instead of floating lit on top of the scrim. */}
      <div
        className="lg:hidden fixed inset-0 bg-black/30 z-[60]"
        onClick={onClose}
      />
      {/* Sits above the tab bar rather than under it — at bottom-0 the pill
          swallowed the whole bottom of this sheet, "Find spots near me"
          included. */}
      <div
        style={{ bottom: "var(--rc-tabbar-clearance)" }}
        className="lg:hidden fixed inset-x-0 z-[61] bg-rc-panel rounded-t-2xl shadow-rc-panel animate-slide-up"
        role="dialog"
        aria-label={pane === "species" ? "Filter by species" : "Map filters"}
      >
        <div className="flex items-center gap-1 px-4 pt-4 pb-2">
          {pane === "species" && (
            <button
              type="button"
              onClick={() => setPane("filters")}
              aria-label="Back to map filters"
              className="-ml-2 p-2 rounded-md text-rc-ink-mute hover:bg-rc-surface"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="rc-label text-[10px] flex-1">
            {pane === "species" ? "Species" : "Map filters"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 p-2 rounded-md text-rc-ink-mute hover:bg-rc-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {pane === "species" ? (
          <div className="max-h-[45vh] overflow-y-auto overscroll-contain px-2 pb-6">
            <SpeciesRow
              label="Best bet"
              hint="Whichever species scores highest at each spot"
              active={speciesFilter === null}
              onClick={() => pickSpecies(null)}
            />
            {ranked.map((s) => (
              <SpeciesRow
                key={s.id}
                label={s.name}
                score={s.bestScore}
                active={s.id === speciesFilter}
                onClick={() => pickSpecies(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-5">
            {species.length > 0 && (
              <div>
                <div className="rc-label text-[9px] mb-1.5">Species</div>
                <button
                  type="button"
                  onClick={() => setPane("species")}
                  className="flex w-full items-center gap-2 rounded-lg bg-rc-surface px-3 py-3 text-left"
                >
                  <Target className="w-4 h-4 shrink-0 text-rc-ink-mute" />
                  <span className="flex-1 truncate text-sm font-semibold text-rc-ink-soft">
                    {selected ? selected.name : "Best bet"}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-rc-ink-mute" />
                </button>
              </div>
            )}

            <div>
              <div className="rc-label text-[9px] mb-1.5">Chart layers</div>
              <div className="flex flex-wrap gap-2">
                <LayerChip active={relief} onClick={onToggleRelief} icon={Mountain} label="Relief" />
                <LayerChip active={labels} onClick={onToggleLabels} icon={Tag} label="Labels" />
                <LayerChip active={currents} onClick={onToggleCurrents} icon={Waves} label="Currents" />
                {/* Wind was on the desktop rail and nowhere else, so a phone
                    could not reach the layer at all. It shares Currents' state:
                    turning one on turns the other off, and turning the lit one
                    off leaves the map bare. */}
                <LayerChip active={wind} onClick={onToggleWind} icon={Wind} label="Wind" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onNearMe();
                onClose();
              }}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-rc-rule text-sm font-semibold text-rc-ink-soft hover:bg-rc-surface transition-colors disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
              Find spots near me
            </button>
          </div>
        )}
      </div>
    </>
  );
}
