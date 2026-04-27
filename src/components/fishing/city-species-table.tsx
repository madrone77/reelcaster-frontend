import type { BlueCasterCityPage } from "@/lib/bluecaster";

type SpeciesRow = BlueCasterCityPage["species_table"][number];
type RegulatoryArea = BlueCasterCityPage["regulatory_areas"][number];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const RATING_STYLES: Record<string, string> = {
  peak: "bg-blue-800/80 text-white",
  excellent: "bg-emerald-600/70 text-white",
  good: "bg-emerald-500/50 text-slate-900",
  fair: "bg-amber-400/40 text-slate-900",
  poor: "bg-orange-300/40 text-slate-900",
  closed: "bg-stone-200 text-stone-400",
};

const RATING_LABELS: Record<string, string> = {
  peak: "Peak",
  excellent: "Excel",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  closed: "Closed",
};

const LEGEND_ITEMS = [
  { key: "peak", label: "Peak", style: "bg-blue-800/80" },
  { key: "excellent", label: "Excellent", style: "bg-emerald-600/70" },
  { key: "good", label: "Good", style: "bg-emerald-500/50" },
  { key: "fair", label: "Fair", style: "bg-amber-400/40" },
  { key: "poor", label: "Poor", style: "bg-orange-300/40" },
  { key: "closed", label: "Closed", style: "bg-stone-200" },
];

function getVisibleMonths(): number[] {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const months: number[] = [];
  for (let i = 0; i < 6; i++) {
    months.push(((currentMonth + i) % 12) + 1); // 1-indexed
  }
  return months;
}

function getRatingForMonth(
  row: SpeciesRow,
  month: number
): string | null {
  // months is Record<string, string | null> with keys "1"-"12"
  return row.months[String(month)] ?? null;
}

function StatusBadge({ status }: { status: "open" | "non_retention" | "closed" | null }) {
  if (status === "open") {
    return (
      <span className="border border-emerald-600 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
        Open
      </span>
    );
  }
  if (status === "non_retention") {
    return (
      <span
        className="border border-amber-500 text-amber-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
        title="Non-Retention"
      >
        NR
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className="border border-stone-400 text-stone-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
        Closed
      </span>
    );
  }
  return <span className="text-slate-400">&mdash;</span>;
}

export default function CitySpeciesTable({
  rows,
  regulatoryAreas,
  areaName,
}: {
  rows: SpeciesRow[];
  regulatoryAreas: RegulatoryArea[];
  areaName?: string;
}) {
  if (!rows || rows.length === 0) return null;

  const visibleMonths = getVisibleMonths();

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      {/* Section heading */}
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
          Species &amp; Regulations
        </h2>
        {regulatoryAreas && regulatoryAreas.length > 0 && (
          <p className="text-sm text-slate-500 mt-1 font-mono tracking-wide">
            {regulatoryAreas.map((a) => `${a.body} Area ${a.area_number} - ${a.name}`).join(" / ")}
          </p>
        )}
      </div>

      {/* Table wrapper */}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full border-collapse font-mono text-xs uppercase tracking-wider min-w-[700px]">
          <caption className="sr-only">
            Species availability and regulations for {areaName ?? "this area"}
          </caption>
          <thead>
            <tr className="border-b border-stone-300">
              <th scope="col" className="text-left py-3 pr-4 text-slate-500 font-semibold w-40">
                Species
              </th>
              {visibleMonths.map((m) => (
                <th
                  key={m}
                  scope="col"
                  className="text-center py-3 px-2 text-slate-500 font-semibold w-16"
                >
                  {MONTH_LABELS[m - 1]}
                </th>
              ))}
              <th scope="col" className="text-center py-3 px-2 text-slate-500 font-semibold w-16">
                Limit
              </th>
              <th scope="col" className="text-center py-3 px-2 text-slate-500 font-semibold w-16">
                Size
              </th>
              <th scope="col" className="text-center py-3 px-2 text-slate-500 font-semibold w-20">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sp) => (
              <tr
                key={sp.species_slug}
                className="border-b border-stone-200 hover:bg-stone-50 transition-colors"
              >
                <th scope="row" className="py-2.5 pr-4 text-slate-900 font-semibold normal-case text-sm text-left">
                  {sp.species_name}
                </th>
                {visibleMonths.map((m) => {
                  const rating = getRatingForMonth(sp, m);
                  const style = rating ? RATING_STYLES[rating] : "";
                  const label = rating ? RATING_LABELS[rating] : "";
                  return (
                    <td key={m} className="py-2.5 px-1 text-center">
                      {rating ? (
                        <span
                          className={`inline-block w-full py-1 rounded text-[10px] font-semibold ${style}`}
                        >
                          {label}
                        </span>
                      ) : (
                        <span className="text-stone-300">&mdash;</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 px-2 text-center text-slate-600 text-[11px]">
                  {sp.daily_limit != null ? sp.daily_limit : <span className="text-stone-300">&mdash;</span>}
                </td>
                <td className="py-2.5 px-2 text-center text-slate-600 text-[11px]">
                  {sp.size_limit_cm != null ? `${sp.size_limit_cm}cm` : <span className="text-stone-300">&mdash;</span>}
                </td>
                <td className="py-2.5 px-2 text-center">
                  <StatusBadge status={sp.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-stone-200">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-sm ${item.style}`}
            />
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 text-xs text-slate-400">
        <p>
          Regulations reference only &mdash; verify at{" "}
          <a
            href="https://www.dfo-mpo.gc.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline"
          >
            DFO.gc.ca
          </a>
        </p>
      </div>
    </section>
  );
}
