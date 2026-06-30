"use client";

import { tierFor, TIER_TEXT } from "../../lib/explore-data";
import type { LiveSpecies } from "@/lib/bluecaster/live-spot-types";

/**
 * Row of tappable species cards — the spot-detail driver switch. Each card
 * shows the species' today peak score, tier-colored; the selected card gets
 * the brand outline + soft fill (mirrors the Figma "SPECIES" strip).
 */
export default function SpeciesCardRow({
  species,
  scores,
  selectedId,
  onSelect,
}: {
  species: LiveSpecies[];
  scores: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
      {species.map((s) => {
        const score = scores[s.id] ?? null;
        const tier = tierFor(score);
        const sel = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-pressed={sel}
            className={`flex-1 min-w-[104px] rounded-xl border px-3 py-2.5 text-left transition-colors ${
              sel
                ? "border-rc-brand bg-rc-brand-soft"
                : "border-rc-rule bg-rc-panel hover:border-rc-ink-mute"
            }`}
          >
            <div className="rc-label text-[9px] truncate">{s.name}</div>
            <div
              className={`text-3xl font-bold leading-none tracking-[-0.04em] mt-1.5 ${
                sel ? "text-rc-brand" : TIER_TEXT[tier]
              }`}
            >
              {score ?? "—"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
