"use client";

import type { TodayFactor, FactorVerdict } from "@/lib/bluecaster/live-spot-types";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import type { UnitPrefs } from "@/contexts/unit-preferences-context";
import {
  convertWind,
  convertTemp,
  convertHeight,
  convertDistance,
  convertPressure,
  WIND_LABELS,
  DISTANCE_LABELS,
} from "@/app/utils/unit-conversions";

const VERDICT_CFG: Record<FactorVerdict, { dot: string; pill: string; label: string }> = {
  Prime: { dot: "bg-rc-good", pill: "bg-rc-good-bg text-rc-good-ink", label: "Prime" },
  Fair: { dot: "bg-rc-fair", pill: "bg-rc-fair-bg text-rc-fair-ink", label: "Fair" },
  Poor: { dot: "bg-rc-poor", pill: "bg-rc-poor-bg text-rc-poor-ink", label: "Tough" },
};

/**
 * Compose the factor's value line in the viewer's units for the unit-bearing
 * engine keys, mirroring the server's banding (thresholds evaluate on the
 * SOURCE value so the wording never drifts from the verdict). Everything
 * else — phases, light, trends, unknown keys, missing raw — returns null and
 * the caller falls back to the server-composed `valueLine`.
 */
function composeValueLine(factor: TodayFactor, units: UnitPrefs): string | null {
  if (factor.key == null || typeof factor.raw !== "number" || !Number.isFinite(factor.raw)) {
    return null;
  }
  const v = factor.raw;
  switch (factor.key) {
    case "tidal_current_speed_kt": {
      if (v < 0.2) return "Slack";
      const s = `${convertWind(v, "knots", units.windUnit).toFixed(1)} ${WIND_LABELS[units.windUnit]}`;
      return v < 0.7 ? `${s} light` : s;
    }
    case "tide_range_24h_m":
      return `${convertHeight(v, "m", units.heightUnit).toFixed(1)} ${units.heightUnit} range today`;
    case "swell_height_m":
      if (v < 0.1) return "Flat";
      return `${convertHeight(v, "m", units.heightUnit).toFixed(1)} ${units.heightUnit}`;
    case "wave_height_m":
      if (v < 0.15) return "Flat";
      return `${convertHeight(v, "m", units.heightUnit).toFixed(1)} ${units.heightUnit} chop`;
    case "sea_surface_temp_c":
      return `${convertTemp(v, "C", units.tempUnit).toFixed(1)}°${units.tempUnit}`;
    case "barometric_pressure_hpa":
      // mb ≡ hPa numerically; keep the server's "hPa" label for metric.
      return units.pressureUnit === "inHg"
        ? `${convertPressure(v, "mb", "inHg").toFixed(2)} inHg`
        : `${Math.round(v)} hPa`;
    case "visibility_km": {
      const s = `${Math.round(convertDistance(v, "km", units.distanceUnit))}${DISTANCE_LABELS[units.distanceUnit]}`;
      return v < 5 ? `${s} hazy` : `${s} clear`;
    }
    default:
      return null;
  }
}

function FactorRow({ factor, units }: { factor: TodayFactor; units: UnitPrefs }) {
  const cfg = VERDICT_CFG[factor.status];
  const valueLine = composeValueLine(factor, units) ?? factor.valueLine;
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-start gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full ${cfg.dot} mt-1.5 shrink-0`} aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium text-rc-ink leading-tight">{factor.label}</div>
          {valueLine && (
            <div className="font-rc-mono text-[11px] text-rc-ink-mute leading-tight mt-0.5">
              {valueLine}
            </div>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.04em] ${cfg.pill}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}

/**
 * "Why this score" — the factors the scoring engine actually weighed for the
 * current species today (tide/current/wind/light/season, per-factor Prime /
 * Fair / Tough + the real reading that drove it). This is the same
 * `todayFactorsBySpecies` the engine has always returned; it just wasn't
 * surfaced on the modular spot-detail page yet.
 */
export default function ScoreFactors({ factors }: { factors: TodayFactor[] }) {
  const units = useUnitPreferences();
  return (
    <div>
      <div className="rc-label text-[9px] mb-1">Why this score</div>
      {factors.length > 0 ? (
        <div className="divide-y divide-rc-rule-soft">
          {factors.map((f) => (
            <FactorRow key={f.label} factor={f} units={units} />
          ))}
        </div>
      ) : (
        <p className="font-rc-mono text-xs text-rc-ink-mute italic py-2">
          No factor breakdown for this species yet.
        </p>
      )}
    </div>
  );
}
