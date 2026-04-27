// Canadian Hydrographic Service (CHS) IWLS API Integration
// Documentation: https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/swagger-ui/index.html

import { resolveStationForLocation } from './dfoStationRegistry'

export interface CHSStation {
  id: string
  code: string
  name: string
  latitude: number
  longitude: number
  type: string
  timezone: string
  datum?: string
}

export interface CHSWaterLevel {
  timestamp: number
  height: number // meters relative to chart datum
  type: 'observed' | 'predicted' | 'forecast'
  quality?: 'good' | 'fair' | 'poor'
}

export interface CHSTideEvent {
  timestamp: number
  height: number
  type: 'high' | 'low'
  level?: 'higher_high' | 'lower_high' | 'higher_low' | 'lower_low'
}

export interface CHSCurrent {
  timestamp: number
  speed: number // knots
  direction: number // degrees true
  type: 'flood' | 'ebb' | 'slack'
}

export interface CHSWaterData {
  station: CHSStation
  waterLevels: CHSWaterLevel[]
  tideEvents: CHSTideEvent[]
  currents?: CHSCurrent[]
  waterTemperature?: number // celsius
  currentHeight: number
  nextTide: CHSTideEvent
  previousTide: CHSTideEvent
  tidalRange: number
  isRising: boolean
  changeRate: number // meters per hour
  timeToNextTide: number // minutes
  currentSpeed?: number
  currentDirection?: number
  _tzCorrectionSec?: number // timezone correction offset for aligning with OpenMeteo timestamps
  stationCode?: string           // DFO station code (e.g. '07080')
  stationDistanceKm?: number     // Distance from query coordinates to station
  dataSource?: 'iwls' | 'stormglass' // Where tide data came from
}

// BC Fishing locations mapped to CHS station IDs
// Note: These are the actual MongoDB ObjectIDs from the CHS API, not the station codes
// Updated December 9, 2025 - All stations verified against CHS IWLS API
export const CHS_STATIONS: Record<string, { id: string; code: string; name: string }> = {
  'victoria-sidney': {
    id: '5cebf1df3d0f4a073c4bbd1e', // Victoria Harbour
    code: '07120',
    name: 'Victoria Harbour',
  },
  'sooke-port-renfrew': {
    id: '5cebf1df3d0f4a073c4bbd11', // Sooke Basin (VERIFIED)
    code: '07024',
    name: 'Sooke Basin',
  },
  tsawwassen: {
    id: '5cebf1e13d0f4a073c4bbf85', // Roberts Bank (nearest station)
    code: '07592',
    name: 'Roberts Bank',
  },
  vancouver: {
    id: '5cebf1e43d0f4a073c4bc404', // Kitsilano station
    code: '07707',
    name: 'Kitsilano',
  },
  'barkley-sound': {
    id: '5cebf1e23d0f4a073c4bc062', // Bamfield (VERIFIED)
    code: '08545',
    name: 'Bamfield',
  },
  'port-hardy': {
    id: '5cebf1de3d0f4a073c4bb9c7', // Port Hardy (VERIFIED)
    code: '08408',
    name: 'Port Hardy',
  },
  'campbell-river': {
    id: '5cebf1de3d0f4a073c4bb996', // Campbell River (VERIFIED - PERMANENT)
    code: '08074',
    name: 'Campbell River',
  },
  nanaimo: {
    id: '5cebf1de3d0f4a073c4bb96d', // Nanaimo Harbour (VERIFIED - PERMANENT)
    code: '07917',
    name: 'Nanaimo Harbour',
  },
  tofino: {
    id: '5cebf1e23d0f4a073c4bc07c', // Tofino (VERIFIED - PERMANENT)
    code: '08615',
    name: 'Tofino',
  },
  'prince-rupert': {
    id: '5cebf1e43d0f4a073c4bc469', // Prince Rupert RoRo
    code: '09346',
    name: 'Prince Rupert RoRo',
  },
  'haida-gwaii': {
    id: '5cebf1de3d0f4a073c4bba2d', // Rose Harbour
    code: '09713',
    name: 'Rose Harbour',
  },
  squamish: {
    id: '5cebf1e43d0f4a073c4bc404', // Kitsilano Vancouver (nearest)
    code: '07707',
    name: 'Kitsilano',
  },
  sechelt: {
    id: '5dd3064ee0fdc4b9b4be670a', // Roberts Creek (nearest to Sechelt)
    code: '07824',
    name: 'Roberts Creek',
  },
  'bella-bella': {
    id: '5cebf1e23d0f4a073c4bc0b7', // Bella Coola (nearest major station)
    code: '08937',
    name: 'Bella Coola',
  },
}

