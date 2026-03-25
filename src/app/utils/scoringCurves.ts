/**
 * Scoring Curves — Declarative representation of all 16 factor scoring functions.
 *
 * Each production scoring function is transcribed into an array of breakpoints.
 * `evaluateCurve()` does piecewise-linear interpolation to reproduce the original
 * behaviour, while allowing the Algorithm Designer to edit curves in real-time.
 */

import type { FactorKey } from './algorithmDesigner'
import type { OpenMeteo15MinData } from './openMeteoApi'
import type { CHSWaterData } from './chsTideApi'
import type { TidalPhaseConfig } from './tidalPhaseScoring'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CurveBreakpoint {
  input: number // x-axis (raw measurement value)
  score: number // y-axis (0-10)
}

export interface ScoringCurve {
  inputLabel: string
  inputUnit: string
  inputRange: [number, number] // display x-axis range
  breakpoints: CurveBreakpoint[]
  description: string
  modifiers?: string[] // read-only notes about non-curve adjustments
}

// ─── Piecewise-Linear Evaluator ─────────────────────────────────────────────

/** Evaluate a scoring curve at a given input value via piecewise-linear interpolation. */
export function evaluateCurve(curve: ScoringCurve, inputValue: number): number {
  const { breakpoints } = curve
  if (breakpoints.length === 0) return 5

  // Clamp below first / above last
  if (inputValue <= breakpoints[0].input) return clamp(breakpoints[0].score)
  if (inputValue >= breakpoints[breakpoints.length - 1].input)
    return clamp(breakpoints[breakpoints.length - 1].score)

  // Find the two surrounding breakpoints
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i]
    const b = breakpoints[i + 1]
    if (inputValue >= a.input && inputValue <= b.input) {
      const t = (inputValue - a.input) / (b.input - a.input)
      return clamp(a.score + t * (b.score - a.score))
    }
  }

  return clamp(breakpoints[breakpoints.length - 1].score)
}

function clamp(v: number): number {
  return Math.min(10, Math.max(0, Math.round(v * 100) / 100))
}

// ─── Default Scoring Curves (transcribed from fishingCalculations.ts) ───────

