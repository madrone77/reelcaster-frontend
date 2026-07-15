"use client";

import type { CatchLogRow } from "@/lib/catch-log-types";
import { kgToLb, cmToIn } from "@/lib/units";
import { speciesDotColor, scoreTone, metaLine, isNew } from "./catch-row";

/** Grid-view card: photo on top, species + meta + stat strip below. */
export default function CatchGridCard({
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
    <div className="rounded-xl border border-rc-rule bg-rc-panel overflow-hidden hover:border-rc-brand/40 transition-colors">
      <div className="relative h-36 bg-rc-surface">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        )}
        {isNew(row) && row.status === "logged" && (
          <span className="absolute top-2 left-2 rounded-sm bg-rc-fair-ink px-1.5 py-0.5 rc-label text-[8px] text-white">
            NEW
          </span>
        )}
        {row.status === "draft" && (
          <span className="absolute top-2 left-2 rounded-sm bg-rc-ink-mute px-1.5 py-0.5 rc-label text-[8px] text-white">
            DRAFT
          </span>
        )}
        {score !== null && (
          <span
            className={`absolute bottom-2 right-2 rounded-md bg-rc-panel/95 px-2 py-0.5 text-sm font-bold ${scoreTone(score)}`}
          >
            {score}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: speciesDotColor(row) }}
          />
          <span className="font-bold text-rc-ink truncate">
            {row.species_name ?? "Unknown species"}
          </span>
        </div>
        <div className="mt-0.5 font-rc-mono text-[11px] text-rc-ink-mute truncate">
          {metaLine(row)}
        </div>
        <div className="mt-2 flex gap-4 font-rc-mono text-[12px] text-rc-ink-soft">
          <span>{weightLb !== null ? `${weightLb} lb` : "— lb"}</span>
          <span>{lengthIn !== null ? `${lengthIn} in` : "— in"}</span>
        </div>
      </div>
    </div>
  );
}