// All BC stations are in the Pacific timezone
const BC_TIMEZONE = 'America/Vancouver'

// Compute timezone correction offset (in seconds) so CHS UTC timestamps
// align with OpenMeteo's "browser-local-interpreted-location-local" convention.
// OpenMeteo returns local time strings without timezone suffix (e.g., "2026-01-27T05:20")
// which JavaScript's Date() interprets in the browser's timezone. CHS returns true UTC.
// This offset bridges the gap so tide lookups match regardless of browser timezone.
const computeTimezoneCorrection = (timezone: string, referenceDate: Date): number => {
  const localStr = referenceDate.toLocaleString('sv-SE', { timeZone: timezone })
  const localEpoch = new Date(localStr.replace(' ', 'T')).getTime()
  const utcEpoch = referenceDate.getTime()
  return (localEpoch - utcEpoch) / 1000
}

// CHS API configuration
const CHS_API_BASE = typeof window !== 'undefined'
  ? '/api/chs-tide' // Use proxy in browser
  : 'https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1' // Direct in SSR
const RATE_LIMIT_DELAY = 350 // ms between requests (respecting 3 req/sec limit)

// Cache for API responses
const responseCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Rate limiting queue
let lastRequestTime = 0

const rateLimitedFetch = async (url: string): Promise<Response> => {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest))
  }
  
  lastRequestTime = Date.now()
  
  // If using proxy, encode the endpoint path
  if (typeof window !== 'undefined' && url.includes('/api/chs-tide')) {
    return fetch(url)
  }
  
  return fetch(url)
}

// Fetch station metadata
export const fetchStationMetadata = async (stationId: string): Promise<CHSStation | null> => {
  const cacheKey = `station-${stationId}`
  const cached = responseCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    const endpoint = typeof window !== 'undefined' 
      ? `/api/chs-tide/stations/${stationId}`
      : `${CHS_API_BASE}/stations/${stationId}`
    const response = await rateLimitedFetch(endpoint)
    if (!response.ok) throw new Error(`Failed to fetch station: ${response.status}`)
    
    const data = await response.json()
    const station: CHSStation = {
      id: data.id,
      code: data.code,
      name: data.officialName || data.name,
      latitude: data.latitude,
      longitude: data.longitude,
      type: data.type,
      timezone: data.timeZone,
      datum: data.verticalDatum,
    }
    
    responseCache.set(cacheKey, { data: station, timestamp: Date.now() })
    return station
  } catch (error) {
    console.error('Error fetching CHS station metadata:', error)
    return null
  }
}

// Fetch water level predictions
export const fetchWaterLevels = async (
  stationId: string,
  startTime: Date,
  endTime: Date
): Promise<CHSWaterLevel[]> => {
  const cacheKey = `levels-${stationId}-${startTime.toISOString()}-${endTime.toISOString()}`
  const cached = responseCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    // Use the data endpoint with wlp time series for water level predictions
    const params = new URLSearchParams({
      'time-series-code': 'wlp',
      from: startTime.toISOString(),
      to: endTime.toISOString(),
    })
    
    const endpoint = typeof window !== 'undefined'
      ? `${CHS_API_BASE}/stations/${stationId}/data?${params}`
      : `${CHS_API_BASE}/stations/${stationId}/data?${params}`
    
    const response = await rateLimitedFetch(endpoint)
    
    if (!response.ok) throw new Error(`Failed to fetch water levels: ${response.status}`)
    
    const data = await response.json()
    const waterLevels: CHSWaterLevel[] = data.map((item: any) => ({
      timestamp: new Date(item.eventDate).getTime() / 1000,
      height: item.value,
      type: 'predicted',
      quality: item.qcFlagCode === '2' ? 'good' : 'fair',
    }))
    
    responseCache.set(cacheKey, { data: waterLevels, timestamp: Date.now() })
    return waterLevels
  } catch (error) {
    console.error('Error fetching CHS water levels:', error)
    return []
  }
}

