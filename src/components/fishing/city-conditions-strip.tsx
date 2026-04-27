import type { BlueCasterCityPage } from "@/lib/bluecaster";

type ConditionsNow = BlueCasterCityPage["conditions_now"];

export default function CityConditionsStrip({
  conditions,
}: {
  conditions: ConditionsNow;
}) {
  if (!conditions) return null;

  const items: { label: string; value: string }[] = [];

  if (conditions.temp_c != null) {
    items.push({ label: "Temperature", value: `${conditions.temp_c}\u00B0C` });
  }
  if (conditions.wind_kn != null) {
    let windStr = `${conditions.wind_kn}kn`;
    if (conditions.wind_gusts_kn != null) {
      windStr += ` ${conditions.wind_gusts_kn}kn Gusts`;
    }
    items.push({ label: "Wind", value: windStr });
  }
  if (conditions.water_temp_c != null) {
    items.push({ label: "Water", value: `${conditions.water_temp_c}\u00B0C` });
  }
  if (conditions.tide_high != null) {
    items.push({
      label: "Tide High",
      value: `${conditions.tide_high.ft}ft ${conditions.tide_high.time}`,
    });
  }
  if (conditions.tide_low != null) {
    items.push({
      label: "Tide Low",
      value: `${conditions.tide_low.ft}ft ${conditions.tide_low.time}`,
    });
  }
  if (conditions.tide_now_ft != null) {
    items.push({ label: "Now", value: `~${conditions.tide_now_ft}ft` });
  }
  if (conditions.swell_m != null) {
    items.push({ label: "Swell", value: `${conditions.swell_m}m` });
  }

  if (items.length === 0) return null;

  return (
    <section className="bg-stone-100 border-y border-stone-200" aria-label="Current fishing conditions">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6 overflow-x-auto">
        <div className="flex items-center gap-6 font-mono text-xs tracking-wider text-slate-600 whitespace-nowrap">
          {items.map((item) => (
            <span key={item.label}>
              <span className="text-slate-400">{item.label}</span>{" "}
              <span className="text-slate-700 font-semibold">{item.value}</span>
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span
            className="font-mono text-xs tracking-wider text-emerald-600 font-semibold uppercase"
            aria-label="Data updated live"
          >
            Live
          </span>
        </div>
      </div>
    </section>
  );
}
