"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  TIER_SCORE_TEXT,
  tierFor,
  type SpeciesOption,
} from "../lib/explore-data";

export interface MapFilterChipsProps {
  relief: boolean;
  currents: boolean;
  /** Accepted for call-site compat; the Wind chip was dropped from the row
   *  to keep it compact (the OWM overlay stays reachable elsewhere). */
  wind?: boolean;
  onToggleRelief: () => void;
  onToggleCurrents: () => void;
  onToggleWind?: () => void;
  species: SpeciesOption[];
  speciesFilter: string | null;
  onSpeciesChange: (id: string | null) => void;
}

const PANEL_W = 192; // w-48

/**
 * Surfaced map-filter chips for the left rail — Bathymetry / Currents / Wind as
 * inline layer-toggle chips, plus a "Species" chip that opens the species
 * dropdown. The row never wraps: long species names truncate on the chip and
 * the row scrolls horizontally when cramped. The dropdown renders through a
 * body portal at fixed coordinates, clamped to the viewport, so it can't be
 * clipped by the scroll container or hang off the rail's edge.
 */
export default function MapFilterChips({
  relief,
  currents,
  onToggleRelief,
  onToggleCurrents,
  species,
  speciesFilter,
  onSpeciesChange,
}: MapFilterChipsProps) {
  const [bestOpen, setBestOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const bestRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openPanel = () => {
    const chip = bestRef.current?.getBoundingClientRect();
    if (!chip) return;
    // Prefer right-aligning the panel to the chip (it opens over the row, not
    // the map); clamp inside the viewport either way.
    const left = Math.min(
      Math.max(8, chip.right - PANEL_W),
      window.innerWidth - PANEL_W - 8,
    );
    setPanelPos({ top: chip.bottom + 4, left });
    setBestOpen(true);
  };

  useEffect(() => {
    if (!bestOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!bestRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setBestOpen(false);
      }
    };
    // The panel is fixed-positioned — any scroll/resize under it would leave
    // it floating in the wrong place, so just close it.
    const onMove = () => setBestOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [bestOpen]);

  const toggles: Array<[string, boolean, () => void]> = [
    ["Bathymetry", relief, onToggleRelief],
    ["Currents", currents, onToggleCurrents],
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

  const chipBase = "px-2.5 py-1 rounded text-[11px] transition-colors shrink-0";
  const chipOn = "bg-rc-brand-soft border border-rc-brand text-rc-ink font-semibold";
  // Explicitly white, not transparent: in the rail these sit on a white panel
  // so a bare outline looked fine, but the chips also overlay the map on the
  // marketing section — where the bathymetry showed straight through the label.
  const chipOff =
    "bg-rc-panel border border-rc-rule text-rc-ink-soft font-medium hover:bg-rc-surface";

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <div ref={bestRef} className="shrink-0">
          <button
            type="button"
            onClick={() => (bestOpen ? setBestOpen(false) : openPanel())}
            aria-expanded={bestOpen}
            title={selected ? selected.name : undefined}
            className={`${chipBase} flex items-center gap-1 ${bestActive ? chipOn : chipOff}`}
          >
            <span className="truncate max-w-[96px]">{bestLabel}</span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${bestOpen ? "rotate-180" : ""}`}
            />
          </button>

          {bestOpen &&
            panelPos &&
            createPortal(
              <div
                ref={panelRef}
                style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: PANEL_W }}
                className="z-50 max-h-[240px] overflow-y-auto bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel p-1"
              >
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
              </div>,
              document.body,
            )}
        </div>
      )}
    </div>
  );
}