/**
 * Fetch observed (actual) water levels from CHS IWLS API.
 * Uses time-series-code=wlo (observed) instead of wlp (predicted).
 * Falls back to predicted data if observed is unavailable.
 */
export const fetchObservedWaterLevels = async (
  stationId: string,
  startTime: Date,
  endTime: Date
): Promise<CHSWaterLevel[]> => {
  const cacheKey = `observed-${stationId}-${startTime.toISOString()}-${endTime.toISOString()}`
  const cached = responseCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    // Try observed water levels first (wlo = water level observed)
    const params = new URLSearchParams({
      'time-series-code': 'wlo',
      from: startTime.toISOString(),
      to: endTime.toISOString(),
    })

    const endpoint = `${CHS_API_BASE}/stations/${stationId}/data?${params}`
    const response = await rateLimitedFetch(endpoint)

    if (!response.ok) throw new Error(`Failed to fetch observed water levels: ${response.status}`)

    const data = await response.json()

    if (data && data.length > 0) {
      const waterLevels: CHSWaterLevel[] = data.map((item: any) => ({
        timestamp: new Date(item.eventDate).getTime() / 1000,
        height: item.value,
        type: 'observed' as const,
        quality: item.qcFlagCode === '2' ? 'good' : 'fair',
      }))

      responseCache.set(cacheKey, { data: waterLevels, timestamp: Date.now() })
      return waterLevels
    }

    // Fall back to predicted data if observed is empty
    console.warn(`No observed data for station ${stationId}, falling back to predicted`)
    return fetchWaterLevels(stationId, startTime, endTime)
  } catch (error) {
    console.error('Error fetching observed water levels, falling back to predicted:', error)
    return fetchWaterLevels(stationId, startTime, endTime)
  }
}

// Fetch tide events (high/low tides)
export const fetchTideEvents = async (
  stationId: string,
  date: Date
): Promise<CHSTideEvent[]> => {
  const cacheKey = `tides-${stationId}-${date.toDateString()}`
  const cached = responseCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    // Use the data endpoint with wlp-hilo time series for high/low tide predictions
    const startTime = new Date(date)
    startTime.setHours(0, 0, 0, 0)
    const endTime = new Date(date)
    endTime.setHours(23, 59, 59, 999)
    
    const params = new URLSearchParams({
      'time-series-code': 'wlp-hilo',
      from: startTime.toISOString(),
      to: endTime.toISOString(),
    })
    
    const endpoint = typeof window !== 'undefined'
      ? `${CHS_API_BASE}/stations/${stationId}/data?${params}`
      : `${CHS_API_BASE}/stations/${stationId}/data?${params}`
    
    const response = await rateLimitedFetch(endpoint)
    
    if (!response.ok) throw new Error(`Failed to fetch tide events: ${response.status}`)
    
    const data = await response.json()

    // wlp-hilo returns ONLY high/low tide events. Every point IS a tide event.
    // Determine type by comparing to adjacent values (higher than neighbors = high).
    const tideEvents: CHSTideEvent[] = classifyHiloEvents(data)

    responseCache.set(cacheKey, { data: tideEvents, timestamp: Date.now() })
    return tideEvents.sort((a, b) => a.timestamp - b.timestamp)
  } catch (error) {
    console.error('Error fetching CHS tide events:', error)
    return []
  }
}

