"use client";

import { COVERED_PROVINCES } from "@/lib/regions";
import SpotTypeahead, { type PickedSpot } from "./spot-typeahead";

const REGION_LABEL: Record<string, string> = {
  BC: "British Columbia",
  WA: "Washington",
};

/**
 * Step 3 — where the angler fishes. The region sets the regulator and seeds
 * region-scoped surfaces; the home spot becomes the dashboard hero and the
 * anchor for the alert on the next step.
 *
 * Both optional. Someone who hasn't decided on a home spot yet is better served
 * skipping to the map than being made to pick one under pressure.
 */
export default function StepWater({
  region,
  onRegionChange,
  spot,
  onSpotChange,
}: {
  region: string | null;
  onRegionChange: (r: string) => void;
  spot: PickedSpot | null;
  onSpotChange: (s: PickedSpot | null) => void;
}) {
  // Picking a spot in a region you didn't select is a correction, not an
  // error — follow the spot, since it's the more specific statement.
  const handleSpot = (next: PickedSpot | null) => {
    onSpotChange(next);
    if (next?.province && next.province !== region) {
      onRegionChange(next.province.toUpperCase());
    }
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="block text-sm font-semibold text-rc-ink mb-1.5">
          Where do you fish?
        </legend>
        <div className="flex flex-wrap gap-2">
          {COVERED_PROVINCES.map((code) => {
            const active = region === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => onRegionChange(code)}
                className={`min-h-11 px-4 rounded-lg border text-sm font-medium transition-colors ${
                  active
                    ? "border-rc-brand bg-rc-brand-soft text-rc-brand"
                    : "border-rc-rule bg-white text-rc-ink hover:bg-rc-surface"
                }`}
              >
                {REGION_LABEL[code] ?? code}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-rc-ink-mute">
          Sets which fisheries authority&rsquo;s regulations we read for you.
        </p>
      </fieldset>

      <div>
        <p className="text-sm font-semibold text-rc-ink mb-1.5">
          Pin a home spot
        </p>
        <SpotTypeahead
          value={spot}
          onChange={handleSpot}
          provinceFilter={region}
        />
        <p className="mt-1.5 text-xs text-rc-ink-mute">
          Your dashboard opens on it — today&rsquo;s conditions, its
          regulations, and the 14-day run. You can change it from any spot page.
        </p>
      </div>
    </div>
  );
}
