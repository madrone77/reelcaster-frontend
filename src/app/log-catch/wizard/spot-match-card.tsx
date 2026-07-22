"use client";

import { Plus } from "lucide-react";
import type { NearestSpotHit } from "@/lib/bluecaster/catch-ingest-types";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertDistance,
  formatDistance,
  type DistanceUnit,
} from "@/app/utils/unit-conversions";

function scoreTone(score: number | null): string {
  if (score === null) return "text-rc-ink-mute";
  if (score >= 75) return "text-rc-good-ink";
  if (score >= 55) return "text-rc-fair-ink";
  return "text-rc-poor-ink";
}

// Under 1 km this stays a metres proximity hint regardless of preference;
// only the km branch converts to the preferred distance unit.
function distanceLabel(m: number, unit: DistanceUnit): string {
  return m >= 1000
    ? formatDistance(convertDistance(m / 1000, "km", unit), unit)
    : `${Math.round(m)} m`;
}

/** Blue "matched spot" card below the picker map (mock: Constance Bank · 82). */
export function SpotMatchCard({
  match,
  searching,
}: {
  match: NearestSpotHit;
  searching: boolean;
}) {
  const { distanceUnit } = useUnitPreferences();
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border-2 border-rc-brand bg-rc-brand-soft/50 px-4 py-3 transition-opacity ${
        searching ? "opacity-60" : ""
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-rc-panel border border-rc-rule shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold text-rc-ink truncate">{match.name}</div>
        <div className="font-rc-mono text-[12px] text-rc-ink-soft">
          Matched · {distanceLabel(match.distance_m, distanceUnit)} from pin
        </div>
      </div>
      <div className={`text-4xl font-bold tabular-nums ${scoreTone(match.score)}`}>
        {match.score ?? "—"}
      </div>
      {match.score === null && (
        <div className="rc-label text-[9px] text-rc-ink-mute -ml-2 self-end pb-1.5">
          {match.score_status === "pending" ? "SCORE\nPENDING" : ""}
        </div>
      )}
    </div>
  );
}

/** Amber dashed "no mapped spot" card with the Create action. */
export function NoSpotCard({
  onCreate,
  searching,
}: {
  onCreate: () => void;
  searching: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border-2 border-dashed border-rc-fair-ink/60 bg-rc-fair-bg px-4 py-3 transition-opacity ${
        searching ? "opacity-60" : ""
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-rc-panel border border-rc-rule shrink-0 flex items-center justify-center text-rc-fair-ink">
        )
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold text-rc-fair-ink">No mapped spot here</div>
        <div className="font-rc-mono text-[12px] text-rc-fair-ink/80">
          Unmapped water · create a spot to get forecasts here
        </div>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-1.5 rounded-lg bg-rc-panel border border-rc-rule px-4 py-2.5 font-semibold text-rc-ink hover:bg-rc-surface transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create
      </button>
    </div>
  );
}
