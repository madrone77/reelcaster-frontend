"use client";

import { ChevronRight } from "lucide-react";
import type { CatchLogRow } from "@/lib/catch-log-types";
import { readSnapshot } from "@/lib/catch-log-types";
import { kgToLb, cmToIn } from "@/lib/units";

/** Stable accent color per species. A categorical palette (species are distinct
 *  buckets, not scores); the first three align to the v2 brand/score values so
 *  no stale old-brand hexes remain. */
const SPECIES_DOT: Record<string, string> = {
  "chinook-salmon": "#2536D9",
  "coho-salmon": "#3D8B4F",
  "sockeye-salmon": "#B23A2F",
  "pink-salmon": "#EC4899",
  "chum-salmon": "#0891B2",
  "pacific-halibut": "#EA580C",
  halibut: "#EA580C",
  lingcod: "#7C3AED",
  rockfish: "#B45309",
};
const DOT_FALLBACK = ["#2536D9", "#3D8B4F", "#EA580C", "#7C3AED", "#0891B2", "#B45309"];

export function speciesDotColor(row: CatchLogRow): string {
  const key = row.species_id ?? row.species_name ?? "";
  if (SPECIES_DOT[key]) return SPECIES_DOT[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return DOT_FALLBACK[Math.abs(h) % DOT_FALLBACK.length];
}

export function scoreTone(score: number | null): string {
  if (score === null) return "text-rc-ink-mute";
  if (score >= 85) return "text-rc-prime-ink";
  if (score >= 60) return "text-rc-good-ink";
  if (score >= 40) return "text-rc-fair-ink";
  return "text-rc-poor-ink";
}

export function tidePhaseWord(phase: string | null): string | null {
  if (!phase) return null;
  if (phase.startsWith("flood")) return "Flood";
  if (phase.startsWith("ebb")) return "Ebb";
  if (phase.startsWith("slack")) return "Slack";
  return null;
}

export function metaLine(row: CatchLogRow): string {
  const d = new Date(row.caught_at);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  const snap = readSnapshot(row.weather_snapshot);
  const parts = [row.location_name ?? "Unmapped water", date, time];
  const tide = tidePhaseWord(snap.tidePhase);
  if (tide) parts.push(tide);
  if (snap.windKt !== null) {
    parts.push(`${Math.round(snap.windKt)} kt${snap.windDir ? ` ${snap.windDir}` : ""}`);
  }
  return parts.join(" · ");
}

export function isNew(row: CatchLogRow): boolean {
  return Date.now() - new Date(row.created_at).getTime() < 48 * 3600_000;
}

/** One list row (mock parity): thumb · species+meta · weight/length/score. */
export default function CatchRow({
  row,
  photoUrl,
}: {
  row: CatchLogRow;
  photoUrl: string | null;
}) {
  const weightLb = row.weight_kg !== null ? Math.round(kgToLb(Number(row.weight_kg))) : null;
  const lengthIn = row.length_cm !== null ? Math.round(cmToIn(Number(row.length_cm))) : null;
  const score = row.score !== null ? Math.round(Number(row.score)) : null;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 hover:border-rc-brand/40 transition-colors">
      <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-rc-surface border border-rc-rule shrink-0">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        )}
        {isNew(row) && row.status === "logged" && (
          <span className="absolute top-1 left-1 rounded-sm bg-rc-fair-ink px-1 py-px rc-label text-[7px] text-white">
            NEW
          </span>
        )}
        {row.status === "draft" && (
          <span className="absolute top-1 left-1 rounded-sm bg-rc-ink-mute px-1 py-px rc-label text-[7px] text-white">
            DRAFT
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: speciesDotColor(row) }}
          />
          <span className="font-bold text-rc-ink truncate">
            {row.species_name ?? "Unknown species"}
          </span>
        </div>
        <div className="mt-0.5 font-rc-mono text-[12px] text-rc-ink-mute truncate">
          {metaLine(row)}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-8 shrink-0">
        <Stat label="WEIGHT" value={weightLb !== null ? `${weightLb} lb` : "—"} />
        <Stat label="LENGTH" value={lengthIn !== null ? `${lengthIn} in` : "—"} />
        <div className="text-right w-14">
          <div className={`text-lg font-bold tabular-nums ${scoreTone(score)}`}>
            {score ?? "—"}
          </div>
          <div className="rc-label text-[8px] text-rc-ink-mute">SCORE</div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-rc-ink-mute shrink-0" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-lg font-bold text-rc-ink tabular-nums">{value}</div>
      <div className="rc-label text-[8px] text-rc-ink-mute">{label}</div>
    </div>
  );
}
