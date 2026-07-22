// Unit type definitions
export type WindUnit = 'kph' | 'mph' | 'knots'
export type TempUnit = 'C' | 'F'
export type PrecipUnit = 'mm' | 'inches'
export type HeightUnit = 'ft' | 'm'
export type DistanceUnit = 'km' | 'miles'
export type PressureUnit = 'mb' | 'inHg'
export type MetricType = 'wind' | 'temp' | 'precip' | 'height' | 'distance' | 'pressure'
export type AnyUnit = WindUnit | TempUnit | PrecipUnit | HeightUnit | DistanceUnit | PressureUnit

// Unit cycle orders
export const WIND_UNITS: WindUnit[] = ['kph', 'mph', 'knots']
export const TEMP_UNITS: TempUnit[] = ['C', 'F']
export const PRECIP_UNITS: PrecipUnit[] = ['mm', 'inches']
export const HEIGHT_UNITS: HeightUnit[] = ['m', 'ft']
export const DISTANCE_UNITS: DistanceUnit[] = ['km', 'miles']
export const PRESSURE_UNITS: PressureUnit[] = ['mb', 'inHg']

// Display labels where they differ from the unit key
export const WIND_LABELS: Record<WindUnit, string> = { kph: 'km/h', mph: 'mph', knots: 'kn' }
export const DISTANCE_LABELS: Record<DistanceUnit, string> = { km: 'km', miles: 'mi' }

// Get next unit in cycle
export function getNextUnit(currentUnit: AnyUnit, type: MetricType): string {
  let units: string[]
  switch (type) {
    case 'wind':
      units = WIND_UNITS
      break
    case 'temp':
      units = TEMP_UNITS
      break
    case 'precip':
      units = PRECIP_UNITS
      break
    case 'height':
      units = HEIGHT_UNITS
      break
    case 'distance':
      units = DISTANCE_UNITS
      break
    case 'pressure':
      units = PRESSURE_UNITS
      break
    default:
      return currentUnit
  }

  const currentIndex = units.indexOf(currentUnit)
  const nextIndex = (currentIndex + 1) % units.length
  return units[nextIndex]
}

// Wind conversion functions
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
  }

  // Convert from kph to target unit
  switch (to) {
    case 'kph':
      return kph
    case 'mph':
      return kph / 1.60934
    case 'knots':
      return kph / 1.852
  }
}

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

// Height conversion functions
export function convertHeight(value: number, from: HeightUnit, to: HeightUnit): number {
  if (from === to) return value

  if (from === 'm' && to === 'ft') {
    return value * 3.28084
  } else if (from === 'ft' && to === 'm') {
    return value / 3.28084
  }

  return value
}

// Distance conversion functions
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value
  return from === 'km' ? value * 0.621371 : value / 0.621371
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
      convertedValue = convertWind(value, sourceUnit as WindUnit, targetUnit as WindUnit)
      return formatWind(convertedValue, targetUnit as WindUnit, precision ?? 0)
    case 'temp':
      convertedValue = convertTemp(value, sourceUnit as TempUnit, targetUnit as TempUnit)
      return formatTemp(convertedValue, targetUnit as TempUnit, precision ?? 0)
    case 'precip':
      convertedValue = convertPrecip(value, sourceUnit as PrecipUnit, targetUnit as PrecipUnit)
      return formatPrecip(convertedValue, targetUnit as PrecipUnit, precision ?? 1)
    case 'height':
      convertedValue = convertHeight(value, sourceUnit as HeightUnit, targetUnit as HeightUnit)
      return formatHeight(convertedValue, targetUnit as HeightUnit, precision ?? 1)
    case 'distance':
      convertedValue = convertDistance(value, sourceUnit as DistanceUnit, targetUnit as DistanceUnit)
      return formatDistance(convertedValue, targetUnit as DistanceUnit, precision ?? 1)
    case 'pressure':
      convertedValue = convertPressure(value, sourceUnit as PressureUnit, targetUnit as PressureUnit)
      return formatPressure(convertedValue, targetUnit as PressureUnit, precision ?? 0)
    default:
      return `${value}`
  }
}
