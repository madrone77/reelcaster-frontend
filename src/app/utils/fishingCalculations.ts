// Open-Meteo integration imports
import { ProcessedOpenMeteoData, OpenMeteo15MinData, getWeatherDescription } from './openMeteoApi'
import { CHSWaterData, CHSTideEvent } from './chsTideApi'
import { calculateSpeciesSpecificScore, ExtendedAlgorithmContext } from './speciesAlgorithms'
import { FishingReportData } from './chinookAlgorithmV2'

// Extended scoring context interface
export interface ExtendedScoringContext {
  latitude?: number
  longitude?: number
  locationName?: string
  pressureHistory?: number[]
  fishingReports?: FishingReportData
}

// Species-specific fishing profile system
export interface SpeciesProfile {
  id: string
  name: string
  // Temperature preferences (Celsius)
  optimalTempRange: [number, number]
  tolerableTempRange: [number, number]
  // Water temperature preferences (Celsius)
  optimalWaterTempRange: [number, number]
  tolerableWaterTempRange: [number, number]
  // Pressure sensitivity (how much pressure changes affect this species)
  pressureSensitivity: number // 0.5-2.0 multiplier
  // Wind preferences
  windTolerance: number // 0.5-2.0 - higher values = more wind tolerant
  // Tide importance (how much tides matter for this species)
  tideImportance: number // 0.5-2.0 multiplier for tide score
  // Current preferences
  currentSpeedPreference: number // 0.5-2.0 - preference for current speed
  optimalCurrentSpeed: [number, number] // knots
  // Time of day preferences
  dawnActivityBonus: number // 0.8-1.5 multiplier
  duskActivityBonus: number // 0.8-1.5 multiplier
  midDayActivity: number // 0.5-1.2 multiplier
  nightActivity: number // 0.3-1.0 multiplier
  // Weather pattern preferences
  lowLightPreference: number // 0.7-1.3 - preference for overcast vs sunny
  precipitationTolerance: number // 0.5-1.5 - tolerance for rain
  // Seasonal activity modifier
  seasonalPeaks: {
    spring: number // 0.5-1.5
    summer: number // 0.5-1.5
    fall: number // 0.5-1.5
    winter: number // 0.5-1.5
  }
}

// Species profiles based on Pacific Northwest fishing knowledge
export const SPECIES_PROFILES: { [key: string]: SpeciesProfile } = {
  'chinook-salmon': {
    id: 'chinook-salmon',
    name: 'Chinook Salmon',
    optimalTempRange: [8, 14],
    tolerableTempRange: [4, 18],
    optimalWaterTempRange: [7, 13],
    tolerableWaterTempRange: [4, 16],
    pressureSensitivity: 1.4, // Very sensitive to pressure changes
    windTolerance: 0.7, // Prefer calmer waters
    tideImportance: 1.6, // Highly tide-dependent
    currentSpeedPreference: 1.5, // Prefer moderate to strong currents
    optimalCurrentSpeed: [0.5, 2.0],
    dawnActivityBonus: 1.4,
    duskActivityBonus: 1.3,
    midDayActivity: 0.7,
    nightActivity: 0.4,
    lowLightPreference: 1.2, // Prefer overcast conditions
    precipitationTolerance: 1.1,
    seasonalPeaks: { spring: 1.3, summer: 1.4, fall: 1.2, winter: 0.6 },
  },
  'coho-salmon': {
    id: 'coho-salmon',
    name: 'Coho Salmon',
    optimalTempRange: [10, 16],
    tolerableTempRange: [6, 20],
    optimalWaterTempRange: [9, 15],
    tolerableWaterTempRange: [5, 18],
    pressureSensitivity: 1.2,
    windTolerance: 0.9, // More wind tolerant than Chinook
    tideImportance: 1.3,
    currentSpeedPreference: 1.3,
    optimalCurrentSpeed: [0.4, 1.8],
    dawnActivityBonus: 1.3,
    duskActivityBonus: 1.4,
    midDayActivity: 0.8,
    nightActivity: 0.5,
    lowLightPreference: 1.1,
    precipitationTolerance: 1.2,
    seasonalPeaks: { spring: 1.1, summer: 1.4, fall: 1.3, winter: 0.7 },
  },
  'chum-salmon': {
    id: 'chum-salmon',
    name: 'Chum Salmon',
    optimalTempRange: [8, 14],
    tolerableTempRange: [4, 18],
    optimalWaterTempRange: [7, 13],
    tolerableWaterTempRange: [4, 16],
    pressureSensitivity: 1.1,
    windTolerance: 1.0,
    tideImportance: 1.4,
    currentSpeedPreference: 1.2,
    optimalCurrentSpeed: [0.3, 1.5],
    dawnActivityBonus: 1.2,
    duskActivityBonus: 1.2,
    midDayActivity: 0.9,
    nightActivity: 0.6,
    lowLightPreference: 1.0,
    precipitationTolerance: 1.3,
    seasonalPeaks: { spring: 0.8, summer: 0.9, fall: 1.5, winter: 0.5 },
  },
  'pink-salmon': {
    id: 'pink-salmon',
    name: 'Pink Salmon',
    optimalTempRange: [10, 16],
    tolerableTempRange: [6, 20],
    optimalWaterTempRange: [9, 15],
    tolerableWaterTempRange: [5, 18],
    pressureSensitivity: 1.0,
    windTolerance: 1.1,
    tideImportance: 1.2,
    currentSpeedPreference: 1.1,
    optimalCurrentSpeed: [0.3, 1.4],
    dawnActivityBonus: 1.2,
    duskActivityBonus: 1.3,
    midDayActivity: 0.9,
    nightActivity: 0.7,
    lowLightPreference: 1.0,
    precipitationTolerance: 1.2,
    seasonalPeaks: { spring: 0.7, summer: 1.4, fall: 1.2, winter: 0.4 },
  },
  'sockeye-salmon': {
    id: 'sockeye-salmon',
    name: 'Sockeye Salmon',
    optimalTempRange: [8, 15],
    tolerableTempRange: [5, 18],
    optimalWaterTempRange: [7, 14],
    tolerableWaterTempRange: [4, 17],
    pressureSensitivity: 1.3,
    windTolerance: 0.8,
    tideImportance: 1.1, // Less tide-dependent than other salmon
    currentSpeedPreference: 1.0,
    optimalCurrentSpeed: [0.2, 1.2],
    dawnActivityBonus: 1.3,
    duskActivityBonus: 1.4,
    midDayActivity: 0.6,
    nightActivity: 0.4,
    lowLightPreference: 1.3,
    precipitationTolerance: 1.0,
    seasonalPeaks: { spring: 1.2, summer: 1.4, fall: 1.1, winter: 0.5 },
  },
  halibut: {
    id: 'halibut',
    name: 'Halibut',
    optimalTempRange: [6, 12],
    tolerableTempRange: [2, 16],
    optimalWaterTempRange: [5, 11],
    tolerableWaterTempRange: [2, 14],
    pressureSensitivity: 0.8, // Less pressure sensitive
    windTolerance: 1.2, // Can handle rougher conditions
    tideImportance: 1.8, // Very tide-dependent (bottom feeder)
    currentSpeedPreference: 1.6, // Strong preference for current
    optimalCurrentSpeed: [0.8, 2.5],
    dawnActivityBonus: 1.1,
    duskActivityBonus: 1.2,
    midDayActivity: 1.0, // Active throughout day
    nightActivity: 0.8,
    lowLightPreference: 0.9,
    precipitationTolerance: 1.4,
    seasonalPeaks: { spring: 1.2, summer: 1.4, fall: 1.1, winter: 0.8 },
  },
  lingcod: {
    id: 'lingcod',
    name: 'Lingcod',
    optimalTempRange: [8, 14],
    tolerableTempRange: [4, 18],
    optimalWaterTempRange: [7, 13],
    tolerableWaterTempRange: [4, 16],
    pressureSensitivity: 0.9,
    windTolerance: 1.3,
    tideImportance: 1.5, // Structure-oriented, tide-dependent
    currentSpeedPreference: 1.4,
    optimalCurrentSpeed: [0.5, 2.0],
    dawnActivityBonus: 1.2,
    duskActivityBonus: 1.3,
    midDayActivity: 0.9,
    nightActivity: 0.7,
    lowLightPreference: 1.1,
    precipitationTolerance: 1.3,
    seasonalPeaks: { spring: 1.3, summer: 1.2, fall: 1.1, winter: 1.0 },
  },
  rockfish: {
    id: 'rockfish',
    name: 'Rockfish',
    optimalTempRange: [8, 16],
    tolerableTempRange: [4, 20],
    optimalWaterTempRange: [7, 15],
    tolerableWaterTempRange: [4, 18],
    pressureSensitivity: 0.7, // Structure fish, less weather sensitive
    windTolerance: 1.4,
    tideImportance: 1.3,
    currentSpeedPreference: 0.8, // Less current dependent
    optimalCurrentSpeed: [0.1, 1.0],
    dawnActivityBonus: 1.1,
    duskActivityBonus: 1.2,
    midDayActivity: 1.0,
    nightActivity: 0.8,
    lowLightPreference: 0.9,
    precipitationTolerance: 1.4,
    seasonalPeaks: { spring: 1.2, summer: 1.3, fall: 1.2, winter: 0.9 },
  },
  greenling: {
    id: 'greenling',
    name: 'Greenling',
    optimalTempRange: [10, 18],
    tolerableTempRange: [6, 22],
    optimalWaterTempRange: [9, 17],
    tolerableWaterTempRange: [5, 20],
    pressureSensitivity: 0.8,
    windTolerance: 1.1,
    tideImportance: 1.2,
    currentSpeedPreference: 0.9,
    optimalCurrentSpeed: [0.2, 1.2],
    dawnActivityBonus: 1.2,
    duskActivityBonus: 1.2,
    midDayActivity: 1.0,
    nightActivity: 0.7,
    lowLightPreference: 0.9,
    precipitationTolerance: 1.3,
    seasonalPeaks: { spring: 1.1, summer: 1.3, fall: 1.2, winter: 0.8 },
  },
}

