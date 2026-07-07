"use client";

import {
  condAt,
  dayPeak,
  scorePill,
  windLabel,
  seaState,
  tideLabel,
  type MapSpot,
  type SpeciesMeta,
} from "./scoring-ui";

interface RankedRow {
  spot: MapSpot;
  score: number | null;
  speciesId: string | null;
}

interface SidebarProps {
  ranked: RankedRow[];
  species: Record<string, SpeciesMeta>;
  hour: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  cityLabel?: string;
  topPx?: number;
}

const PILL: Record<string, string> = {
  good: "bg-rcc-good-bg text-rcc-good",
  fair: "bg-rcc-fair-bg text-rcc-fair",
  poor: "bg-orange-100 text-rcc-poor",
  none: "bg-slate-100 text-rcc-faint",
};

function peakTime(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function Sidebar({ ranked, species, hour, selectedId, onSelect, topPx = 64 }: SidebarProps) {
  return (
    <aside
      style={{ top: topPx, maxHeight: `calc(100dvh - ${topPx + 24}px)` }}
      className="pointer-events-auto absolute left-3 z-10 flex w-[387px] flex-col overflow-hidden rounded-[4px] bg-white/80 shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-rcc-line backdrop-blur-[2px]"
    >
      {/* Cards */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="font-mono text-[10px] tracking-wide text-[#8b7e6e]">Viewing all spots</p>
          <span className="font-mono text-[10px] uppercase tracking-wide text-rcc-faint">{ranked.length} spots</span>
        </div>
        <ul className="flex flex-col gap-2">
          {ranked.map(({ spot, score, speciesId }) => {
            const pill = scorePill(score);
            const speciesName = speciesId && species[speciesId] ? species[speciesId].name : null;
            const peak = dayPeak(spot, speciesId);
            const cell = condAt(spot, hour);
            const selected = spot.id === selectedId;
            return (
              <li key={spot.id}>
                <button
                  onClick={() => onSelect(spot.id)}
                  className={`w-full rounded-[4px] border px-3.5 py-3 text-left transition ${
                    selected
                      ? "border-rcc-brand ring-1 ring-rcc-brand/40"
                      : "border-rcc-line hover:border-slate-300"
                  } bg-white`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-rcc-ink">{spot.name}</h3>
                    <span
                      className={`shrink-0 rounded-[4px] px-2 py-0.5 font-mono text-[10px] font-bold ${PILL[pill.tone]}`}
                    >
                      {score === null ? "—" : `${Math.round(score * 100)} ${pill.label}`}
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-[10px] text-rcc-muted">
                    {speciesName ? `${speciesName} driving · peak ${peakTime(peak.hour)}` : "Nothing biting now"}
                  </p>

                  {cell && (
                    <>
                      <div className="my-2 border-t border-rcc-line" />
                      <div className="flex gap-6 font-mono">
                        <div>
                          <p className="text-[9px] font-bold text-rcc-faint">WIND</p>
                          <p className="text-[11px] text-rcc-ink">{windLabel(cell)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-rcc-faint">SEA</p>
                          <p className="text-[11px] text-rcc-ink">{seaState(cell.wav)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-rcc-faint">TIDE</p>
                          <p className="text-[11px] text-rcc-ink">{tideLabel(cell)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
