"use client";

import { tierFor, TIER_TEXT } from "../../lib/explore-data";
import type { LiveSpecies, LiveRegulation } from "@/lib/bluecaster/live-spot-types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-08-01" → "Aug 1". Slice (not Date) to avoid any TZ shift.
function fmtOpenDate(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return m && d ? `${MONTHS[m - 1]} ${d}` : "";
}

// A species that can't be retained right now shows a regulatory label instead
// of a score — a "0" reads as terrible fishing when the fish are there but
// non-retention. Returns null when retention is open (show the score).
function retentionNote(reg: LiveRegulation | undefined): { label: string; sub: string | null } | null {
  if (!reg) return null;
  if (reg.status !== "Release" && reg.status !== "Closed") return null;
  const label = reg.status === "Closed" ? "Closed" : "Non-retention";
  const sub = reg.nextOpenDate ? `opens ${fmtOpenDate(reg.nextOpenDate)}` : null;
  return { label, sub };
}

/**
 * Row of tappable species cards — the spot-detail driver switch. Each card
 * shows the species' today peak score, tier-colored; the selected card gets
 * the brand outline + soft fill (mirrors the Figma "SPECIES" strip). A
 * non-retention / closed species shows a regulatory label + reopen date in
 * place of the (zeroed) score.
 */
export default function SpeciesCardRow({
  species,
  scores,
  regulations,
  selectedId,
  onSelect,
}: {
  species: LiveSpecies[];
  scores: Record<string, number>;
  regulations: LiveRegulation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide">
      {species.map((s) => {
        const score = scores[s.id] ?? null;
        const tier = tierFor(score);
        const sel = s.id === selectedId;
        const note = retentionNote(regulations.find((r) => r.speciesId === s.id));
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-pressed={sel}
            className={`flex-1 min-w-[120px] rounded border px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand ${
              sel
                ? "border-rc-brand bg-rc-brand-soft"
                : "border-rc-rule bg-rc-panel hover:border-rc-ink-mute"
            }`}
          >
            <div className="rc-label text-[10px] truncate">{s.name}</div>
            {note ? (
              <div className="mt-2.5">
                <div className="text-lg font-bold leading-none tracking-[-0.02em] text-rc-ink-mute">
                  {note.label}
                </div>
                {note.sub && <div className="rc-label mt-1 text-[10px] text-rc-ink-mute">{note.sub}</div>}
              </div>
            ) : (
              <div
                className={`text-4xl font-bold leading-none tracking-[-0.04em] mt-2.5 ${
                  sel ? "text-rc-brand" : TIER_TEXT[tier]
                }`}
              >
                {score ?? "—"}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
