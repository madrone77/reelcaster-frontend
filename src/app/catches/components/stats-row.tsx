import { kgToLb, round1 } from "@/lib/units";

export interface SeasonStats {
  catches: number;
  avg_weight_kg: number | null;
  best_weight_kg: number | null;
  species_count: number;
  spots_fished: number;
}

/** Season header strip: CATCHES · LB AVG · LB BEST · SPECIES · SPOTS FISHED. */
export default function StatsRow({ stats }: { stats: SeasonStats | null }) {
  const cells: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: "CATCHES", value: stats ? String(stats.catches) : "—" },
    {
      label: "LB AVG",
      value:
        stats?.avg_weight_kg != null ? String(round1(kgToLb(stats.avg_weight_kg))) : "—",
    },
    {
      label: "LB BEST",
      value:
        stats?.best_weight_kg != null
          ? String(Math.round(kgToLb(stats.best_weight_kg)))
          : "—",
      accent: true,
    },
    { label: "SPECIES", value: stats ? String(stats.species_count) : "—" },
    { label: "SPOTS FISHED", value: stats ? String(stats.spots_fished) : "—" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 rounded-xl border border-rc-rule bg-rc-panel divide-x divide-y sm:divide-y-0 divide-rc-rule overflow-hidden">
      {cells.map((c) => (
        <div key={c.label} className="px-5 py-4">
          <div
            className={`text-3xl font-bold tabular-nums ${
              c.accent ? "text-rc-brand" : "text-rc-ink"
            }`}
          >
            {c.value}
          </div>
          <div className="rc-label text-[9px] text-rc-ink-mute mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