// Fetch tide events for a date range (high/low tides)
export const fetchTideEventsRange = async (
  stationId: string,
  startTime: Date,
  endTime: Date
): Promise<CHSTideEvent[]> => {
  const cacheKey = `tides-range-${stationId}-${startTime.toISOString()}-${endTime.toISOString()}`
  const cached = responseCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    const params = new URLSearchParams({
      'time-series-code': 'wlp-hilo',
      from: startTime.toISOString(),
      to: endTime.toISOString(),
    })

    const endpoint = typeof window !== 'undefined'
      ? `${CHS_API_BASE}/stations/${stationId}/data?${params}`
      : `${CHS_API_BASE}/stations/${stationId}/data?${params}`

    const response = await rateLimitedFetch(endpoint)

    if (!response.ok) throw new Error(`Failed to fetch tide events: ${response.status}`)

    const data = await response.json()

    // wlp-hilo returns ONLY high/low tide events — reuse shared classifier
    const tideEvents: CHSTideEvent[] = classifyHiloEvents(data)

    responseCache.set(cacheKey, { data: tideEvents, timestamp: Date.now() })
    return tideEvents.sort((a, b) => a.timestamp - b.timestamp)
  } catch (error) {
    console.error('Error fetching CHS tide events range:', error)
    return []
  }
}

/**
 * Classify wlp-hilo data points as high or low tide events.
 * The wlp-hilo endpoint returns ONLY tide extremes, so every point is an event.
 * We determine type by comparing each point to its neighbors and validating
 * that events alternate (high-low-high-low).
 */
function classifyHiloEvents(data: any[]): CHSTideEvent[] {
  if (!data || data.length === 0) return []

  const events: CHSTideEvent[] = []

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    const value = item.value
    const timestamp = new Date(item.eventDate).getTime() / 1000

    let isHigh: boolean

    if (data.length === 1) {
      // Single event — can't determine type, default to high
      isHigh = true
    } else if (i === 0) {
      // First point: compare to next neighbor
      isHigh = value > data[i + 1].value
    } else if (i === data.length - 1) {
      // Last point: compare to previous neighbor
      isHigh = value > data[i - 1].value
    } else {
      // Middle point: compare to both neighbors
      isHigh = value > data[i - 1].value && value >= data[i + 1].value
    }

    events.push({
      timestamp,
      height: value,
      type: isHigh ? 'high' : 'low',
    })
  }

  // Validation: consecutive events should alternate types.
  // If we detect violations, trust neighbor comparison and fix.
  for (let i = 1; i < events.length; i++) {
    if (events[i].type === events[i - 1].type) {
      // Two consecutive same types — the one with smaller amplitude difference
      // from its neighbors is more likely misclassified. Flip the second one.
      events[i] = { ...events[i], type: events[i].type === 'high' ? 'low' : 'high' }
    }
  }

  return events
}

// Calculate current speeds from water level changes
const calculateCurrentFromWaterLevels = (
  waterLevels: CHSWaterLevel[],
  currentTime: number
): { speed: number; direction: number; type: 'flood' | 'ebb' | 'slack' } => {
  // Find water levels around current time
  const currentIndex = waterLevels.findIndex(wl => wl.timestamp >= currentTime)
  if (currentIndex <= 0 || currentIndex >= waterLevels.length - 1) {
    return { speed: 0, direction: 0, type: 'slack' }
  }

  const prev = waterLevels[currentIndex - 1]
  const next = waterLevels[currentIndex]
  const rate = (next.height - prev.height) / ((next.timestamp - prev.timestamp) / 3600) // m/hr

  // Convert to approximate current speed (rough estimation)
  // This is simplified - actual current depends on local bathymetry
  const speed = Math.abs(rate) * 2.5 // Convert to knots (approximate)
  const direction = rate > 0 ? 45 : 225 // Flood = NE, Ebb = SW (simplified)
  const type = Math.abs(rate) < 0.05 ? 'slack' : rate > 0 ? 'flood' : 'ebb'

  return { speed, direction, type }
}

