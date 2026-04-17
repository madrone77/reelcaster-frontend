import type { BlueCasterCityPage } from "@/lib/bluecaster";

type SeasonalEntry = BlueCasterCityPage["seasonal_guide"][number];

const QUARTER_ORDER: Record<string, number> = {
  Q1: 0,
  Q2: 1,
  Q3: 2,
  Q4: 3,
  spring: 0,
  summer: 1,
  fall: 2,
  winter: 3,
};

function QualityBadge({ quality }: { quality: string | null }) {
  if (!quality) return null;

  const isPeak = quality.toLowerCase() === "peak";
  return (
    <span
      className={`border text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
        isPeak
          ? "border-emerald-600 text-emerald-700"
          : "border-slate-400 text-slate-600"
      }`}
    >
      {quality}
    </span>
  );
}

export default function CitySeasonalGuide({
  quarters,
}: {
  quarters: SeasonalEntry[];
}) {
  if (!quarters || quarters.length === 0) return null;

  const sorted = [...quarters].sort(
    (a, b) => (QUARTER_ORDER[a.quarter] ?? 99) - (QUARTER_ORDER[b.quarter] ?? 99)
  );

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
        Seasonal Fishing Guide
      </h2>

      <div className="space-y-2">
        {sorted.map((entry) => (
          <details
            key={entry.quarter}
            className="group border border-stone-200 rounded-lg overflow-hidden"
          >
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-stone-50 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-black uppercase tracking-wide text-slate-900">
                  {entry.label || entry.quarter}
                </span>
                <QualityBadge quality={entry.quality} />
                {entry.peak_species && entry.peak_species.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.peak_species.map((sp) => (
                      <span
                        key={sp.slug}
                        className="border border-slate-300 text-slate-600 text-[10px] px-2 py-0.5 uppercase tracking-widest font-medium rounded-full"
                      >
                        {sp.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Chevron */}
              <svg
                className="w-4 h-4 text-slate-400 shrink-0 ml-4 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
          </details>
        ))}
      </div>
    </section>
  );
}
