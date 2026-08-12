"use client";

import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { PAGE_MEASURE, READING_MEASURE } from "@/app/components/layout/page-measure";
import { ToggleGroup, type ToggleOption } from "@/app/components/ui/toggle-group";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  type MetricType,
  type AnyUnit,
  UNITS_FOR_TYPE,
  unitLabel,
  convertAndFormat,
} from "@/app/utils/unit-conversions";

// Each display variable, its human copy, the base unit its sample value is
// authored in, and a representative sample so every row shows a live preview.
type Variable = {
  key: MetricType;
  label: string;
  description: string;
  baseUnit: AnyUnit;
  sample: number;
};

const WATER: Variable[] = [
  { key: "tide", label: "Tide height", description: "Tide levels and swing", baseUnit: "m", sample: 2.4 },
  { key: "wave", label: "Wave height", description: "Sea state and swell", baseUnit: "m", sample: 0.8 },
  { key: "depth", label: "Depth", description: "Spot depth and soundings", baseUnit: "m", sample: 18 },
  { key: "current", label: "Current speed", description: "Tidal current flow", baseUnit: "knots", sample: 1.6 },
];

const WEATHER: Variable[] = [
  { key: "wind", label: "Wind speed", description: "Wind and gusts", baseUnit: "knots", sample: 14 },
  { key: "temp", label: "Temperature", description: "Air and water", baseUnit: "C", sample: 12 },
  { key: "pressure", label: "Pressure", description: "Barometric pressure", baseUnit: "mb", sample: 1013 },
  { key: "distance", label: "Distance", description: "Ranges on the map", baseUnit: "km", sample: 8 },
];

const ALL = [...WATER, ...WEATHER];

// Presets set every variable at once. The BC default (tide m · depth ft · wind
// kn …) deliberately matches NEITHER — a mixed screen is the intended default,
// so on first load no preset reads as selected. Changing any single row also
// breaks the match and deselects.
const METRIC: Record<MetricType, string> = {
  tide: "m", wave: "m", depth: "m", current: "kph",
  wind: "kph", temp: "C", pressure: "mb", distance: "km", precip: "mm",
};
const IMPERIAL: Record<MetricType, string> = {
  tide: "ft", wave: "ft", depth: "ft", current: "mph",
  wind: "mph", temp: "F", pressure: "inHg", distance: "miles", precip: "inches",
};

export default function UnitsSettingsPage() {
  const prefs = useUnitPreferences();
  const { setUnit } = prefs;

  // Current selection per variable, read straight off the provider.
  const selected: Record<MetricType, string> = {
    tide: prefs.tideUnit,
    wave: prefs.waveUnit,
    depth: prefs.depthUnit,
    current: prefs.currentUnit,
    wind: prefs.windUnit,
    temp: prefs.tempUnit,
    pressure: prefs.pressureUnit,
    distance: prefs.distanceUnit,
    precip: prefs.precipUnit,
  };

  const matchesPreset = (preset: Record<MetricType, string>) =>
    ALL.every((v) => selected[v.key] === preset[v.key]);
  const isMetric = matchesPreset(METRIC);
  const isImperial = matchesPreset(IMPERIAL);

  const applyPreset = (preset: Record<MetricType, string>) => {
    for (const v of ALL) {
      if (selected[v.key] !== preset[v.key]) {
        setUnit(v.key, preset[v.key] as AnyUnit);
      }
    }
  };

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className={`${PAGE_MEASURE} py-8`}>
          <div className={READING_MEASURE}>
            {/* Header */}
            <div className="mb-6">
              <div className="rc-label text-[10px] text-rc-brand">Settings</div>
              <h1 className="text-2xl font-bold text-rc-ink mt-1">Units</h1>
              <p className="text-sm text-rc-ink-soft mt-1.5 max-w-prose">
                How measurements read across the app. Mix freely — metres for tide,
                feet for depth, knots for wind. Changes apply instantly.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <span className="font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute mr-1">
                Quick set
              </span>
              <PresetButton label="All metric" active={isMetric} onClick={() => applyPreset(METRIC)} />
              <PresetButton label="All imperial" active={isImperial} onClick={() => applyPreset(IMPERIAL)} />
            </div>

            <Section title="On the water" variables={WATER} selected={selected} setUnit={setUnit} />
            <Section title="Weather & map" variables={WEATHER} selected={selected} setUnit={setUnit} />
          </div>
        </div>
      </main>
    </div>
  );
}

function PresetButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 px-4 rounded border font-rc-mono text-xs uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-1 ${
        active
          ? "border-rc-brand bg-rc-brand-soft text-rc-brand"
          : "border-rc-rule bg-rc-panel text-rc-ink-mute hover:text-rc-ink"
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  variables,
  selected,
  setUnit,
}: {
  title: string;
  variables: Variable[];
  selected: Record<MetricType, string>;
  setUnit: (type: MetricType, unit: AnyUnit) => void | Promise<void>;
}) {
  return (
    <section className="mb-8">
      <h2 className="font-rc-mono text-[10px] uppercase tracking-[0.1em] text-rc-ink-mute mb-2">
        {title}
      </h2>
      <div className="rounded border border-rc-rule bg-rc-panel divide-y divide-rc-rule">
        {variables.map((v) => {
          const options: ToggleOption[] = UNITS_FOR_TYPE[v.key].map((u) => ({
            value: u,
            label: unitLabel(v.key, u),
          }));
          const sampleText = convertAndFormat(
            v.sample,
            v.key,
            v.baseUnit,
            selected[v.key] as AnyUnit,
          );
          return (
            <div
              key={v.key}
              id={v.key}
              className="scroll-mt-24 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-rc-ink">{v.label}</div>
                <div className="text-[13px] text-rc-ink-soft">
                  {v.description}
                  <span className="text-rc-ink-mute"> · e.g. {sampleText}</span>
                </div>
              </div>
              <div className="shrink-0">
                <ToggleGroup
                  ariaLabel={v.label}
                  options={options}
                  value={selected[v.key]}
                  onChange={(u) => setUnit(v.key, u as AnyUnit)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