// Main function to fetch comprehensive tide data
export const fetchCHSTideData = async (
  locationId: string,
  targetTime?: Date
): Promise<CHSWaterData | null> => {
  const stationInfo = CHS_STATIONS[locationId]
  if (!stationInfo) {
    console.warn(`No CHS station mapping for location: ${locationId}`)
    return null
  }

  try {
    const now = targetTime || new Date()
    const startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000) // 6 hours ago
    // CHS API limits water level queries to 7 days max, so split into two 7-day chunks
    const midTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000) // startTime + 7 days
    const endTime = new Date(midTime.getTime() + 7 * 24 * 60 * 60 * 1000) // midTime + 7 days

    // Fetch all data in parallel - water levels in two 7-day chunks, tide events for full 14 days
    const [station, waterLevelsWeek1, waterLevelsWeek2, tideEvents] = await Promise.all([
      fetchStationMetadata(stationInfo.id),
      fetchWaterLevels(stationInfo.id, startTime, midTime),
      fetchWaterLevels(stationInfo.id, midTime, endTime),
      fetchTideEventsRange(stationInfo.id, startTime, endTime),
    ])

    // Combine water levels from both weeks
    const waterLevels = [...waterLevelsWeek1, ...waterLevelsWeek2]

    if (!station || waterLevels.length === 0) {
      return null
    }

    const allTides = tideEvents
    const nowTimestamp = now.getTime() / 1000

    // Find current water level
    const currentWaterLevel = waterLevels.find(wl => wl.timestamp >= nowTimestamp) || waterLevels[waterLevels.length - 1]
    const currentHeight = currentWaterLevel.height

    // Find next and previous tides
    const nextTideIndex = allTides.findIndex(tide => tide.timestamp > nowTimestamp)
    const nextTide = allTides[nextTideIndex] || allTides[0]
    const previousTide = nextTideIndex > 0 ? allTides[nextTideIndex - 1] : allTides[allTides.length - 1]

    // Calculate tidal range for today
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const todayStartTs = todayStart.getTime() / 1000
    const todayEndTs = todayEnd.getTime() / 1000
    const todayTides = allTides.filter(t => t.timestamp >= todayStartTs && t.timestamp <= todayEndTs)
    const dayHighs = todayTides.filter(t => t.type === 'high').map(t => t.height)
    const dayLows = todayTides.filter(t => t.type === 'low').map(t => t.height)
    const tidalRange = dayHighs.length && dayLows.length
      ? Math.max(...dayHighs) - Math.min(...dayLows)
      : nextTide.height - previousTide.height

    // Determine if rising or falling
    const isRising = nextTide.type === 'high'

    // Calculate rate of change
    const timeDiff = (nextTide.timestamp - previousTide.timestamp) / 3600 // hours
    const heightDiff = Math.abs(nextTide.height - previousTide.height)
    const changeRate = heightDiff / timeDiff

    // Time to next tide
    const timeToNextTide = (nextTide.timestamp - nowTimestamp) / 60 // minutes

    // Calculate current speed and direction
    const current = calculateCurrentFromWaterLevels(waterLevels, nowTimestamp)

    // Compute timezone correction offset (seconds) so components can align
    // CHS UTC timestamps with OpenMeteo's "browser-local" timestamps.
    // OpenMeteo returns local-time strings (e.g., "2026-01-27T05:20" for PST)
    // that JavaScript parses in the browser's timezone. CHS returns true UTC.
    // Without this correction, tide lookups fail when browser ≠ location timezone.
    const tzCorrectionSec = computeTimezoneCorrection(BC_TIMEZONE, now)

    return {
      station,
      waterLevels,
      tideEvents: allTides,
      currentHeight,
      nextTide,
      previousTide,
      tidalRange,
      isRising,
      changeRate,
      timeToNextTide,
      currentSpeed: current.speed,
      currentDirection: current.direction,
      _tzCorrectionSec: tzCorrectionSec,
    }
  } catch (error) {
    console.error('Error fetching CHS tide data:', error)
    return null
  }
}

