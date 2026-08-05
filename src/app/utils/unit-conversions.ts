// Unit type definitions
// Wind and current share the same speed family (kn / km·h⁻¹ / mph / m·s⁻¹).
export type WindUnit = 'kph' | 'mph' | 'knots' | 'ms'
export type CurrentUnit = WindUnit
export type TempUnit = 'C' | 'F'
export type PrecipUnit = 'mm' | 'inches'
// Tide + wave heights are the simple metric/imperial pair.
export type HeightUnit = 'ft' | 'm'
export type TideUnit = HeightUnit
export type WaveUnit = HeightUnit
// Depth adds fathoms (marine soundings).
export type DepthUnit = 'ft' | 'm' | 'fathoms'
// Distance adds nautical miles.
export type DistanceUnit = 'km' | 'miles' | 'nm'
export type PressureUnit = 'mb' | 'inHg'

// The eight independent display variables (plus precip, kept for legacy call
// sites but not surfaced on the settings page).
export type MetricType =
  | 'wind'
  | 'temp'
  | 'precip'
  | 'tide'
  | 'wave'
  | 'depth'
  | 'current'
  | 'distance'
  | 'pressure'

export type AnyUnit =
  | WindUnit
  | TempUnit
  | PrecipUnit
  | HeightUnit
  | DepthUnit
  | DistanceUnit
  | PressureUnit

// Unit cycle orders
export const WIND_UNITS: WindUnit[] = ['kph', 'mph', 'knots', 'ms']
// Same speed family as wind (so the Imperial preset's mph is a valid option),
// but knots-first — the marine default for tidal current.
export const CURRENT_UNITS: CurrentUnit[] = ['knots', 'kph', 'mph', 'ms']
export const TEMP_UNITS: TempUnit[] = ['C', 'F']
export const PRECIP_UNITS: PrecipUnit[] = ['mm', 'inches']
export const HEIGHT_UNITS: HeightUnit[] = ['m', 'ft']
export const TIDE_UNITS: TideUnit[] = ['m', 'ft']
export const WAVE_UNITS: WaveUnit[] = ['m', 'ft']
export const DEPTH_UNITS: DepthUnit[] = ['ft', 'm', 'fathoms']
export const DISTANCE_UNITS: DistanceUnit[] = ['km', 'miles', 'nm']
export const PRESSURE_UNITS: PressureUnit[] = ['mb', 'inHg']

// Display labels where they differ from the unit key
export const WIND_LABELS: Record<WindUnit, string> = { kph: 'km/h', mph: 'mph', knots: 'kn', ms: 'm/s' }
export const DISTANCE_LABELS: Record<DistanceUnit, string> = { km: 'km', miles: 'mi', nm: 'nm' }
export const DEPTH_LABELS: Record<DepthUnit, string> = { ft: 'ft', m: 'm', fathoms: 'fm' }
export const HEIGHT_LABELS: Record<HeightUnit, string> = { ft: 'ft', m: 'm' }

// Fixed display precision per variable (the brief's sig-figs), centralized so
// every surface renders a value the same way rather than per-call-site toFixed.
export const DECIMALS: Record<MetricType, number> = {
  wind: 0,
  current: 1,
  temp: 1,
  tide: 1,
  wave: 1,
  depth: 0,
  distance: 1,
  pressure: 0,
  precip: 1,
}

// Which unit list backs each variable — used by getNextUnit and the settings UI.
export const UNITS_FOR_TYPE: Record<MetricType, readonly string[]> = {
  wind: WIND_UNITS,
  current: CURRENT_UNITS,
  temp: TEMP_UNITS,
  tide: TIDE_UNITS,
  wave: WAVE_UNITS,
  depth: DEPTH_UNITS,
  distance: DISTANCE_UNITS,
  pressure: PRESSURE_UNITS,
  precip: PRECIP_UNITS,
}

// Human label for a single (variable, unit) pair — for the settings segmented
// controls. Falls back to the unit key when no friendlier label exists.
export function unitLabel(type: MetricType, unit: string): string {
  switch (type) {
    case 'wind':
    case 'current':
      return WIND_LABELS[unit as WindUnit] ?? unit
    case 'distance':
      return DISTANCE_LABELS[unit as DistanceUnit] ?? unit
    case 'depth':
      return DEPTH_LABELS[unit as DepthUnit] ?? unit
    case 'temp':
      return `°${unit}`
    case 'pressure':
      return unit
    default:
      return unit
  }
}

// Get next unit in cycle
export function getNextUnit(currentUnit: AnyUnit, type: MetricType): string {
  const units = UNITS_FOR_TYPE[type]
  if (!units) return currentUnit
  const currentIndex = units.indexOf(currentUnit)
  const nextIndex = (currentIndex + 1) % units.length
  return units[nextIndex]
}

// Wind conversion functions (base unit: kph). Current speed shares this family.
export function convertWind(value: number, from: WindUnit, to: WindUnit): number {
  if (from === to) return value

  // Convert to kph first (base unit)
  let kph: number
  switch (from) {
    case 'kph':
      kph = value
      break
    case 'mph':
      kph = value * 1.60934
      break
    case 'knots':
      kph = value * 1.852
      break
    case 'ms':
      kph = value * 3.6
      break
  }

  // Convert from kph to target unit
  switch (to) {
    case 'kph':
      return kph
    case 'mph':
      return kph / 1.60934
    case 'knots':
      return kph / 1.852
    case 'ms':
      return kph / 3.6
  }
}

/** Current speed shares the wind speed family. */
export const convertCurrent = convertWind

