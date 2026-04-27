import type { BlueCasterCityPage } from "@/lib/bluecaster";

type AccessPoint = BlueCasterCityPage["access_points"][number];

const TYPE_LABELS: Record<string, string> = {
  ramp: "Ramp",
  marina_fuel: "Marina \u00B7 Fuel",
  marina: "Marina",
  public_dock: "Public Dock",
};

export default function CityAccessPoints({
  points,
}: {
  points: AccessPoint[];
}) {
  if (!points || points.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
        Access Points
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {points.map((point) => (
          <div
            key={point.id}
            className="bg-white border border-stone-200 rounded-lg px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {/* Location pin icon */}
              <svg
                className="w-4 h-4 text-slate-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <div>
                <span className="text-sm text-slate-900 font-medium">
                  {point.name}
                </span>
                {point.notes && (
                  <p className="text-xs text-slate-500 mt-0.5">{point.notes}</p>
                )}
              </div>
            </div>

            <span className="text-xs text-slate-500 shrink-0 ml-3">
              {TYPE_LABELS[point.type] ?? point.type}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
