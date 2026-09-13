/**
 * Which units a spot reads in, decided by the country the water is in.
 *
 * Canadian water keeps the BC marine convention this app has always shown.
 * US water (Washington, Oregon, California) reads in feet, Fahrenheit and
 * miles, because that is what a US angler's charts, tide tables and weather
 * radio use. Wind and current stay in knots in both countries: it is a marine
 * product, and no angler on either side reads a tidal current in mph.
 *
 * A unit the angler picked for themselves wins in both countries. "Picked"
 * means saved: a signed-in preference, or a choice made on this device. A
 * default that happens to be written down somewhere is not a choice, see
 * `choicesFromLegacyLocal`.
 *
 * Pure, no React, so it runs under `npx tsx src/lib/unit-system.test.ts`.
 */

import { provinceCodeFromName } from "@/lib/regions";
import {
  convertDistance,
  convertHeight,
  convertTemp,
  DISTANCE_LABELS,
  type CurrentUnit,
  type DepthUnit,
  type DistanceUnit,
  type PrecipUnit,
  type PressureUnit,
  type TempUnit,
  type TideUnit,
  type WaveUnit,
  type WindUnit,
} from "@/app/utils/unit-conversions";

export type UnitCountry = "US" | "CA";

export interface UnitPrefs {
  windUnit: WindUnit;
  currentUnit: CurrentUnit;
  tempUnit: TempUnit;
  precipUnit: PrecipUnit;
  tideUnit: TideUnit;
  waveUnit: WaveUnit;
  depthUnit: DepthUnit;
  distanceUnit: DistanceUnit;
  pressureUnit: PressureUnit;
}

/** Units the angler chose. Any key left out falls back to the country. */
export type UnitChoices = Partial<UnitPrefs>;

// Defaults: BC marine convention. Wind + current in knots and pressure in mb
// (marine standard); wave height in metres (how marine forecasts quote it);
// TIDE and DEPTH in FEET (how BC anglers talk about both); distance in km.
// A mixed screen (km + ft + m) is the intended default, not an accident. Keep
// in step with DEFAULT_PREFERENCES in lib/user-preferences.ts.
export const CA_DEFAULT_UNITS: UnitPrefs = {
  windUnit: "knots",
  currentUnit: "knots",
  tempUnit: "C",
  precipUnit: "mm",
  tideUnit: "ft",
  waveUnit: "m",
  depthUnit: "ft",
  distanceUnit: "km",
  pressureUnit: "mb",
};

// US water: feet for every height, Fahrenheit, miles, inches of rain. Knots
// and millibars stay: NOAA's marine forecasts quote wind in knots and
// pressure in millibars.
export const US_DEFAULT_UNITS: UnitPrefs = {
  windUnit: "knots",
  currentUnit: "knots",
  tempUnit: "F",
  precipUnit: "inches",
  tideUnit: "ft",
  waveUnit: "ft",
  depthUnit: "ft",
  distanceUnit: "miles",
  pressureUnit: "mb",
};

/**
 * What the Explore drawer has always shown for Canadian water: tide in metres
 * and air in Celsius, formatted before any preference was read. Kept so a
 * Victoria spot on Explore reads exactly as it did.
 */
export const CA_EXPLORE_RAIL_UNITS: UnitPrefs = {
  ...CA_DEFAULT_UNITS,
  tideUnit: "m",
};

const US_REGIONS = new Set(["WA", "OR", "CA"]);
const CA_REGIONS = new Set(["BC"]);

/**
 * A state or province (name or code) to the country whose units apply.
 *
 * `region` wins because it is exact: "CA" as a REGION is California. The
 * `country` argument is a fallback for payloads with no region, and there
 * "CA" means Canada, the same way the /fishing/<country> slot reads it.
 * Null when neither says, so the caller keeps today's (Canadian) behaviour.
 */
export function unitCountryFor(
  region: string | null | undefined,
  country?: string | null,
): UnitCountry | null {
  if (region && region.trim()) {
    const code = provinceCodeFromName(region);
    if (US_REGIONS.has(code)) return "US";
    if (CA_REGIONS.has(code)) return "CA";
  }
  if (country && country.trim()) {
    const c = country.trim().toLowerCase();
    if (c === "us" || c === "usa" || c === "united states") return "US";
    if (c === "ca" || c === "canada") return "CA";
  }
  return null;
}

