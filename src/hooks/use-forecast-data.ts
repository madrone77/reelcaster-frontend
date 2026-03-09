'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ProcessedOpenMeteoData,
} from '@/app/utils/openMeteoApi'
import { generateOpenMeteoDailyForecasts, OpenMeteoDailyForecast } from '@/app/utils/fishingCalculations'
import { CHSWaterData } from '@/app/utils/chsTideApi'
import { fetchForecastBundle, DataSourceMetadata } from '@/app/utils/forecastDataProvider'
import ForecastCacheService from '@/app/utils/forecastCacheService'
import { useAnalytics } from '@/hooks/use-analytics'
import { setAlgorithmVersion } from '@/app/utils/speciesAlgorithms'
import type { AlgorithmVersion } from '@/app/components/forecast/algorithm-version-toggle'
import {
  FISHING_LOCATIONS,
  type FishingHotspot,
} from '@/app/config/locations'

const fishingLocations = FISHING_LOCATIONS

export interface UseForecastDataReturn {
  // URL params
  selectedLocation: string
  selectedHotspot: string
  species: string | null
  coordinates: { lat: number; lon: number }

  // Data
  openMeteoData: ProcessedOpenMeteoData | null
  forecasts: OpenMeteoDailyForecast[]
  forecastData: OpenMeteoDailyForecast[]
  tideData: CHSWaterData | null
  loading: boolean
  error: string | null

  // UI state
  selectedDay: number
  setSelectedDay: (day: number) => void
  hoveredHourIndex: number | null
  setHoveredHourIndex: (index: number | null) => void
  mobilePeriod: 'am' | 'pm'
  setMobilePeriod: (period: 'am' | 'pm') => void
  showAlgorithmModal: boolean
  setShowAlgorithmModal: (show: boolean) => void
  isMapModalOpen: boolean
  setIsMapModalOpen: (open: boolean) => void

  // Data source metadata
  dataMetadata: DataSourceMetadata | null

  // Cache state
  isCachedData: boolean
  isRefreshing: boolean
  cacheInfo: { createdAt?: string; expiresAt?: string }

  // Location data
  currentLocation: typeof fishingLocations[number] | undefined
  currentHotspot: FishingHotspot | undefined
  hasValidCoordinates: boolean

  // Callbacks
  handleHotspotChange: (hotspot: FishingHotspot) => void
  handleAlgorithmChange: (version: AlgorithmVersion) => void
}

