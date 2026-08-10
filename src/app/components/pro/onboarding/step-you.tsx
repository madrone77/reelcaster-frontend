"use client";

import type { MetricType, AnyUnit } from "@/app/utils/unit-conversions";

export type UnitPreset = "bc" | "metric" | "imperial";

// The three presets the wizard offers. The full nine-variable grid lives at
// /settings/units — asking someone to make nine independent measurement
// decisions before they've seen a forecast is how you lose them on step 2.
//
// "bc" is DEFAULT_UNITS: metres for tide and wave (how DFO quotes them), feet
// for depth (how anglers sound bottom), knots for wind. Keep in step with
// DEFAULT_UNITS in contexts/unit-preferences-context.tsx.
export const UNIT_PRESETS: Record<
  UnitPreset,
  { label: string; hint: string; units: Record<MetricType, AnyUnit> }
> = {
  bc: {
    label: "BC standard",
    hint: "Tide in metres, depth in feet, wind in knots",
    units: {
      tide: "m", wave: "m", depth: "ft", current: "knots",
      wind: "knots", temp: "C", pressure: "mb", distance: "km", precip: "mm",
    },
  },
  metric: {
    label: "All metric",
    hint: "Metres, °C, km/h",
    units: {
      tide: "m", wave: "m", depth: "m", current: "kph",
      wind: "kph", temp: "C", pressure: "mb", distance: "km", precip: "mm",
    },
  },
  imperial: {
    label: "All imperial",
    hint: "Feet, °F, mph",
    units: {
      tide: "ft", wave: "ft", depth: "ft", current: "mph",
      wind: "mph", temp: "F", pressure: "inHg", distance: "miles", precip: "inches",
    },
  },
};

const ORDER: UnitPreset[] = ["bc", "metric", "imperial"];

/**
 * Step 2 — the two things every other surface needs: what to call the angler,
 * and what units to render in. Both are required, though units arrive
 * pre-selected, so in practice this step is one text field.
 */
export default function StepYou({
  firstName,
  onFirstNameChange,
  preset,
  onPresetChange,
}: {
  firstName: string;
  onFirstNameChange: (v: string) => void;
  preset: UnitPreset;
  onPresetChange: (p: UnitPreset) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="rc-onboarding-name"
          className="block text-sm font-semibold text-rc-ink mb-1.5"
        >
          What should we call you?
        </label>
        <input
          id="rc-onboarding-name"
          type="text"
          value={firstName}
          autoFocus
          autoComplete="given-name"
          maxLength={40}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder="First name"
          className="w-full min-h-11 rounded-lg border border-rc-rule bg-white px-3 py-2.5 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none focus:ring-2 focus:ring-rc-brand focus:border-rc-brand"
        />
        <p className="mt-1.5 text-xs text-rc-ink-mute">
          Used to greet you on your dashboard and in alert emails. Nothing
          public.
        </p>
      </div>

      <fieldset>
        <legend className="block text-sm font-semibold text-rc-ink mb-1.5">
          How should measurements read?
        </legend>
        <div className="space-y-2">
          {ORDER.map((key) => {
            const { label, hint } = UNIT_PRESETS[key];
            const active = preset === key;
            return (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  active
                    ? "border-rc-brand bg-rc-brand-soft"
                    : "border-rc-rule bg-white hover:bg-rc-surface"
                }`}
              >
                <input
                  type="radio"
                  name="rc-units-preset"
                  value={key}
                  checked={active}
                  onChange={() => onPresetChange(key)}
                  className="mt-0.5 accent-rc-brand"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-rc-ink">
                    {label}
                  </span>
                  <span className="block text-xs text-rc-ink-soft">{hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-rc-ink-mute">
          Every variable is adjustable on its own later, under Settings → Units.
        </p>
      </fieldset>
    </div>
  );
}