// Temperature conversion functions
export function convertTemp(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value

  if (from === 'C' && to === 'F') {
    return (value * 9/5) + 32
  } else if (from === 'F' && to === 'C') {
    return (value - 32) * 5/9
  }

  return value
}

// Precipitation conversion functions
export function convertPrecip(value: number, from: PrecipUnit, to: PrecipUnit): number {
  if (from === to) return value

  if (from === 'mm' && to === 'inches') {
    return value / 25.4
  } else if (from === 'inches' && to === 'mm') {
    return value * 25.4
  }

  return value
}

// Height conversion functions (tide + wave; base unit: m)
export function convertHeight(value: number, from: HeightUnit, to: HeightUnit): number {
  if (from === to) return value

  if (from === 'm' && to === 'ft') {
    return value * 3.28084
  } else if (from === 'ft' && to === 'm') {
    return value / 3.28084
  }

  return value
}

// Depth conversion functions (base unit: m; adds fathoms)
const M_PER_FATHOM = 1.8288
export function convertDepth(value: number, from: DepthUnit, to: DepthUnit): number {
  if (from === to) return value
  // Normalize to metres, then to target.
  let m: number
  switch (from) {
    case 'm':
      m = value
      break
    case 'ft':
      m = value / 3.28084
      break
    case 'fathoms':
      m = value * M_PER_FATHOM
      break
  }
  switch (to) {
    case 'm':
      return m
    case 'ft':
      return m * 3.28084
    case 'fathoms':
      return m / M_PER_FATHOM
  }
}

// Distance conversion functions (base unit: km; adds nautical miles)
const KM_PER_NM = 1.852
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value
  // Normalize to km, then to target.
  let km: number
  switch (from) {
    case 'km':
      km = value
      break
    case 'miles':
      km = value / 0.621371
      break
    case 'nm':
      km = value * KM_PER_NM
      break
  }
  switch (to) {
    case 'km':
      return km
    case 'miles':
      return km * 0.621371
    case 'nm':
      return km / KM_PER_NM
  }
}

// Pressure conversion functions (mb ≡ hPa)
export function convertPressure(value: number, from: PressureUnit, to: PressureUnit): number {
  if (from === to) return value
  return from === 'mb' ? value * 0.02953 : value / 0.02953
}

// Format functions with unit labels
export function formatWind(value: number, unit: WindUnit, precision: number = 0): string {
  return `${value.toFixed(precision)} ${WIND_LABELS[unit]}`
}

export function formatTemp(value: number, unit: TempUnit, precision: number = 0): string {
  return `${value.toFixed(precision)}°${unit}`
}

export function formatPrecip(value: number, unit: PrecipUnit, precision: number = 1): string {
  const formatted = value.toFixed(precision)
  return unit === 'inches' ? `${formatted} in` : `${formatted} mm`
}

export function formatHeight(value: number, unit: HeightUnit, precision: number = 1): string {
  return `${value.toFixed(precision)} ${unit}`
}

export function formatDepth(value: number, unit: DepthUnit, precision: number = 0): string {
  return `${value.toFixed(precision)} ${DEPTH_LABELS[unit]}`
}

export function formatDistance(value: number, unit: DistanceUnit, precision: number = 1): string {
  return `${value.toFixed(precision)} ${DISTANCE_LABELS[unit]}`
}

export function formatPressure(value: number, unit: PressureUnit, precision: number = 0): string {
  // inHg needs decimals to be meaningful (29.92), mb reads as an integer
  const p = unit === 'inHg' ? Math.max(precision, 2) : precision
  return `${value.toFixed(p)} ${unit}`
}

// Main conversion and format function
export function convertAndFormat(
  value: number,
  type: MetricType,
  sourceUnit: AnyUnit,
  targetUnit: AnyUnit,
  precision?: number
): string {
  let convertedValue: number

  switch (type) {
    case 'wind':
    case 'current':
      convertedValue = convertWind(value, sourceUnit as WindUnit, targetUnit as WindUnit)
      return formatWind(convertedValue, targetUnit as WindUnit, precision ?? DECIMALS[type])
    case 'temp':
      convertedValue = convertTemp(value, sourceUnit as TempUnit, targetUnit as TempUnit)
      return formatTemp(convertedValue, targetUnit as TempUnit, precision ?? DECIMALS.temp)
    case 'precip':
      convertedValue = convertPrecip(value, sourceUnit as PrecipUnit, targetUnit as PrecipUnit)
      return formatPrecip(convertedValue, targetUnit as PrecipUnit, precision ?? DECIMALS.precip)
    case 'tide':
    case 'wave':
      convertedValue = convertHeight(value, sourceUnit as HeightUnit, targetUnit as HeightUnit)
      return formatHeight(convertedValue, targetUnit as HeightUnit, precision ?? DECIMALS[type])
    case 'depth':
      convertedValue = convertDepth(value, sourceUnit as DepthUnit, targetUnit as DepthUnit)
      return formatDepth(convertedValue, targetUnit as DepthUnit, precision ?? DECIMALS.depth)
    case 'distance':
      convertedValue = convertDistance(value, sourceUnit as DistanceUnit, targetUnit as DistanceUnit)
      return formatDistance(convertedValue, targetUnit as DistanceUnit, precision ?? DECIMALS.distance)
    case 'pressure':
      convertedValue = convertPressure(value, sourceUnit as PressureUnit, targetUnit as PressureUnit)
      return formatPressure(convertedValue, targetUnit as PressureUnit, precision ?? DECIMALS.pressure)
    default:
      return `${value}`
  }
}