export function useForecastData(): UseForecastDataReturn {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { trackEvent } = useAnalytics()
  const pageLoadStartTime = useRef<number>(Date.now())
  const hasTrackedPageView = useRef<boolean>(false)
  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitialDataLoaded = useRef<boolean>(false)

  // Default to Victoria Waterfront if no parameters provided
  const location = searchParams.get('location') || 'Victoria, Sidney'
  const hotspot = searchParams.get('hotspot') || 'Waterfront'
  const species = searchParams.get('species') || null
  const lat = parseFloat(searchParams.get('lat') || '48.4284')
  const lon = parseFloat(searchParams.get('lon') || '-123.3656')

  const selectedLocation = location
  const selectedHotspot = hotspot
  const [openMeteoData, setOpenMeteoData] = useState<ProcessedOpenMeteoData | null>(null)
  const [forecasts, setForecasts] = useState<OpenMeteoDailyForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tideData, setTideData] = useState<CHSWaterData | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null)
  const [mobilePeriod, setMobilePeriod] = useState<'am' | 'pm'>('am')
  const [showAlgorithmModal, setShowAlgorithmModal] = useState(false)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)

  // Data source metadata
  const [dataMetadata, setDataMetadata] = useState<DataSourceMetadata | null>(null)

  // Cache-related state
  const [isCachedData, setIsCachedData] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<{ createdAt?: string; expiresAt?: string }>({})

  // All forecasts available to authenticated users
  const forecastData = forecasts

  // Coordinate validation
  const hasValidCoordinates = lat !== 0 && lon !== 0

  // Get current location data
  const currentLocation = fishingLocations.find(loc => loc.name === selectedLocation)
  const currentHotspot = currentLocation?.hotspots.find(h => h.name === selectedHotspot)

  const coordinates = useMemo(() => {
    return hasValidCoordinates
      ? { lat, lon }
      : currentHotspot?.coordinates || currentLocation?.coordinates || { lat: 48.4113, lon: -123.398 }
  }, [hasValidCoordinates, lat, lon, currentHotspot?.coordinates, currentLocation?.coordinates])

  // Handle hotspot change from map click
  const handleHotspotChange = useCallback((hotspotData: FishingHotspot) => {
    if (!currentLocation) return

    const params = new URLSearchParams({
      location: currentLocation.name,
      hotspot: hotspotData.name,
      lat: hotspotData.coordinates.lat.toString(),
      lon: hotspotData.coordinates.lon.toString(),
    })

    if (species) {
      params.set('species', species)
    }

    trackEvent('Hotspot Selected', {
      location: currentLocation.name,
      hotspot: hotspotData.name,
      coordinates: hotspotData.coordinates,
      source: 'map',
      timestamp: new Date().toISOString(),
    })

    router.replace(`/?${params.toString()}`)
  }, [currentLocation, species, router, trackEvent])

  // Fresh data fetching function — uses the unified forecast data provider
  const fetchFreshForecastData = useCallback(async (): Promise<{
    forecasts: OpenMeteoDailyForecast[]
    openMeteoData: ProcessedOpenMeteoData
    tideData: CHSWaterData | null
    metadata: DataSourceMetadata
  } | null> => {
    try {
      const bundle = await fetchForecastBundle(coordinates.lat, coordinates.lon, {
        forecastDays: 14,
        marineDays: 7,
        tideStationCode: currentHotspot?.tideStationCode,
      })

      if (bundle.tide) {
        console.log(`Tide data from ${bundle.metadata.tide}: ${bundle.metadata.tideStationName} (${bundle.metadata.tideStationCode}) — ${bundle.metadata.tideStationDistanceKm}km`)
      }

      const dailyForecasts = generateOpenMeteoDailyForecasts(
        bundle.weather,
        bundle.tide,
        species,
      )

      return {
        forecasts: dailyForecasts,
        openMeteoData: bundle.weather,
        tideData: bundle.tide,
        metadata: bundle.metadata,
      }
    } catch (err) {
      console.error('Error fetching fresh forecast data:', err)
      throw err
    }
  }, [coordinates, species, currentHotspot?.tideStationCode])

  // Main forecast data fetching with caching
  const fetchForecastData = useCallback(async () => {
    const isInitialLoad = !hasInitialDataLoaded.current
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)
    setIsCachedData(false)

    try {
      const cacheResult = await ForecastCacheService.getCachedForecast(
        selectedLocation,
        selectedHotspot,
        species
      )

      if (cacheResult.cached && cacheResult.data) {
        setForecasts(cacheResult.data.forecasts)
        setOpenMeteoData(cacheResult.data.openMeteoData)
        const cachedTideData = cacheResult.data.chsTideData || null
        setTideData(cachedTideData)
        setIsCachedData(true)
        setCacheInfo({
          createdAt: cacheResult.createdAt,
          expiresAt: cacheResult.expiresAt,
        })
        hasInitialDataLoaded.current = true
        setLoading(false)

        const cacheAge = cacheResult.createdAt
          ? (Date.now() - new Date(cacheResult.createdAt).getTime()) / (1000 * 60 * 60)
          : 0
        trackEvent('Cache Hit', {
          location: selectedLocation,
          cacheAge,
          timestamp: new Date().toISOString(),
        })

        const loadTime = Date.now() - pageLoadStartTime.current
        trackEvent('Forecast Loaded', {
          location: selectedLocation,
          hotspot: selectedHotspot,
          species: species || undefined,
          cached: true,
          loadTime,
          timestamp: new Date().toISOString(),
        })

        // Background refresh
        setIsRefreshing(true)
        try {
          const freshData = await fetchFreshForecastData()
          if (freshData) {
            await ForecastCacheService.storeForecastCache(
              selectedLocation,
              selectedHotspot,
              species,
              coordinates,
              freshData.forecasts,
              freshData.openMeteoData,
              freshData.tideData
            )

            setForecasts(freshData.forecasts)
            setOpenMeteoData(freshData.openMeteoData)
            setTideData(freshData.tideData)
            setDataMetadata(freshData.metadata)
            setIsCachedData(false)
            setCacheInfo({})

            trackEvent('Forecast Refreshed', {
              location: selectedLocation,
              hotspot: selectedHotspot,
              species: species || undefined,
              timestamp: new Date().toISOString(),
            })
          }
        } catch (refreshError) {
          console.error('Background refresh failed:', refreshError)
        } finally {
          setIsRefreshing(false)
        }
      } else {
        const freshData = await fetchFreshForecastData()
        if (freshData) {
          setForecasts(freshData.forecasts)
          setOpenMeteoData(freshData.openMeteoData)
          setTideData(freshData.tideData)
          setDataMetadata(freshData.metadata)
          setIsCachedData(false)
          setCacheInfo({})
          hasInitialDataLoaded.current = true

          const loadTime = Date.now() - pageLoadStartTime.current
          trackEvent('Forecast Loaded', {
            location: selectedLocation,
            hotspot: selectedHotspot,
            species: species || undefined,
            cached: false,
            loadTime,
            timestamp: new Date().toISOString(),
          })

          await ForecastCacheService.storeForecastCache(
            selectedLocation,
            selectedHotspot,
            species,
            coordinates,
            freshData.forecasts,
            freshData.openMeteoData,
            freshData.tideData
          )
        }
      }
    } catch (err) {
      console.error('Error fetching forecast data:', err)
      if (isInitialLoad) {
        setError('Failed to fetch weather data')
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }, [coordinates, species, selectedLocation, selectedHotspot, fetchFreshForecastData, trackEvent])

  // Handle algorithm version change
  const handleAlgorithmChange = useCallback((version: AlgorithmVersion) => {
    setAlgorithmVersion(version)
    fetchForecastData()
  }, [fetchForecastData])

  // Reset initial data flag when location changes
  const prevLocationRef = useRef<string | null>(null)
  useEffect(() => {
    const currentLocationKey = `${selectedLocation}-${selectedHotspot}`
    if (prevLocationRef.current !== null && prevLocationRef.current !== currentLocationKey) {
      hasInitialDataLoaded.current = false
    }
    prevLocationRef.current = currentLocationKey
  }, [selectedLocation, selectedHotspot])

  // Debounced fetch
  useEffect(() => {
    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current)
    }

    fetchDebounceRef.current = setTimeout(() => {
      fetchForecastData()
    }, 100)

    return () => {
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current)
      }
    }
  }, [fetchForecastData])

  // Track page view
  useEffect(() => {
    if (!loading && !hasTrackedPageView.current && forecasts.length > 0) {
      const pageLoadTime = Date.now() - pageLoadStartTime.current
      trackEvent('Forecast Page Viewed', {
        location: selectedLocation,
        hotspot: selectedHotspot,
        species: species || undefined,
        pageLoadTime,
        timestamp: new Date().toISOString(),
      })
      hasTrackedPageView.current = true
    }
  }, [loading, forecasts, selectedLocation, selectedHotspot, species, trackEvent])

  return {
    selectedLocation,
    selectedHotspot,
    species,
    coordinates,
    openMeteoData,
    forecasts,
    forecastData,
    tideData,
    dataMetadata,
    loading,
    error,
    selectedDay,
    setSelectedDay,
    hoveredHourIndex,
    setHoveredHourIndex,
    mobilePeriod,
    setMobilePeriod,
    showAlgorithmModal,
    setShowAlgorithmModal,
    isMapModalOpen,
    setIsMapModalOpen,
    isCachedData,
    isRefreshing,
    cacheInfo,
    currentLocation,
    currentHotspot,
    hasValidCoordinates,
    handleHotspotChange,
    handleAlgorithmChange,
  }
}