// Utility function to get species profile by name (fuzzy matching)
export const getSpeciesProfile = (speciesName: string | null): SpeciesProfile | null => {
  if (!speciesName) return null

  // Direct match by ID
  if (SPECIES_PROFILES[speciesName]) {
    return SPECIES_PROFILES[speciesName]
  }

  const normalizedName = speciesName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')

  // Try normalized name
  if (SPECIES_PROFILES[normalizedName]) {
    return SPECIES_PROFILES[normalizedName]
  }

  // Fuzzy matching
  for (const [key, profile] of Object.entries(SPECIES_PROFILES)) {
    if (
      profile.name.toLowerCase().includes(speciesName.toLowerCase()) ||
      speciesName.toLowerCase().includes(profile.name.toLowerCase()) ||
      key.includes(normalizedName.substring(0, 6)) ||
      normalizedName.includes(key.substring(0, 6))
    ) {
      return profile
    }
  }

  return null
}

// Get current season based on month
export const getCurrentSeason = (timestamp: number): keyof SpeciesProfile['seasonalPeaks'] => {
  const month = new Date(timestamp * 1000).getMonth() + 1 // 1-12
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

export interface FishingScore {
  total: number
  breakdown: {
    pressure: number
    pressureTrend: number
    wind: number
    temperature: number
    waterTemperature: number
    precipitation: number
    cloudCover: number
    timeOfDay: number
    visibility: number
    sunshine: number
    lightning: number
    atmospheric: number
    comfort: number
    tide: number
    currentSpeed: number
    currentAcceleration: number
    currentDirection: number
    species: number
  }
  // Species-specific fields
  isSafe?: boolean
  safetyWarnings?: string[]
  isInSeason?: boolean // New field to track if fishing is in legal season
  speciesFactors?: {
    [key: string]: {
      value: number | string
      weight: number
      score: number
      description?: string
    }
  } // Raw species-specific factors with actual weights
  // Confidence scoring (Phase 3)
  confidence?: import('./confidenceScoring').DataConfidence
  adjustedTotal?: number // Score after confidence regression toward neutral
}

export interface MinutelyForecast {
  startTime: number
  endTime: number
  score: FishingScore
  avgTemp: number
  conditions: string
  icon: string
  windSpeed: number
  precipitation: number
  pressure: number
}

export interface OpenMeteoDailyForecast {
  date: number
  dayName: string
  sunrise: number
  sunset: number
  minutelyScores: Array<{
    time: string
    timestamp: number
    score: number
    scoreDetails?: FishingScore  // Full score object with breakdown
    temp: number
    conditions: string
    icon: string
    windSpeed: number
    precipitation: number
    waveHeight?: number  // meters (from marine API)
  }>
  twoHourForecasts: MinutelyForecast[]
}

export const calculateOpenMeteoFishingScore = (
  minuteData: OpenMeteo15MinData,
  sunrise: number,
  sunset: number,
  tideData?: CHSWaterData | null,
  speciesName?: string | null,
  extendedContext?: ExtendedScoringContext | null,
): FishingScore => {
  // Try species-specific algorithm first if species is selected
  if (speciesName) {
    // Build extended algorithm context for V2 algorithms
    const algorithmContext: ExtendedAlgorithmContext = {
      sunrise,
      sunset,
      latitude: extendedContext?.latitude,
      longitude: extendedContext?.longitude,
      locationName: extendedContext?.locationName,
      pressureHistory: extendedContext?.pressureHistory,
      fishingReports: extendedContext?.fishingReports
    }

    const speciesResult = calculateSpeciesSpecificScore(
      speciesName,
      minuteData,
      tideData || undefined,
      algorithmContext
    )
    if (speciesResult) {
      // Check if out of season based on seasonality score
      const seasonalityScore = speciesResult.factors.seasonality?.score || 0.5
      const isInSeason = seasonalityScore > 0.1 // Consider out of season if score is very low

      // Convert species result to FishingScore format
      // Handle both V1 and V2 factor names
      return {
        total: Math.min(Math.max(speciesResult.total, 0), 10),
        breakdown: {
          // V2 uses 'pressureTrend', V1 uses 'pressure'
          pressure: (speciesResult.factors.pressureTrend?.score || speciesResult.factors.pressure?.score || 0.5) * 10,
          pressureTrend: 5, // Computed in general algorithm, neutral default for species
          // V2 uses 'seaState', V1 uses 'wind'
          wind: (speciesResult.factors.seaState?.score || speciesResult.factors.wind?.score || 0.5) * 10,
          temperature: speciesResult.factors.waterTemp?.score * 10 || speciesResult.factors.temperature?.score * 10 || 5,
          waterTemperature: speciesResult.factors.waterTemp?.score * 10 || 5,
          precipitation: speciesResult.factors.precipitation?.score * 10 || 5,
          cloudCover: 5, // Not in species algorithms
          timeOfDay: speciesResult.factors.lightTime?.score * 10 || 5,
          visibility: 5, // Not in species algorithms
          sunshine: 5, // Not in species algorithms
          lightning: 5, // Not in species algorithms
          atmospheric: 5, // Not in species algorithms
          comfort: 5, // Not in species algorithms
          // V2 uses 'tidalCurrent', V1 uses 'tidalRange' or 'slackTide'
          tide: (speciesResult.factors.tidalCurrent?.score || speciesResult.factors.tidalRange?.score || speciesResult.factors.slackTide?.score || 0.5) * 10,
          currentSpeed: (speciesResult.factors.tidalCurrent?.score || speciesResult.factors.currentFlow?.score || 0.5) * 10,
          currentAcceleration: 5, // Not in species algorithms
          currentDirection: 5, // Not separately tracked
          species: seasonalityScore * 10,
        },
        isSafe: speciesResult.isSafe,
        safetyWarnings: speciesResult.safetyWarnings,
        isInSeason: isInSeason,
        speciesFactors: speciesResult.factors // Pass through the raw species factors with actual weights
      }
    }
  }

  // Fall back to general algorithm if no species selected or species not found
  const speciesProfile = getSpeciesProfile(speciesName || null)
  const season = getCurrentSeason(minuteData.timestamp)

  // Enhanced algorithm with 13 factors including species-specific adjustments

  // Core Weather Factors - with species adjustments
  let pressureScore = calculatePressureScore(minuteData.pressure)

  // Pressure trend: compute 3-hour delta from pressure history
  let pressureTrendDelta = 0
  if (extendedContext?.pressureHistory && extendedContext.pressureHistory.length >= 12) {
    const hist = extendedContext.pressureHistory
    pressureTrendDelta = minuteData.pressure - hist[Math.max(0, hist.length - 12)]
  }
  const pressureTrendScore = calculatePressureTrendScore(pressureTrendDelta)
  let windScore = calculateEnhancedWindScore(
    minuteData.windSpeed / 3.6,
    minuteData.windGusts / 3.6,
    minuteData.windDirection,
  ) // 13%
  let temperatureScore = calculateTemperatureScore(minuteData.temp) // 11%
  let precipitationScore = calculatePrecipitationScoreFromMM(minuteData.precipitation) // 11%

  // Environmental Factors
  let cloudScore = calculateCloudScore(minuteData.cloudCover) // 6%
  const visibilityScore = calculateVisibilityScore(minuteData.visibility) // 6%
  let sunshineScore = calculateSunshineScore(minuteData.sunshineDuration) // 5%
  const atmosphericScore = calculateAtmosphericStabilityScore(minuteData.cape) // 4%

  // Safety & Comfort Factors
  const lightningScore = calculateLightningScore(minuteData.lightningPotential) // 5%
  const comfortScore = calculateComfortScore(
    minuteData.temp,
    minuteData.apparentTemp,
    minuteData.humidity,
    minuteData.dewPoint,
  ) // 4%

  // Timing & Tide Factors
  let timeScore = calculateTimeScore(minuteData.timestamp, sunrise, sunset) // 4%
  
  // Use enhanced tide scoring if CHS data is available
  let tideScore: number
  let waterTempScore = 5.0 // Default neutral score
  let currentSpeedScore = 5.0
  let currentAccelScore = 5.0
  let currentDirectionScore = 5.0

  if (tideData) {
    // CHS data available - use enhanced scoring
    tideScore = calculateEnhancedTideScore(tideData, speciesProfile)
    waterTempScore = calculateWaterTemperatureScore(tideData.waterTemperature, speciesProfile)
    const currentScores = calculateCurrentScore(tideData.currentSpeed, tideData.currentDirection, speciesProfile)
    currentSpeedScore = currentScores.speed
    currentDirectionScore = currentScores.direction

    // Current acceleration: compute speed 30 min ago vs now
    if (tideData.currentSpeed !== undefined) {
      const tideState30minAgo = calculateTideStateAtTimestamp(tideData, minuteData.timestamp - 1800)
      const speed30minAgo = tideState30minAgo?.currentSpeed ?? tideData.currentSpeed
      const accel = (tideData.currentSpeed - speed30minAgo) / 0.5 // kt/hr
      currentAccelScore = calculateCurrentAccelerationScore(accel)
    }
  } else {
    // No tide data - use default score
    tideScore = 5.0
  }

  // Species-specific adjustments
  let speciesAdjustment = 5.0 // Neutral base score

  if (speciesProfile) {
    // Temperature preference adjustment
    const temp = minuteData.temp
    const [optimalMin, optimalMax] = speciesProfile.optimalTempRange
    const [tolerableMin, tolerableMax] = speciesProfile.tolerableTempRange

    if (temp >= optimalMin && temp <= optimalMax) {
      temperatureScore *= 1.2 // Boost for optimal temp
    } else if (temp >= tolerableMin && temp <= tolerableMax) {
      temperatureScore *= 1.0 // No change for tolerable temp
    } else {
      temperatureScore *= 0.6 // Penalty for poor temp
    }

    // Apply species-specific multipliers
    pressureScore *= speciesProfile.pressureSensitivity
    windScore *= speciesProfile.windTolerance
    tideScore *= speciesProfile.tideImportance
    precipitationScore *= speciesProfile.precipitationTolerance

    // Time-of-day adjustments
    const hour = new Date(minuteData.timestamp * 1000).getHours()
    const sunriseHour = new Date(sunrise * 1000).getHours()
    const sunsetHour = new Date(sunset * 1000).getHours()

    // Dawn activity bonus (1 hour before/after sunrise)
    if (Math.abs(hour - sunriseHour) <= 1) {
      timeScore *= speciesProfile.dawnActivityBonus
    }
    // Dusk activity bonus (1 hour before/after sunset)
    else if (Math.abs(hour - sunsetHour) <= 1) {
      timeScore *= speciesProfile.duskActivityBonus
    }
    // Mid-day activity
    else if (hour >= 10 && hour <= 16) {
      timeScore *= speciesProfile.midDayActivity
    }
    // Night activity
    else if (hour <= 5 || hour >= 22) {
      timeScore *= speciesProfile.nightActivity
    }

    // Light preference (cloud cover interaction)
    const cloudPercent = minuteData.cloudCover
    if (cloudPercent >= 50) {
      // Overcast conditions
      cloudScore *= speciesProfile.lowLightPreference
      sunshineScore *= speciesProfile.lowLightPreference
    }

    // Seasonal adjustment
    const seasonalMultiplier = speciesProfile.seasonalPeaks[season]
    speciesAdjustment = 5.0 * seasonalMultiplier

    // Clamp individual scores to prevent extreme values
    pressureScore = Math.min(pressureScore, 12)
    windScore = Math.min(windScore, 12)
    temperatureScore = Math.min(temperatureScore, 12)
    precipitationScore = Math.min(precipitationScore, 12)
    cloudScore = Math.min(cloudScore, 12)
    sunshineScore = Math.min(sunshineScore, 12)
    timeScore = Math.min(timeScore, 12)
    tideScore = Math.min(tideScore, 12)
  }

  const breakdown = {
    pressure: Math.round(pressureScore * 100) / 100,
    pressureTrend: Math.round(pressureTrendScore * 100) / 100,
    wind: Math.round(windScore * 100) / 100,
    temperature: Math.round(temperatureScore * 100) / 100,
    waterTemperature: Math.round(waterTempScore * 100) / 100,
    precipitation: Math.round(precipitationScore * 100) / 100,
    cloudCover: Math.round(cloudScore * 100) / 100,
    timeOfDay: Math.round(timeScore * 100) / 100,
    visibility: Math.round(visibilityScore * 100) / 100,
    sunshine: Math.round(sunshineScore * 100) / 100,
    lightning: Math.round(lightningScore * 100) / 100,
    atmospheric: Math.round(atmosphericScore * 100) / 100,
    comfort: Math.round(comfortScore * 100) / 100,
    tide: Math.round(tideScore * 100) / 100,
    currentSpeed: Math.round(currentSpeedScore * 100) / 100,
    currentAcceleration: Math.round(currentAccelScore * 100) / 100,
    currentDirection: Math.round(currentDirectionScore * 100) / 100,
    species: Math.round(speciesAdjustment * 100) / 100,
  }

  // Adjusted weights to include new water factors when available
  let totalScore: number
  
  if (tideData && 'waterLevels' in tideData) {
    // With CHS data - 18 factors including pressure trend and current acceleration
    totalScore =
      pressureScore * 0.11 +
      pressureTrendScore * 0.08 +
      windScore * 0.11 +
      temperatureScore * 0.08 +
      waterTempScore * 0.04 +
      precipitationScore * 0.09 +
      tideScore * 0.07 +
      currentSpeedScore * 0.03 +
      currentAccelScore * 0.04 +
      currentDirectionScore * 0.02 +
      cloudScore * 0.05 +
      visibilityScore * 0.05 +
      sunshineScore * 0.05 +
      lightningScore * 0.04 +
      atmosphericScore * 0.04 +
      comfortScore * 0.03 +
      timeScore * 0.04 +
      speciesAdjustment * 0.03
    // Total = 1.00
  } else {
    // Without CHS data — 15 factors (marine factors zeroed)
    totalScore =
      pressureScore * 0.12 +
      pressureTrendScore * 0.08 +
      windScore * 0.12 +
      temperatureScore * 0.10 +
      precipitationScore * 0.10 +
      tideScore * 0.10 +
      cloudScore * 0.05 +
      visibilityScore * 0.05 +
      sunshineScore * 0.05 +
      lightningScore * 0.05 +
      atmosphericScore * 0.04 +
      comfortScore * 0.04 +
      timeScore * 0.04 +
      speciesAdjustment * 0.06
    // Total = 1.00 (marine factors: waterTemp, currentSpeed, currentAccel, currentDir = 0)
  }

  return {
    total: Math.min(Math.max(Math.round(totalScore * 100) / 100, 0), 10), // Clamp between 0-10
    breakdown,
  }
}

// Core scoring functions
export const calculatePressureScore = (pressure: number): number => {
  // Optimal pressure: 1015-1020 hPa, with smooth falloff
  const optimal = 1017.5
  const deviation = Math.abs(pressure - optimal)

  if (deviation <= 2.5) return 10 // Within 2.5 hPa of optimal
  if (deviation <= 5) return 10 - (deviation - 2.5) * 1.6 // 8.0-10.0
  if (deviation <= 10) return 8 - (deviation - 5) * 1.2 // 2.0-8.0
  if (deviation <= 20) return 2 - (deviation - 10) * 0.1 // 1.0-2.0
  return 1
}

export const calculateTemperatureScore = (temp: number): number => {
  // Optimal temperature: 10-14°C, with smooth falloff
  if (temp >= 10 && temp <= 14) return 10
  if (temp >= 6 && temp < 10) return 6 + (temp - 6) // 6.0-10.0
  if (temp > 14 && temp <= 18) return 10 - (temp - 14) // 6.0-10.0
  if (temp >= 2 && temp < 6) return 2 + (temp - 2) // 2.0-6.0
  if (temp > 18 && temp <= 22) return 6 - (temp - 18) * 1.25 // 1.0-6.0
  if (temp >= -2 && temp < 2) return 1 + (temp + 2) * 0.25 // 1.0-2.0
  if (temp > 22 && temp <= 30) return Math.max(1, 1 - (temp - 22) * 0.1) // 0.2-1.0
  return 0.2 // Extreme temperatures
}

export const calculateCloudScore = (cloudCover: number): number => {
  // Optimal cloud cover: 30-60% (some clouds for shade)
  if (cloudCover >= 30 && cloudCover <= 60) return 10
  if (cloudCover >= 15 && cloudCover < 30) return 6 + (cloudCover - 15) * 0.27 // 6.0-10.0
  if (cloudCover > 60 && cloudCover <= 75) return 10 - (cloudCover - 60) * 0.2 // 7.0-10.0
  if (cloudCover >= 5 && cloudCover < 15) return 3 + (cloudCover - 5) * 0.3 // 3.0-6.0
  if (cloudCover > 75 && cloudCover <= 90) return 7 - (cloudCover - 75) * 0.27 // 3.0-7.0
  if (cloudCover < 5) return 2 + cloudCover * 0.2 // 2.0-3.0
  return 3 - (cloudCover - 90) * 0.2 // 1.0-3.0 for >90%
}

export const calculateTimeScore = (timestamp: number, sunrise: number, sunset: number): number => {
  const date = new Date(timestamp * 1000)
  const hour = date.getHours() + date.getMinutes() / 60 // More precise timing
  const sunriseHour = new Date(sunrise * 1000).getHours() + new Date(sunrise * 1000).getMinutes() / 60
  const sunsetHour = new Date(sunset * 1000).getHours() + new Date(sunset * 1000).getMinutes() / 60

  // Calculate time difference from sunrise and sunset
  const sunriseDiff = Math.abs(hour - sunriseHour)
  const sunsetDiff = Math.abs(hour - sunsetHour)

  // Dawn period (peak: 30 min before to 1 hour after sunrise)
  if (sunriseDiff <= 1.5) {
    if (sunriseDiff <= 0.5) return 10 // Peak dawn
    return 10 - (sunriseDiff - 0.5) * 2 // 8.0-10.0
  }

  // Dusk period (peak: 1 hour before to 30 min after sunset)
  if (sunsetDiff <= 1.5) {
    if (sunsetDiff <= 0.5) return 10 // Peak dusk
    return 10 - (sunsetDiff - 0.5) * 2 // 8.0-10.0
  }

  // Early morning secondary peak
  if (hour >= 6 && hour <= 9) return 5 + (9 - Math.abs(hour - 7.5)) * 0.8 // 5.8-6.6

  // Evening secondary peak
  if (hour >= 17 && hour <= 20) return 5 + (3 - Math.abs(hour - 18.5)) * 0.8 // 5.6-6.6

  // Mid-day (moderate)
  if (hour >= 10 && hour <= 16) return 3 + Math.cos(((hour - 13) * Math.PI) / 6) // 3.0-4.0

  // Night and very early morning (poor)
  if (hour >= 22 || hour <= 5) return 1 + Math.sin((hour * Math.PI) / 12) * 0.5 // 0.5-1.5

  return 2.5 // Transition times
}

export const calculatePrecipitationScoreFromMM = (precipitationMM: number): number => {
  // More continuous precipitation scoring
  if (precipitationMM <= 0.1) return 10 // Essentially no rain
  if (precipitationMM <= 0.5) return 10 - (precipitationMM - 0.1) * 5 // 8.0-10.0
  if (precipitationMM <= 1.0) return 8 - (precipitationMM - 0.5) * 2 // 7.0-8.0
  if (precipitationMM <= 2.5) return 7 - (precipitationMM - 1.0) * 1.33 // 5.0-7.0
  if (precipitationMM <= 5.0) return 5 - (precipitationMM - 2.5) * 1.2 // 2.0-5.0
  if (precipitationMM <= 10.0) return 2 - (precipitationMM - 5.0) * 0.2 // 1.0-2.0
  return Math.max(0.2, 1 - (precipitationMM - 10) * 0.05) // 0.2-1.0
}

// Enhanced scoring functions for Open-Meteo parameters
export const calculateVisibilityScore = (visibility: number): number => {
  // Visibility in meters - crucial for fishing success and safety
  if (visibility >= 10000) return 10 // Excellent visibility (10km+)
  if (visibility >= 5000) return 9 // Very good visibility
  if (visibility >= 2000) return 7 // Good visibility
  if (visibility >= 1000) return 5 // Moderate visibility
  if (visibility >= 500) return 3 // Poor visibility
  return 1 // Very poor visibility
}

export const calculateSunshineScore = (sunshineDuration: number): number => {
  // Sunshine duration in seconds for 15-minute period (900 seconds max)
  const sunshinePercent = (sunshineDuration / 900) * 100

  if (sunshinePercent >= 75) return 10 // Mostly sunny
  if (sunshinePercent >= 50) return 9 // Partly sunny
  if (sunshinePercent >= 25) return 7 // Some sun
  if (sunshinePercent >= 10) return 6 // Little sun
  return 5 // Overcast/cloudy
}

export const calculateLightningScore = (lightningPotential: number): number => {
  // Lightning potential in J/kg - safety critical factor
  if (lightningPotential <= 100) return 10 // Very low risk
  if (lightningPotential <= 500) return 8 // Low risk
  if (lightningPotential <= 1000) return 6 // Moderate risk
  if (lightningPotential <= 2000) return 3 // High risk - caution
  return 1 // Very high risk - dangerous
}

export const calculateAtmosphericStabilityScore = (cape: number): number => {
  // CAPE (Convective Available Potential Energy) in J/kg
  // Lower CAPE = more stable conditions = better fishing
  if (cape <= 500) return 10 // Very stable
  if (cape <= 1000) return 8 // Stable
  if (cape <= 2000) return 6 // Moderately stable
  if (cape <= 3000) return 4 // Unstable
  return 2 // Very unstable
}

export const calculateComfortScore = (
  temp: number,
  apparentTemp: number,
  humidity: number,
  dewPoint: number,
): number => {
  // Comfort index based on multiple factors
  let score = 10

  // Temperature comfort (apparent temperature is more accurate)
  const tempDiff = Math.abs(apparentTemp - 12) // 12°C is comfortable for BC fishing
  if (tempDiff <= 4) score = 10
  else if (tempDiff <= 8) score = 8
  else if (tempDiff <= 12) score = 6
  else if (tempDiff <= 16) score = 4
  else score = 2

  // Humidity comfort (60-70% is ideal)
  if (humidity >= 40 && humidity <= 80) score *= 1.0
  else if (humidity >= 30 && humidity <= 90) score *= 0.9
  else score *= 0.7

  // Dew point comfort (below 15°C is comfortable)
  if (dewPoint <= 10) score *= 1.0
  else if (dewPoint <= 15) score *= 0.9
  else if (dewPoint <= 20) score *= 0.8
  else score *= 0.6

  return Math.min(Math.round(score), 10)
}

export const calculateEnhancedWindScore = (windSpeed: number, windGusts: number, windDirection: number): number => {
  // Base wind speed scoring (m/s) - more continuous scoring
  const effectiveWind = Math.max(windSpeed, windGusts * 0.7) // Weight gusts at 70%

  let score: number
  if (effectiveWind <= 1) score = 10 // Very light winds
  else if (effectiveWind <= 3) score = 10 - (effectiveWind - 1) * 0.5 // 9.0-10.0
  else if (effectiveWind <= 6) score = 9 - (effectiveWind - 3) * 0.67 // 7.0-9.0
  else if (effectiveWind <= 10) score = 7 - (effectiveWind - 6) * 0.5 // 5.0-7.0
  else if (effectiveWind <= 15) score = 5 - (effectiveWind - 10) * 0.4 // 3.0-5.0
  else if (effectiveWind <= 20) score = 3 - (effectiveWind - 15) * 0.3 // 1.5-3.0
  else score = Math.max(0.5, 1.5 - (effectiveWind - 20) * 0.1) // 0.5-1.5

  // Gust penalty - more nuanced
  const gustFactor = windGusts / Math.max(windSpeed, 0.1)
  if (gustFactor > 3) score *= 0.7 // Very gusty
  else if (gustFactor > 2) score *= 0.8 // High gust ratio
  else if (gustFactor > 1.5) score *= 0.9 // Moderate gusts

  // Wind direction bonus (but keep within bounds)
  let directionBonus = 1.0
  if (windDirection >= 45 && windDirection <= 135) directionBonus = 1.05 // Small easterly bonus
  else if (windDirection >= 270 || windDirection <= 45) directionBonus = 0.95 // Slight westerly penalty

  return Math.min(score * directionBonus, 10)
}

// Pressure trend scoring — falling pressure triggers feeding
export const calculatePressureTrendScore = (delta3hr: number): number => {
  // delta3hr: pressure change over 3 hours in hPa (negative = falling)
  // Falling pressure is good for fishing (fish feed more aggressively)
  if (delta3hr <= -4) return 10    // Rapid fall — peak feeding trigger
  if (delta3hr <= -2) return 9     // Falling — very good
  if (delta3hr <= -0.5) return 7   // Slightly falling — good
  if (delta3hr <= 0.5) return 5    // Stable — neutral
  if (delta3hr <= 2) return 3      // Rising — below average
  if (delta3hr <= 4) return 1      // Rapid rise — worst
  return 1
}

// Current acceleration scoring — rate of change in current speed
export const calculateCurrentAccelerationScore = (accelKtPerHr: number): number => {
  // accelKtPerHr: change in current speed (kt/hr) over 30 min
  // Positive = accelerating (baitfish sweep), threshold 0.3+ kt/hr (NOAA CO-OPS)
  const absAccel = Math.abs(accelKtPerHr)
  if (absAccel < 0.1) return 3     // Stagnant — no change
  if (absAccel < 0.3) return 5     // Slight change
  if (absAccel < 0.5) return 8     // NOAA threshold — good trigger
  if (absAccel < 0.8) return 10    // Strong acceleration — peak
  return 9                          // Very strong (diminishing returns)
}

// New scoring functions for water temperature and currents
export const calculateWaterTemperatureScore = (waterTemp: number | undefined, speciesProfile?: SpeciesProfile | null): number => {
  // If no water temperature data, return neutral score
  if (waterTemp === undefined) return 5.0
  
  // Default scoring (if no species profile)
  if (!speciesProfile) {
    if (waterTemp >= 8 && waterTemp <= 14) return 10
    if (waterTemp >= 6 && waterTemp < 8) return 7 + (waterTemp - 6) * 1.5
    if (waterTemp > 14 && waterTemp <= 16) return 10 - (waterTemp - 14) * 1.5
    if (waterTemp >= 4 && waterTemp < 6) return 3 + (waterTemp - 4) * 2
    if (waterTemp > 16 && waterTemp <= 20) return 7 - (waterTemp - 16) * 1.25
    return 2 // Extreme temperatures
  }
  
  // Species-specific scoring
  const [optimalMin, optimalMax] = speciesProfile.optimalWaterTempRange
  const [tolerableMin, tolerableMax] = speciesProfile.tolerableWaterTempRange
  
  if (waterTemp >= optimalMin && waterTemp <= optimalMax) {
    // Perfect temperature range
    const midPoint = (optimalMin + optimalMax) / 2
    const deviation = Math.abs(waterTemp - midPoint)
    const range = (optimalMax - optimalMin) / 2
    return 10 - (deviation / range) * 2 // 8-10 score in optimal range
  }
  
  if (waterTemp >= tolerableMin && waterTemp <= tolerableMax) {
    // Tolerable range
    if (waterTemp < optimalMin) {
      const score = 3 + ((waterTemp - tolerableMin) / (optimalMin - tolerableMin)) * 5
      return Math.max(3, Math.min(8, score))
    } else {
      const score = 8 - ((waterTemp - optimalMax) / (tolerableMax - optimalMax)) * 5
      return Math.max(3, Math.min(8, score))
    }
  }
  
  // Outside tolerable range
  return 1
}

export const calculateCurrentScore = (
  currentSpeed: number | undefined,
  currentDirection: number | undefined,
  speciesProfile?: SpeciesProfile | null
): { speed: number; direction: number } => {
  // Default scores if no current data
  if (currentSpeed === undefined) return { speed: 5.0, direction: 5.0 }
  
  let speedScore = 5.0
  let directionScore = 5.0
  
  // Calculate speed score
  if (!speciesProfile) {
    // Default scoring
    if (currentSpeed <= 0.2) speedScore = 3 // Too slow
    else if (currentSpeed <= 0.5) speedScore = 6
    else if (currentSpeed <= 1.5) speedScore = 9 // Optimal range
    else if (currentSpeed <= 2.5) speedScore = 7
    else speedScore = 4 // Too fast
  } else {
    // Species-specific scoring
    const [optimalMin, optimalMax] = speciesProfile.optimalCurrentSpeed
    
    if (currentSpeed >= optimalMin && currentSpeed <= optimalMax) {
      speedScore = 10
    } else if (currentSpeed < optimalMin) {
      speedScore = 3 + (currentSpeed / optimalMin) * 5
    } else {
      speedScore = Math.max(2, 10 - (currentSpeed - optimalMax) * 2)
    }
    
    // Apply species preference multiplier
    speedScore *= speciesProfile.currentSpeedPreference
  }
  
  // Calculate direction score (simplified - could be enhanced with local bathymetry)
  if (currentDirection !== undefined) {
    // Favor currents that bring baitfish (NE flood and SW ebb in BC)
    if ((currentDirection >= 30 && currentDirection <= 60) || 
        (currentDirection >= 210 && currentDirection <= 240)) {
      directionScore = 8
    } else if ((currentDirection >= 0 && currentDirection <= 90) || 
               (currentDirection >= 180 && currentDirection <= 270)) {
      directionScore = 6
    } else {
      directionScore = 4
    }
  }
  
  return {
    speed: Math.min(10, speedScore),
    direction: Math.min(10, directionScore)
  }
}


/**
 * Compute tide state (timeToNextTide, isRising, changeRate, etc.) at a specific timestamp.
 * This replaces the "now" snapshot so each 15-min scoring slot uses correct tide data.
 */
export interface TideStateAtTime {
  currentHeight: number
  nextTide: CHSTideEvent
  previousTide: CHSTideEvent
  tidalRange: number
  isRising: boolean
  changeRate: number    // meters per hour
  timeToNextTide: number // minutes
  currentSpeed?: number
  currentDirection?: number
}

export const calculateTideStateAtTimestamp = (
  tideData: CHSWaterData,
  targetTimestamp: number, // unix seconds
): TideStateAtTime | null => {
  const { waterLevels, tideEvents } = tideData
  if (!waterLevels.length || !tideEvents.length) return null

  // Binary search for water level height at target time
  let currentHeight: number
  const wlIdx = waterLevels.findIndex(wl => wl.timestamp >= targetTimestamp)
  if (wlIdx === -1) {
    // Target is after all data — use last known
    currentHeight = waterLevels[waterLevels.length - 1].height
  } else if (wlIdx === 0 || waterLevels[wlIdx].timestamp === targetTimestamp) {
    currentHeight = waterLevels[wlIdx].height
  } else {
    // Linearly interpolate between the two surrounding points
    const before = waterLevels[wlIdx - 1]
    const after = waterLevels[wlIdx]
    const frac = (targetTimestamp - before.timestamp) / (after.timestamp - before.timestamp)
    currentHeight = before.height + frac * (after.height - before.height)
  }

  // Find next and previous tide events relative to target
  const nextTideIndex = tideEvents.findIndex(tide => tide.timestamp > targetTimestamp)
  const nextTide = nextTideIndex >= 0 ? tideEvents[nextTideIndex] : tideEvents[tideEvents.length - 1]
  const previousTide = nextTideIndex > 0
    ? tideEvents[nextTideIndex - 1]
    : tideEvents[0]

  // Tidal range from events on the same day
  const dayStart = targetTimestamp - (targetTimestamp % 86400)
  const dayEnd = dayStart + 86400
  const dayTides = tideEvents.filter(t => t.timestamp >= dayStart && t.timestamp < dayEnd)
  const dayHighs = dayTides.filter(t => t.type === 'high').map(t => t.height)
  const dayLows = dayTides.filter(t => t.type === 'low').map(t => t.height)
  const tidalRange = dayHighs.length && dayLows.length
    ? Math.max(...dayHighs) - Math.min(...dayLows)
    : Math.abs(nextTide.height - previousTide.height)

  const isRising = nextTide.type === 'high'
  const timeDiffHours = (nextTide.timestamp - previousTide.timestamp) / 3600
  const heightDiff = Math.abs(nextTide.height - previousTide.height)
  const changeRate = timeDiffHours > 0 ? heightDiff / timeDiffHours : 0
  const timeToNextTide = (nextTide.timestamp - targetTimestamp) / 60 // minutes

  // Estimate current speed from water level derivative near target time
  let currentSpeed: number | undefined
  let currentDirection: number | undefined
  if (wlIdx > 0 && wlIdx < waterLevels.length) {
    const before = waterLevels[Math.max(0, wlIdx - 1)]
    const after = waterLevels[wlIdx]
    const rate = (after.height - before.height) / ((after.timestamp - before.timestamp) / 3600)
    currentSpeed = Math.abs(rate) * 2.5
    currentDirection = rate > 0 ? 45 : 225
  }

  return {
    currentHeight,
    nextTide,
    previousTide,
    tidalRange,
    isRising,
    changeRate,
    timeToNextTide,
    currentSpeed,
    currentDirection,
  }
}

/**
 * Create a CHSWaterData overlay with tide state computed at a specific timestamp.
 * The waterLevels and tideEvents arrays are shared (not copied) for efficiency.
 */
export const createTideDataAtTimestamp = (
  baseTideData: CHSWaterData,
  targetTimestamp: number,
): CHSWaterData | null => {
  const state = calculateTideStateAtTimestamp(baseTideData, targetTimestamp)
  if (!state) return null

  return {
    ...baseTideData,
    currentHeight: state.currentHeight,
    nextTide: state.nextTide,
    previousTide: state.previousTide,
    tidalRange: state.tidalRange,
    isRising: state.isRising,
    changeRate: state.changeRate,
    timeToNextTide: state.timeToNextTide,
    currentSpeed: state.currentSpeed ?? baseTideData.currentSpeed,
    currentDirection: state.currentDirection ?? baseTideData.currentDirection,
  }
}

// Enhanced tide scoring with CHS data
export const calculateEnhancedTideScore = (
  chsData: CHSWaterData | null,
  speciesProfile?: SpeciesProfile | null
): number => {
  if (!chsData) return 5.0
  
  // Base tide movement score
  const timeToChangeHours = chsData.timeToNextTide / 60
  let baseScore = 5.0
  
  if (timeToChangeHours <= 2) {
    baseScore = 10 - timeToChangeHours * 2.5
  } else if (timeToChangeHours <= 4) {
    baseScore = 5 - (timeToChangeHours - 2) * 1.5
  } else {
    baseScore = 2 - Math.min((timeToChangeHours - 4) * 0.5, 1.5)
  }
  
  // Apply bonuses
  const risingBonus = chsData.isRising ? 1.2 : 1.0
  const rangeBonus = chsData.tidalRange > 3.0 ? 1.1 : 1.0
  const rateBonus = chsData.changeRate > 0.5 ? 1.1 : 1.0
  
  // Current speed bonus (if available)
  const currentBonus = chsData.currentSpeed && chsData.currentSpeed > 0.5 ? 1.1 : 1.0
  
  let finalScore = baseScore * risingBonus * rangeBonus * rateBonus * currentBonus
  
  // Apply species-specific tide importance
  if (speciesProfile) {
    finalScore *= speciesProfile.tideImportance
  }
  
  return Math.min(finalScore, 10)
}

export const generateOpenMeteoDailyForecasts = (
  openMeteoData: ProcessedOpenMeteoData,
  tideData?: CHSWaterData | null,
  speciesName?: string | null,
  extendedContext?: ExtendedScoringContext | null,
): OpenMeteoDailyForecast[] => {
  const dailyForecasts: OpenMeteoDailyForecast[] = []

  console.log('generateOpenMeteoDailyForecasts - Input data:', {
    minutely15Count: openMeteoData.minutely15.length,
    dailyCount: openMeteoData.daily.length,
    firstMinutely: openMeteoData.minutely15[0]?.time,
    lastMinutely: openMeteoData.minutely15[openMeteoData.minutely15.length - 1]?.time,
  })

  const minutelyByDay: { [key: string]: OpenMeteo15MinData[] } = {}

  openMeteoData.minutely15.forEach(minuteData => {
    const date = new Date(minuteData.timestamp * 1000)
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

    if (!minutelyByDay[dayKey]) {
      minutelyByDay[dayKey] = []
    }
    minutelyByDay[dayKey].push(minuteData)
  })

  const dayKeys = Object.keys(minutelyByDay).sort()

  const maxDays = Math.min(dayKeys.length - 1, 14)
  dayKeys.slice(1, maxDays + 1).forEach((dayKey, index) => {
    const dayIndex = index + 1
    const dayMinutely = minutelyByDay[dayKey]
    const dayData = openMeteoData.daily[dayIndex]

    if (!dayData || !dayMinutely || dayMinutely.length === 0) {
      console.log(`Skipping Open-Meteo day ${dayIndex} - missing data`)
      return
    }

    const sunriseTimestamp = new Date(dayData.sunrise).getTime() / 1000
    const sunsetTimestamp = new Date(dayData.sunset).getTime() / 1000

    console.log(`Processing Open-Meteo day ${dayIndex}:`, {
      dayKey,
      date: dayData.date,
      minutelyCount: dayMinutely.length,
      sunrise: dayData.sunrise,
      sunset: dayData.sunset,
    })

    // Build pressure history for this day (last 24 readings = 6 hours of 15-min data)
    const currentDayPressureHistory = dayMinutely.slice(0, 24).map(d => d.pressure)

    // Create extended context for this day
    const dayExtendedContext: ExtendedScoringContext = {
      ...extendedContext,
      pressureHistory: currentDayPressureHistory,
      latitude: extendedContext?.latitude ?? openMeteoData.location.latitude,
      longitude: extendedContext?.longitude ?? openMeteoData.location.longitude,
    }

    // Generate 15-minute scores
    const minutelyScores = dayMinutely.map((minuteData, idx) => {
      const weather = getWeatherDescription(minuteData.weatherCode)
      // Build pressure history up to this point (last 24 readings before current)
      const historicalPressure = idx >= 24
        ? dayMinutely.slice(idx - 24, idx).map(d => d.pressure)
        : dayMinutely.slice(0, idx).map(d => d.pressure)

      const contextForThisMinute = {
        ...dayExtendedContext,
        pressureHistory: historicalPressure.length > 0 ? historicalPressure : undefined
      }

      // Compute per-timestamp tide state so each 15-min slot gets correct
      // timeToNextTide, isRising, changeRate (fixes static tide scoring bug)
      const tideForThisSlot = tideData
        ? createTideDataAtTimestamp(tideData, minuteData.timestamp)
        : null

      const fullScore = calculateOpenMeteoFishingScore(minuteData, sunriseTimestamp, sunsetTimestamp, tideForThisSlot ?? tideData, speciesName, contextForThisMinute)
      return {
        time: minuteData.time,
        timestamp: minuteData.timestamp,
        score: fullScore.total,
        scoreDetails: fullScore,  // Store full score object with breakdown
        temp: minuteData.temp,
        conditions: weather.description,
        icon: weather.icon,
        windSpeed: minuteData.windSpeed,
        precipitation: minuteData.precipitation,
        waveHeight: minuteData.waveHeight,  // From marine API
      }
    })

    // Generate 2-hour forecasts (average every 8 x 15-minute periods)
    const twoHourForecasts: MinutelyForecast[] = []
    for (let i = 0; i < dayMinutely.length; i += 8) {
      // Get 8 consecutive 15-minute periods (2 hours total)
      const segments = dayMinutely.slice(i, i + 8)

      if (segments.length >= 4) {
        // Need at least 4 segments (1 hour) to create a forecast
        const firstSegment = segments[0]
        const lastSegment = segments[segments.length - 1]

        // Calculate averages across all segments
        const avgTemp = segments.reduce((sum, seg) => sum + seg.temp, 0) / segments.length
        const avgHumidity = segments.reduce((sum, seg) => sum + seg.humidity, 0) / segments.length
        const maxPrecipitation = Math.max(...segments.map(seg => seg.precipitation))
        const avgPressure = segments.reduce((sum, seg) => sum + seg.pressure, 0) / segments.length
        const avgCloudCover = segments.reduce((sum, seg) => sum + seg.cloudCover, 0) / segments.length
        const avgWindSpeed = segments.reduce((sum, seg) => sum + seg.windSpeed, 0) / segments.length
        const maxWindGusts = Math.max(...segments.map(seg => seg.windGusts))

        // Use the most common weather code or the first one
        const weatherCode = firstSegment.weatherCode
        const windDirection = firstSegment.windDirection

        // Create averaged data for scoring
        const avgData: OpenMeteo15MinData = {
          time: firstSegment.time,
          timestamp: firstSegment.timestamp,
          temp: avgTemp,
          humidity: avgHumidity,
          dewPoint: segments.reduce((sum, seg) => sum + seg.dewPoint, 0) / segments.length,
          apparentTemp: segments.reduce((sum, seg) => sum + seg.apparentTemp, 0) / segments.length,
          precipitation: maxPrecipitation,
          precipitationProbability: Math.max(...segments.map(seg => seg.precipitationProbability)),
          weatherCode: weatherCode,
          pressure: avgPressure,
          cloudCover: avgCloudCover,
          windSpeed: avgWindSpeed,
          windDirection: windDirection,
          windGusts: maxWindGusts,
          visibility: segments.reduce((sum, seg) => sum + seg.visibility, 0) / segments.length,
          sunshineDuration: segments.reduce((sum, seg) => sum + seg.sunshineDuration, 0),
          lightningPotential: Math.max(...segments.map(seg => seg.lightningPotential)),
          cape: segments.reduce((sum, seg) => sum + seg.cape, 0) / segments.length,
        }

        // Compute per-timestamp tide state for 2-hour block midpoint
        const twoHrTide = tideData
          ? createTideDataAtTimestamp(tideData, avgData.timestamp)
          : null
        const score = calculateOpenMeteoFishingScore(avgData, sunriseTimestamp, sunsetTimestamp, twoHrTide ?? tideData, speciesName, dayExtendedContext)
        const weather = getWeatherDescription(avgData.weatherCode)

        twoHourForecasts.push({
          startTime: firstSegment.timestamp,
          endTime: lastSegment.timestamp + 900, // Add 15 minutes to last segment
          score,
          avgTemp: avgData.temp,
          conditions: weather.description,
          icon: weather.icon,
          windSpeed: avgData.windSpeed,
          precipitation: avgData.precipitation,
          pressure: avgData.pressure,
        })
      }
    }

    dailyForecasts.push({
      date: dayData.timestamp,
      dayName: new Date(dayData.timestamp * 1000).toLocaleDateString('en-US', { weekday: 'long' }),
      sunrise: sunriseTimestamp,
      sunset: sunsetTimestamp,
      minutelyScores,
      twoHourForecasts,
    })
  })

  return dailyForecasts
}
