import type { BlueCasterSpotPage } from "@/lib/bluecaster";
import { breakdownRows } from "@/lib/factor-language";

export default function SpotBreakdownPanel({
  scoreNow,
}: {
  scoreNow: BlueCasterSpotPage["rc_score_now"];
}) {
  if (!scoreNow) return null;

  const rows = breakdownRows(scoreNow.factor_contributions);
  if (rows.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
          Why this score
        </h2>
        <p className="font-mono text-xs uppercase tracking-widest text-slate-400">
          {scoreNow.species_name} · {scoreNow.state}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((row) => {
          const positive = (row.contribution ?? 0) >= 0;
          const magnitude = Math.abs(row.contribution ?? 0);
          const widthPct = Math.round(magnitude * 100);

          return (
            <div
              key={row.key}
              className="bg-white border border-stone-200 rounded-lg px-4 py-3"
            >
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900">
                  {row.label}
                </p>
                {row.state && (
                  <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
                    {row.state}
                  </p>
                )}
              </div>

              {row.contribution !== null && (
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[10px] tracking-widest uppercase text-slate-400"
                    aria-hidden="true"
                  >
                    {positive ? "▲" : "▼"}
                  </span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        positive ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-slate-600 tabular-nums w-10 text-right">
                    {positive ? "+" : "−"}
                    {widthPct}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400 max-w-3xl">
        Contributions show how each factor pushed today&apos;s score relative to
        baseline. Green bars helped; amber bars hurt.
      </p>
    </section>
  );
}