export const DEFAULT_SCORING_CURVES: Record<FactorKey, ScoringCurve> = {
  // ── Pressure (calculatePressureScore) ────────────────────────────────
  // Symmetric around 1017.5 hPa optimal
  pressure: {
    inputLabel: 'Barometric Pressure',
    inputUnit: 'hPa',
    inputRange: [995, 1040],
    description: 'Optimal 1015-1020 hPa. Fish are most active near stable barometric pressure.',
    breakpoints: [
      { input: 997.5, score: 1 },
      { input: 1007.5, score: 2 },
      { input: 1012.5, score: 8 },
      { input: 1015, score: 10 },
      { input: 1020, score: 10 },
      { input: 1022.5, score: 8 },
      { input: 1027.5, score: 2 },
      { input: 1037.5, score: 1 },
    ],
  },

  // ── Wind (calculateEnhancedWindScore) ─────────────────────────────────
  // Uses effective wind = max(speed, gusts*0.7) in m/s
  wind: {
    inputLabel: 'Effective Wind Speed',
    inputUnit: 'm/s',
    inputRange: [0, 30],
    description: 'Effective wind = max(speed, gusts×0.7). Lower wind is better for fishing.',
    modifiers: [
      'Gust penalty: ×0.9 if gusts >1.5× speed, ×0.8 if >2×, ×0.7 if >3×',
      'Direction bonus: ×1.05 easterly (45-135°), ×0.95 westerly (270-360°/0-45°)',
    ],
    breakpoints: [
      { input: 0, score: 10 },
      { input: 1, score: 10 },
      { input: 3, score: 9 },
      { input: 6, score: 7 },
      { input: 10, score: 5 },
      { input: 15, score: 3 },
      { input: 20, score: 1.5 },
      { input: 25, score: 0.5 },
    ],
  },

  // ── Temperature (calculateTemperatureScore) ───────────────────────────
  temperature: {
    inputLabel: 'Air Temperature',
    inputUnit: '°C',
    inputRange: [-5, 35],
    description: 'Optimal 10-14°C for Pacific Northwest fishing.',
    breakpoints: [
      { input: -2, score: 1 },
      { input: 2, score: 2 },
      { input: 6, score: 6 },
      { input: 10, score: 10 },
      { input: 14, score: 10 },
      { input: 18, score: 6 },
      { input: 22, score: 1 },
      { input: 30, score: 0.2 },
    ],
  },

  // ── Precipitation (calculatePrecipitationScoreFromMM) ─────────────────
  precipitation: {
    inputLabel: 'Precipitation',
    inputUnit: 'mm',
    inputRange: [0, 15],
    description: 'Less rain is better. Light drizzle is fine, heavy rain drives fish deep.',
    breakpoints: [
      { input: 0, score: 10 },
      { input: 0.1, score: 10 },
      { input: 0.5, score: 8 },
      { input: 1.0, score: 7 },
      { input: 2.5, score: 5 },
      { input: 5.0, score: 2 },
      { input: 10.0, score: 1 },
      { input: 15, score: 0.2 },
    ],
  },

  // ── Cloud Cover (calculateCloudScore) ─────────────────────────────────
  cloudCover: {
    inputLabel: 'Cloud Cover',
    inputUnit: '%',
    inputRange: [0, 100],
    description: 'Optimal 30-60% cloud cover. Some shade encourages fish to surface-feed.',
    breakpoints: [
      { input: 0, score: 2 },
      { input: 5, score: 3 },
      { input: 15, score: 6 },
      { input: 30, score: 10 },
      { input: 60, score: 10 },
      { input: 75, score: 7 },
      { input: 90, score: 3 },
      { input: 100, score: 1 },
    ],
  },

  // ── Visibility (calculateVisibilityScore) ─────────────────────────────
  visibility: {
    inputLabel: 'Visibility',
    inputUnit: 'm',
    inputRange: [0, 15000],
    description: 'Better visibility means safer and more productive fishing.',
    breakpoints: [
      { input: 0, score: 1 },
      { input: 500, score: 3 },
      { input: 1000, score: 5 },
      { input: 2000, score: 7 },
      { input: 5000, score: 9 },
      { input: 10000, score: 10 },
    ],
  },

  // ── Sunshine (calculateSunshineScore) ─────────────────────────────────
  // sunshineDuration is summed across the 8-segment block, so max is 8×900 = 7200s
  // We convert to percentage for the curve: (sum / 7200) * 100
  sunshine: {
    inputLabel: 'Sunshine',
    inputUnit: '%',
    inputRange: [0, 100],
    description: 'Percentage of block with sunshine. Moderate sun is ideal.',
    breakpoints: [
      { input: 0, score: 5 },
      { input: 10, score: 6 },
      { input: 25, score: 7 },
      { input: 50, score: 9 },
      { input: 75, score: 10 },
      { input: 100, score: 10 },
    ],
  },

  // ── Lightning (calculateLightningScore) ───────────────────────────────
  lightning: {
    inputLabel: 'Lightning Potential',
    inputUnit: 'J/kg',
    inputRange: [0, 3000],
    description: 'Safety factor. Lower is better — high CAPE means thunderstorm risk.',
    breakpoints: [
      { input: 0, score: 10 },
      { input: 100, score: 10 },
      { input: 500, score: 8 },
      { input: 1000, score: 6 },
      { input: 2000, score: 3 },
      { input: 3000, score: 1 },
    ],
  },

  // ── Atmospheric Stability (calculateAtmosphericStabilityScore) ────────
  atmospheric: {
    inputLabel: 'CAPE',
    inputUnit: 'J/kg',
    inputRange: [0, 4000],
    description: 'Convective Available Potential Energy. Lower = more stable = better fishing.',
    breakpoints: [
      { input: 0, score: 10 },
      { input: 500, score: 10 },
      { input: 1000, score: 8 },
      { input: 2000, score: 6 },
      { input: 3000, score: 4 },
      { input: 4000, score: 2 },
    ],
  },

  // ── Comfort (calculateComfortScore) ───────────────────────────────────
  // Primary input: |apparentTemp - 12| deviation
  comfort: {
    inputLabel: 'Feels-Like Deviation',
    inputUnit: '°C',
    inputRange: [0, 25],
    description: 'Deviation of apparent temperature from ideal 12°C. Lower is more comfortable.',
    modifiers: [
      'Humidity: ×0.9 if 30-40% or 80-90%, ×0.7 if outside 30-90%',
      'Dew point: ×0.9 if 10-15°C, ×0.8 if 15-20°C, ×0.6 if >20°C',
    ],
    breakpoints: [
      { input: 0, score: 10 },
      { input: 4, score: 10 },
      { input: 8, score: 8 },
      { input: 12, score: 6 },
      { input: 16, score: 4 },
      { input: 20, score: 2 },
    ],
  },

  // ── Time of Day (calculateTimeScore) ──────────────────────────────────
  // Primary input: hours from nearest sunrise/sunset
  timeOfDay: {
    inputLabel: 'Hours from Dawn/Dusk',
    inputUnit: 'h',
    inputRange: [0, 8],
    description: 'Distance in hours from the nearest sunrise or sunset. Dawn/dusk are peak fishing.',
    modifiers: [
      'Uses precise sunrise/sunset times for the location and date',
      'Secondary peaks: early morning (6-9am) ~6, evening (5-8pm) ~6',
      'Mid-day (10am-4pm) ~3-4, night (10pm-5am) ~1',
    ],
    breakpoints: [
      { input: 0, score: 10 },
      { input: 0.5, score: 10 },
      { input: 1.5, score: 8 },
      { input: 3, score: 6 },
      { input: 5, score: 3.5 },
      { input: 8, score: 1 },
    ],
  },

  // ── Tide (calculateEnhancedTideScore) ─────────────────────────────────
  // Primary input: hours to next tide change
  tide: {
    inputLabel: 'Hours to Tide Change',
    inputUnit: 'h',
    inputRange: [0, 7],
    description: 'Closer to tide change = more water movement = better fishing.',
    modifiers: [
      'Rising tide bonus: ×1.2',
      'Tidal range >3m bonus: ×1.1',
      'Change rate >0.5 m/h bonus: ×1.1',
      'Current speed >0.5 kn bonus: ×1.1',
    ],
    breakpoints: [
      { input: 0, score: 10 },
      { input: 2, score: 5 },
      { input: 4, score: 2 },
      { input: 6, score: 0.5 },
    ],
  },

  // ── Water Temperature (calculateWaterTemperatureScore, default) ───────
  waterTemperature: {
    inputLabel: 'Water Temperature',
    inputUnit: '°C',
    inputRange: [0, 25],
    description: 'Optimal 8-14°C for general Pacific Northwest species.',
    modifiers: ['Species-specific profiles override this curve when a species is selected'],
    breakpoints: [
      { input: 2, score: 2 },
      { input: 4, score: 3 },
      { input: 6, score: 7 },
      { input: 8, score: 10 },
      { input: 14, score: 10 },
      { input: 16, score: 7 },
      { input: 20, score: 2 },
    ],
  },

  // ── Current Speed (calculateCurrentScore — speed only, default) ───────
  currentSpeed: {
    inputLabel: 'Current Speed',
    inputUnit: 'kn',
    inputRange: [0, 4],
    description: 'Moderate current (0.5-1.5 kn) is optimal — brings baitfish.',
    modifiers: ['Species-specific profiles may multiply by currentSpeedPreference'],
    breakpoints: [
      { input: 0, score: 3 },
      { input: 0.2, score: 3 },
      { input: 0.5, score: 6 },
      { input: 1.0, score: 9 },
      { input: 1.5, score: 9 },
      { input: 2.5, score: 7 },
      { input: 3.5, score: 4 },
    ],
  },

  // ── Current Direction (calculateCurrentScore — direction only) ────────
  currentDirection: {
    inputLabel: 'Current Direction',
    inputUnit: '°',
    inputRange: [0, 360],
    description: 'NE flood (30-60°) and SW ebb (210-240°) are preferred in BC waters.',
    breakpoints: [
      { input: 0, score: 6 },
      { input: 30, score: 8 },
      { input: 60, score: 8 },
      { input: 90, score: 6 },
      { input: 135, score: 4 },
      { input: 180, score: 6 },
      { input: 210, score: 8 },
      { input: 240, score: 8 },
      { input: 270, score: 6 },
      { input: 315, score: 4 },
      { input: 360, score: 6 },
    ],
  },

  // ── Species (no single-input curve) ───────────────────────────────────
  species: {
    inputLabel: 'Species Score',
    inputUnit: '',
    inputRange: [0, 10],
    description:
      'Composite species-specific modifier driven by species profiles. Not editable as a single-input curve.',
    breakpoints: [
      { input: 0, score: 0 },
      { input: 5, score: 5 },
      { input: 10, score: 10 },
    ],
  },
}