/**
 * Fetch CHS tide data using GPS coordinates and optional station code override.
 * Uses the DFO Station Registry to find the nearest station via Haversine distance.
 * This replaces the hardcoded locationId-based `fetchCHSTideData()`.
 */
export const fetchCHSTideDataByCoordinates = async (
  lat: number,
  lon: number,
  stationCodeOverride?: string,
  targetTime?: Date,
  maxRadiusKm = 20,
): Promise<CHSWaterData | null> => {
  try {
    const resolved = await resolveStationForLocation(lat, lon, stationCodeOverride, maxRadiusKm)

    if (!resolved) {
      console.warn(`No DFO station found within ${maxRadiusKm}km of (${lat}, ${lon})`)
      return null
    }

    const { station, distanceKm } = resolved
    const now = targetTime || new Date()
    const startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    const midTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000)
    const endTime = new Date(midTime.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [stationMeta, waterLevelsWeek1, waterLevelsWeek2, tideEvents] = await Promise.all([
      fetchStationMetadata(station.id),
      fetchWaterLevels(station.id, startTime, midTime),
      fetchWaterLevels(station.id, midTime, endTime),
      fetchTideEventsRange(station.id, startTime, endTime),
    ])

    const waterLevels = [...waterLevelsWeek1, ...waterLevelsWeek2]

    if (!stationMeta || waterLevels.length === 0) {
      return null
    }

    const allTides = tideEvents
    const nowTimestamp = now.getTime() / 1000

    const currentWaterLevel = waterLevels.find(wl => wl.timestamp >= nowTimestamp) || waterLevels[waterLevels.length - 1]
    const currentHeight = currentWaterLevel.height

    const nextTideIndex = allTides.findIndex(tide => tide.timestamp > nowTimestamp)
    const nextTide = allTides[nextTideIndex] || allTides[0]
    const previousTide = nextTideIndex > 0 ? allTides[nextTideIndex - 1] : allTides[allTides.length - 1]

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const todayStartTs = todayStart.getTime() / 1000
    const todayEndTs = todayEnd.getTime() / 1000
    const todayTides = allTides.filter(t => t.timestamp >= todayStartTs && t.timestamp <= todayEndTs)
    const dayHighs = todayTides.filter(t => t.type === 'high').map(t => t.height)
    const dayLows = todayTides.filter(t => t.type === 'low').map(t => t.height)
    const tidalRange = dayHighs.length && dayLows.length
      ? Math.max(...dayHighs) - Math.min(...dayLows)
      : nextTide.height - previousTide.height

    const isRising = nextTide.type === 'high'
    const timeDiff = (nextTide.timestamp - previousTide.timestamp) / 3600
    const heightDiff = Math.abs(nextTide.height - previousTide.height)
    const changeRate = heightDiff / timeDiff
    const timeToNextTide = (nextTide.timestamp - nowTimestamp) / 60
    const current = calculateCurrentFromWaterLevels(waterLevels, nowTimestamp)
    const tzCorrectionSec = computeTimezoneCorrection(BC_TIMEZONE, now)

    return {
      station: stationMeta,
      waterLevels,
      tideEvents: allTides,
      currentHeight,
      nextTide,
      previousTide,
      tidalRange,
      isRising,
      changeRate,
      timeToNextTide,
      currentSpeed: current.speed,
      currentDirection: current.direction,
      _tzCorrectionSec: tzCorrectionSec,
      stationCode: station.code,
      stationDistanceKm: distanceKm,
      dataSource: 'iwls',
    }
  } catch (error) {
    console.error('Error fetching CHS tide data by coordinates:', error)
    return null
  }
}

// Fallback to old tide API if CHS fails
export const fetchTideDataWithFallback = async (
  locationId: string,
  targetTime?: Date
): Promise<CHSWaterData | null> => {
  // Try CHS first
  const chsData = await fetchCHSTideData(locationId, targetTime)
  if (chsData) return chsData

  // If CHS fails, we could fall back to the old XTide API
  // For now, return null - the old API can be used as backup
  console.warn('CHS API failed, consider falling back to XTide')
  return null
}