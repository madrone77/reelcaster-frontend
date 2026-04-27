import type { BlueCasterSpotPage } from "@/lib/bluecaster";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// 5-cell vertical bar per month — cells fill from the bottom based on weight.
// Range [0, 1.4]: 5 cells = 0.28 per cell.
function cellsForWeight(weight: number): number {
  if (weight <= 0) return 0;
  return Math.min(5, Math.max(1, Math.round(weight / 0.28)));
}

function colorForWeight(weight: number): string {
  if (weight >= 1.2) return "bg-blue-700";
  if (weight >= 1.05) return "bg-emerald-600";
  if (weight >= 0.85) return "bg-emerald-400";
  if (weight >= 0.55) return "bg-amber-400";
  if (weight >= 0.25) return "bg-orange-300";
  return "bg-stone-300";
}

export default function SpotSeasonalAbundance({
  rows,
}: {
  rows: BlueCasterSpotPage["seasonal_abundance"];
}) {
  const populated = rows.filter((r) => r.monthly_weights.length === 12);
  if (populated.length === 0) return null;

  const currentMonth = new Date().getMonth(); // 0-indexed

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
          Seasonal Abundance
        </h2>
        <p className="text-sm text-slate-500 mt-1 font-mono tracking-wide">
          12-month relative abundance per species. Dashed column marks current month.
        </p>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full border-collapse min-w-[640px]">
          <caption className="sr-only">
            Monthly abundance heatmap per species
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left pr-4 pb-2 font-mono text-xs uppercase tracking-widest text-slate-400 font-medium w-32"
              >
                Species
              </th>
              {MONTH_LABELS.map((m, i) => (
                <th
                  key={m}
                  scope="col"
                  className={`text-center pb-2 font-mono text-xs uppercase tracking-widest font-medium ${
                    i === currentMonth ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {populated.map((row) => (
              <tr key={row.species_id} className="border-t border-stone-200">
                <th
                  scope="row"
                  className="py-3 pr-4 text-left text-slate-900 font-semibold text-sm"
                >
                  {row.species_name}
                </th>
                {row.monthly_weights.map((w, i) => {
                  const cells = cellsForWeight(w);
                  const color = colorForWeight(w);
                  return (
                    <td
                      key={i}
                      className={`py-3 px-1 text-center align-bottom ${
                        i === currentMonth
                          ? "border-x border-dashed border-slate-400"
                          : ""
                      }`}
                      title={`${MONTH_LABELS[i]}: ${w.toFixed(2)}`}
                    >
                      <div className="flex flex-col items-center gap-[2px] mx-auto w-5">
                        {[0, 1, 2, 3, 4].map((idx) => {
                          const filled = cells > idx;
                          return (
                            <div
                              key={idx}
                              className={`w-full h-1.5 rounded-sm ${
                                filled ? color : "bg-stone-200"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
