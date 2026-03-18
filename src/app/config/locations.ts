/**
 * Fishing Locations Configuration
 *
 * Centralized location data for the ReelCaster application.
 * This file exports fishing locations, hotspots, and helper functions.
 */

export interface Coordinates {
  lat: number
  lon: number
}

export interface FishingHotspot {
  name: string
  coordinates: Coordinates
  /** Optional explicit DFO/CHS tide station code override (e.g. '07080' for Pedder Bay) */
  tideStationCode?: string
}

/** @deprecated Use FishingHotspot instead */
export type Hotspot = FishingHotspot

export interface FishingLocation {
  id: string
  name: string
  coordinates: Coordinates
  hotspots: FishingHotspot[]
  available: boolean
  /** DFO fishing area numbers for this location */
  dfoAreas: number[]
}

/**
 * All available fishing locations
 */
export const FISHING_LOCATIONS: FishingLocation[] = [
  {
    id: 'victoria-sidney',
    name: 'Victoria, Sidney',
    coordinates: { lat: 48.4113, lon: -123.398 },
    available: true,
    dfoAreas: [19],
    hotspots: [
      { name: 'Breakwater (Shore Fishing)', coordinates: { lat: 48.4098, lon: -123.3940 }, tideStationCode: '07120' },
      { name: 'Waterfront', coordinates: { lat: 48.4210, lon: -123.3710 }, tideStationCode: '07120' },
      { name: 'Ten Mile Point (Shore Fishing)', coordinates: { lat: 48.4580, lon: -123.2840 } },
      { name: 'Oak Bay', coordinates: { lat: 48.4180, lon: -123.3020 } },
      { name: 'Cadboro Bay', coordinates: { lat: 48.4530, lon: -123.2920 } },
      { name: 'Constance Bank', coordinates: { lat: 48.3650, lon: -123.4300 }, tideStationCode: '07090' },
      { name: 'Sidney', coordinates: { lat: 48.6480, lon: -123.3850 }, tideStationCode: '07108' },
      { name: 'Trial Island', coordinates: { lat: 48.3930, lon: -123.3050 } },
    ],
  },
  {
    id: 'sooke-port-renfrew',
    name: 'Sooke, Port Renfrew',
    coordinates: { lat: 48.3415, lon: -123.5507 },
    available: true,
    dfoAreas: [20],
    hotspots: [
      { name: 'Sooke Harbor', coordinates: { lat: 48.3722, lon: -123.7356 }, tideStationCode: '07024' },
      { name: 'East Sooke', coordinates: { lat: 48.35, lon: -123.6167 }, tideStationCode: '07030' },
      { name: 'Becher Bay', coordinates: { lat: 48.3167, lon: -123.6333 }, tideStationCode: '07030' },
      { name: 'Pedder Bay', coordinates: { lat: 48.3415, lon: -123.5507 }, tideStationCode: '07080' },
      { name: 'Church Rock', coordinates: { lat: 48.3, lon: -123.6 }, tideStationCode: '07030' },
      { name: 'Secretary Island', coordinates: { lat: 48.3500, lon: -123.7833 }, tideStationCode: '07024' },
    ],
  },
  {
    id: 'newport-outer-banks',
    name: 'Newport, Outer Banks',
    coordinates: { lat: 0, lon: 0 },
    available: false,
    dfoAreas: [],
    hotspots: [],
  },
]

/**
 * Default location used when no location is specified
 */
export const DEFAULT_LOCATION = FISHING_LOCATIONS[0]
export const DEFAULT_HOTSPOT = DEFAULT_LOCATION.hotspots[1] // Waterfront

/**
 * Default coordinates for Victoria Waterfront
 */
export const DEFAULT_COORDINATES: Coordinates = {
  lat: 48.4284,
  lon: -123.3656,
}

/**
 * Get a fishing location by its ID
 */
export function getLocationById(id: string): FishingLocation | undefined {
  return FISHING_LOCATIONS.find((loc) => loc.id === id)
}

/**
 * Get location by name
 */
export function getLocationByName(name: string): FishingLocation | undefined {
  return FISHING_LOCATIONS.find((loc) => loc.name === name)
}

/**
 * Get default location
 */
export function getDefaultLocation(): FishingLocation {
  return FISHING_LOCATIONS[0]
}

/**
 * Get DFO areas for a location name
 */
export function getDFOAreasForLocation(locationName: string): number[] {
  const location = getLocationByName(locationName)
  return location?.dfoAreas || [19, 20] // Default to both areas if unknown
}

/**
 * Get all hotspots across all locations
 */
export function getAllHotspots(): FishingHotspot[] {
  return FISHING_LOCATIONS.flatMap((loc) => loc.hotspots)
}

/**
 * Get hotspot by name within a specific location
 */
export function getHotspotByName(
  locationName: string,
  hotspotName: string
): FishingHotspot | undefined {
  const location = getLocationByName(locationName)
  return location?.hotspots.find((h) => h.name === hotspotName)
}

/**
 * Get all location names for dropdown options
 */
export function getLocationNames(): string[] {
  return FISHING_LOCATIONS.map((loc) => loc.name)
}

/**
 * Get hotspot names for a specific location
 */
export function getHotspotNames(locationName: string): string[] {
  return getLocationByName(locationName)?.hotspots.map((h) => h.name) || []
}

/**
 * Get available locations only
 */
export function getAvailableLocations(): FishingLocation[] {
  return FISHING_LOCATIONS.filter((loc) => loc.available)
}
