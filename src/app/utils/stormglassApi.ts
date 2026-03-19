/**
 * Stormglass API Client
 *
 * Fetches weather, tide, and astronomy data via the server-side proxy at /api/stormglass.
 * All requests go through the proxy which handles API key injection, GPS rounding,
 * caching, and rate-limit protection.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StormglassWeatherHour {
  time: string
  airTemperature?: { sg?: number; noaa?: number }
  waterTemperature?: { sg?: number; noaa?: number; meto?: number }
  windSpeed?: { sg?: number; noaa?: number }
  windDirection?: { sg?: number; noaa?: number }
  gust?: { sg?: number; noaa?: number }
  pressure?: { sg?: number }
  humidity?: { sg?: number }
  cloudCover?: { sg?: number }
  precipitation?: { sg?: number }
  visibility?: { sg?: number }
  waveHeight?: { sg?: number; noaa?: number }
  wavePeriod?: { sg?: number; noaa?: number }
  waveDirection?: { sg?: number; noaa?: number }
  swellHeight?: { sg?: number; noaa?: number }
  swellPeriod?: { sg?: number; noaa?: number }
  currentSpeed?: { sg?: number }
  currentDirection?: { sg?: number }
}

export interface StormglassWeatherResponse {
  hours: StormglassWeatherHour[]
  meta: { cost: number; dailyQuota: number; requestCount: number }
}

export interface StormglassTideExtreme {
  height: number
  time: string
  type: 'high' | 'low'
}

export interface StormglassTideExtremesResponse {
  data: StormglassTideExtreme[]
  meta: { cost: number }
}

export interface StormglassTideSeaLevel {
  height: number
  time: string
}

export interface StormglassTideSeaLevelResponse {
  data: StormglassTideSeaLevel[]
  meta: { cost: number }
}

export interface StormglassAstronomyPoint {
  time: string
  astronomicalDawn?: string
  astronomicalDusk?: string
  civilDawn?: string
  civilDusk?: string
  moonFraction?: number
  moonPhase?: { closest: { text: string; value: number }; current: { text: string; value: number } }
  moonrise?: string
  moonset?: string
  moonTransit?: string
  sunrise?: string
  sunset?: string
}

export interface StormglassAstronomyResponse {
  data: StormglassAstronomyPoint[]
  meta: { cost: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Best available value from a multi-source Stormglass field */
function bestValue(field?: Record<string, number>): number | undefined {
  if (!field) return undefined
  return field.sg ?? field.noaa ?? field.meto ?? Object.values(field)[0]
}

export { bestValue as sgBestValue }

const PROXY_BASE = '/api/stormglass'

// ─── Circuit Breaker ────────────────────────────────────────────────────────

/** Stops hammering Stormglass when it's returning errors (e.g. 503). */
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: 3,          // open after 3 consecutive failures
  cooldownMs: 5 * 60_000, // wait 5 minutes before retrying

  recordFailure() {
    this.failures++
    this.lastFailure = Date.now()
  },

  recordSuccess() {
    this.failures = 0
  },

  isOpen(): boolean {
    if (this.failures < this.threshold) return false
    // Allow a retry after cooldown
    if (Date.now() - this.lastFailure > this.cooldownMs) return false
    return true
  },
}

// ─── Weather ────────────────────────────────────────────────────────────────

const ALL_WEATHER_PARAMS = [
  'airTemperature',
  'waterTemperature',
  'windSpeed',
  'windDirection',
  'gust',
  'pressure',
  'humidity',
  'cloudCover',
  'precipitation',
  'visibility',
  'waveHeight',
  'wavePeriod',
  'waveDirection',
  'swellHeight',
  'swellPeriod',
  'currentSpeed',
  'currentDirection',
]

export async function fetchStormglassWeather(
  lat: number,
  lon: number,
  params: string[] = ALL_WEATHER_PARAMS,
  startDate?: Date,
  endDate?: Date,
): Promise<StormglassWeatherResponse | null> {
  if (circuitBreaker.isOpen()) return null
  try {
    const now = new Date()
    const start = startDate ?? now
    const end = endDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const qs = new URLSearchParams({
      lat: lat.toString(),
      lng: lon.toString(),
      params: params.join(','),
      start: start.toISOString(),
      end: end.toISOString(),
    })

    const response = await fetch(`${PROXY_BASE}/weather?${qs}`)
    if (!response.ok) {
      console.warn(`Stormglass weather returned ${response.status}`)
      circuitBreaker.recordFailure()
      return null
    }
    circuitBreaker.recordSuccess()
    return await response.json()
  } catch (error) {
    console.error('Error fetching Stormglass weather:', error)
    circuitBreaker.recordFailure()
    return null
  }
}

// ─── Tide Extremes ──────────────────────────────────────────────────────────

export async function fetchStormglassTideExtremes(
  lat: number,
  lon: number,
  startDate?: Date,
  endDate?: Date,
): Promise<StormglassTideExtremesResponse | null> {
  if (circuitBreaker.isOpen()) return null
  try {
    const now = new Date()
    const start = startDate ?? now
    const end = endDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const qs = new URLSearchParams({
      lat: lat.toString(),
      lng: lon.toString(),
      start: start.toISOString(),
      end: end.toISOString(),
    })

    const response = await fetch(`${PROXY_BASE}/tide/extremes?${qs}`)
    if (!response.ok) {
      circuitBreaker.recordFailure()
      return null
    }
    circuitBreaker.recordSuccess()
    return await response.json()
  } catch (error) {
    console.error('Error fetching Stormglass tide extremes:', error)
    circuitBreaker.recordFailure()
    return null
  }
}

// ─── Tide Sea Level ─────────────────────────────────────────────────────────

export async function fetchStormglassTideSeaLevel(
  lat: number,
  lon: number,
  startDate?: Date,
  endDate?: Date,
): Promise<StormglassTideSeaLevelResponse | null> {
  if (circuitBreaker.isOpen()) return null
  try {
    const now = new Date()
    const start = startDate ?? now
    const end = endDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const qs = new URLSearchParams({
      lat: lat.toString(),
      lng: lon.toString(),
      start: start.toISOString(),
      end: end.toISOString(),
    })

    const response = await fetch(`${PROXY_BASE}/tide/sea-level?${qs}`)
    if (!response.ok) {
      circuitBreaker.recordFailure()
      return null
    }
    circuitBreaker.recordSuccess()
    return await response.json()
  } catch (error) {
    console.error('Error fetching Stormglass tide sea level:', error)
    circuitBreaker.recordFailure()
    return null
  }
}

// ─── Astronomy ──────────────────────────────────────────────────────────────

export async function fetchStormglassAstronomy(
  lat: number,
  lon: number,
  startDate?: Date,
  endDate?: Date,
): Promise<StormglassAstronomyResponse | null> {
  if (circuitBreaker.isOpen()) return null
  try {
    const now = new Date()
    const start = startDate ?? now
    const end = endDate ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const qs = new URLSearchParams({
      lat: lat.toString(),
      lng: lon.toString(),
      start: start.toISOString(),
      end: end.toISOString(),
    })

    const response = await fetch(`${PROXY_BASE}/astronomy?${qs}`)
    if (!response.ok) {
      circuitBreaker.recordFailure()
      return null
    }
    circuitBreaker.recordSuccess()
    return await response.json()
  } catch (error) {
    console.error('Error fetching Stormglass astronomy:', error)
    circuitBreaker.recordFailure()
    return null
  }
}