// ─── Factor Input Extraction ────────────────────────────────────────────────

export interface FactorInputDef {
  /** Extract raw input value from averaged block data + optional tide data */
  extractor: (
    block: OpenMeteo15MinData,
    tideData: CHSWaterData | null,
    sunrise: number,
    sunset: number,
  ) => number | null
  label: string
  unit: string
}

export const FACTOR_INPUT_MAP: Record<FactorKey, FactorInputDef> = {
  pressure: {
    extractor: (b) => b.pressure,
    label: 'Pressure',
    unit: 'hPa',
  },
  wind: {
    // Effective wind: max(speed/3.6, gusts/3.6 * 0.7)
    // Note: OpenMeteo gives km/h, scoring uses m/s
    extractor: (b) => {
      const speedMs = b.windSpeed / 3.6
      const gustsMs = b.windGusts / 3.6
      return Math.max(speedMs, gustsMs * 0.7)
    },
    label: 'Effective Wind',
    unit: 'm/s',
  },
  temperature: {
    extractor: (b) => b.temp,
    label: 'Temperature',
    unit: '°C',
  },
  precipitation: {
    extractor: (b) => b.precipitation,
    label: 'Precipitation',
    unit: 'mm',
  },
  cloudCover: {
    extractor: (b) => b.cloudCover,
    label: 'Cloud Cover',
    unit: '%',
  },
  visibility: {
    extractor: (b) => b.visibility,
    label: 'Visibility',
    unit: 'm',
  },
  sunshine: {
    // sunshineDuration is summed across 8 segments in block averaging, max 7200s
    // Convert to percentage
    extractor: (b) => (b.sunshineDuration / 7200) * 100,
    label: 'Sunshine',
    unit: '%',
  },
  lightning: {
    extractor: (b) => b.lightningPotential,
    label: 'Lightning Potential',
    unit: 'J/kg',
  },
  atmospheric: {
    extractor: (b) => b.cape,
    label: 'CAPE',
    unit: 'J/kg',
  },
  comfort: {
    // Primary dimension: deviation from ideal 12°C apparent temp
    extractor: (b) => Math.abs(b.apparentTemp - 12),
    label: 'Feels-Like Deviation',
    unit: '°C',
  },
  timeOfDay: {
    // Hours from nearest sunrise or sunset
    extractor: (b, _tide, sunrise, sunset) => {
      const date = new Date(b.timestamp * 1000)
      const hour = date.getHours() + date.getMinutes() / 60
      const sunriseHour =
        new Date(sunrise * 1000).getHours() + new Date(sunrise * 1000).getMinutes() / 60
      const sunsetHour =
        new Date(sunset * 1000).getHours() + new Date(sunset * 1000).getMinutes() / 60
      return Math.min(Math.abs(hour - sunriseHour), Math.abs(hour - sunsetHour))
    },
    label: 'Hours from Dawn/Dusk',
    unit: 'h',
  },
  tide: {
    // Hours to next tide change
    extractor: (_b, tide) => {
      if (!tide) return null
      return tide.timeToNextTide / 60
    },
    label: 'Hours to Change',
    unit: 'h',
  },
  waterTemperature: {
    extractor: (_b, tide) => {
      if (!tide?.waterTemperature) return null
      return tide.waterTemperature
    },
    label: 'Water Temp',
    unit: '°C',
  },
  currentSpeed: {
    extractor: (_b, tide) => {
      if (tide?.currentSpeed === undefined) return null
      return tide.currentSpeed
    },
    label: 'Current Speed',
    unit: 'kn',
  },
  currentDirection: {
    extractor: (_b, tide) => {
      if (tide?.currentDirection === undefined) return null
      return tide.currentDirection
    },
    label: 'Current Direction',
    unit: '°',
  },
  species: {
    // No single raw input — display-only
    extractor: () => null,
    label: 'Species Score',
    unit: '',
  },
}