/** "san-diego-ca" -> US, "victoria-bc" -> CA. City slugs end in the region. */
export function unitCountryForCitySlug(slug: string | null | undefined): UnitCountry | null {
  const m = slug?.match(/-([a-z]{2})$/i);
  return m ? unitCountryFor(m[1]) : null;
}

/** Tide station source: CHS stations are Canadian, NOAA and NDBC are US. */
export function unitCountryForStationSource(source: string | null | undefined): UnitCountry | null {
  if (source === "chs") return "CA";
  if (source === "noaa" || source === "ndbc") return "US";
  return null;
}

/**
 * The units to render with. The angler's own choices first, then the
 * country's defaults. With no country, Canadian: that is what every surface
 * showed before US water existed, so an unknown spot changes nothing.
 *
 * `caBase` lets a surface keep its own historic Canadian defaults (the Explore
 * drawer's metres) without dragging US water along with it.
 */
export function chooseUnits(
  country: UnitCountry | null,
  choices: UnitChoices,
  caBase: UnitPrefs = CA_DEFAULT_UNITS,
): UnitPrefs {
  const base = country === "US" ? US_DEFAULT_UNITS : caBase;
  const out: UnitPrefs = { ...base };
  for (const key of Object.keys(base) as (keyof UnitPrefs)[]) {
    const v = choices[key];
    if (v) (out as unknown as Record<string, string>)[key] = v;
  }
  return out;
}

/** The unit keys, in one place, for the readers below. */
const UNIT_KEYS = Object.keys(CA_DEFAULT_UNITS) as (keyof UnitPrefs)[];

/**
 * What a signed-in angler actually saved, read off the raw preference blob
 * (NOT merged with defaults). Two legacy migrations ride along: current once
 * borrowed the wind unit, and depth was once part of a single height key.
 */
export function choicesFromSaved(saved: Record<string, unknown> | null | undefined): UnitChoices {
  if (!saved) return {};
  const out: Record<string, string> = {};
  for (const key of UNIT_KEYS) {
    const v = saved[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  if (!out.currentUnit && typeof saved.windUnit === "string" && saved.windUnit) {
    out.currentUnit = saved.windUnit;
  }
  if (!out.depthUnit && typeof saved.heightUnit === "string" && saved.heightUnit) {
    out.depthUnit = saved.heightUnit;
  }
  return out as UnitChoices;
}

/**
 * The old on-device blob stored EVERY unit, defaults included, so it cannot
 * say which ones were chosen. A value that differs from the Canadian default
 * must have been picked; one that matches it may just be the default written
 * down, and reading it as a choice would pin a US angler to Celsius. So only
 * the differences carry over.
 */
export function choicesFromLegacyLocal(blob: Record<string, unknown> | null | undefined): UnitChoices {
  if (!blob) return {};
  const out: Record<string, string> = {};
  for (const key of UNIT_KEYS) {
    const v = blob[key];
    if (typeof v === "string" && v && v !== CA_DEFAULT_UNITS[key]) out[key] = v;
  }
  return out as UnitChoices;
}

// ── Formatting ───────────────────────────────────────────────────────────

/**
 * "+1.2m" / "-0.4ft": signed, one decimal, no space (the drawer's style).
 * Written exactly as the drawer always wrote metres, so Canadian water reads
 * the same down to the sign on a near-zero tide.
 */
export function formatSignedTide(m: number, unit: TideUnit): string {
  const v = convertHeight(m, "m", unit);
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}${unit}`;
}

/** "20°C" / "68°F": whole degrees. */
export function formatWholeTemp(c: number, unit: TempUnit): string {
  return `${Math.round(convertTemp(c, "C", unit))}°${unit}`;
}

/**
 * A distance from a city, as the drawer's sub line reads it. Kilometres print
 * the number as it arrives ("186 km"), which is what the drawer always did.
 * Miles and nautical miles round to whole units past 10, one decimal under.
 */
export function formatSpotDistance(km: number, unit: DistanceUnit): string {
  if (unit === "km") return `${km} km`;
  const v = convertDistance(km, "km", unit);
  const s = v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
  return `${s} ${DISTANCE_LABELS[unit]}`;
}