// ─── Block Reconstruction ───────────────────────────────────────────────────

/**
 * Reconstruct the averaged 2-hour block data from raw 15-min data.
 * Replicates the exact grouping logic from `generateOpenMeteoDailyForecasts` lines 1124-1166.
 */
export function extractBlockAveragedData(
  dayMinutely: OpenMeteo15MinData[],
): OpenMeteo15MinData[] {
  const blocks: OpenMeteo15MinData[] = []

  for (let i = 0; i < dayMinutely.length; i += 8) {
    const segments = dayMinutely.slice(i, i + 8)
    if (segments.length < 4) continue

    const first = segments[0]
    blocks.push({
      time: first.time,
      timestamp: first.timestamp,
      temp: avg(segments, (s) => s.temp),
      humidity: avg(segments, (s) => s.humidity),
      dewPoint: avg(segments, (s) => s.dewPoint),
      apparentTemp: avg(segments, (s) => s.apparentTemp),
      precipitation: Math.max(...segments.map((s) => s.precipitation)),
      precipitationProbability: Math.max(...segments.map((s) => s.precipitationProbability)),
      weatherCode: first.weatherCode,
      pressure: avg(segments, (s) => s.pressure),
      cloudCover: avg(segments, (s) => s.cloudCover),
      windSpeed: avg(segments, (s) => s.windSpeed),
      windDirection: first.windDirection,
      windGusts: Math.max(...segments.map((s) => s.windGusts)),
      visibility: avg(segments, (s) => s.visibility),
      sunshineDuration: segments.reduce((sum, s) => sum + s.sunshineDuration, 0),
      lightningPotential: Math.max(...segments.map((s) => s.lightningPotential)),
      cape: avg(segments, (s) => s.cape),
    })
  }

  return blocks
}

function avg(items: OpenMeteo15MinData[], getter: (item: OpenMeteo15MinData) => number): number {
  return items.reduce((sum, item) => sum + getter(item), 0) / items.length
}

// ─── Custom Curve Value Union ───────────────────────────────────────────

/** Union type — tide factor can use TidalPhaseConfig, all others use ScoringCurve */
export type CustomCurveValue = ScoringCurve | TidalPhaseConfig

export function isTidalPhaseConfig(curve: CustomCurveValue): curve is TidalPhaseConfig {
  return 'phaseProfile' in curve
}
