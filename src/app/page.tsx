'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForecastData } from '@/hooks/use-forecast-data'
import ErrorState from './components/common/error-state'
import { useAuth } from '@/contexts/auth-context'
import { UserPreferencesService } from '@/lib/user-preferences'

// Layout
import AppShellV2 from './components/layout/app-shell-v2'

// V2 overlay components
import MapOverlayTopBar from './components/v2/map-overlay-top-bar'
import DayOutlookOverlay from './components/v2/day-outlook-overlay'
import MapLayerControls from './components/v2/map-layer-controls'
import BottomDataPanel from './components/v2/bottom-data-panel'
import BottomSheetMobile from './components/v2/bottom-sheet-mobile'

// V2 sidebar components
import V2RightSidebar from './components/v2/v2-right-sidebar'

// Map
import ForecastMapSwitcher from './components/forecast/forecast-map-switcher'

// Modals
import AlgorithmInfoModal from './components/forecast/algorithm-info-modal'

function V2ForecastContent() {
  const data = useForecastData()
  const {
    selectedLocation,
    selectedHotspot,
    species,
    coordinates,
    openMeteoData,
    forecastData,
    tideData,
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
    currentLocation,
    hasValidCoordinates,
    handleHotspotChange,
    dataMetadata,
  } = data

  // Map layer state
  const [activeLayers, setActiveLayers] = useState<string[]>([])

  const toggleLayer = (layer: string) => {
    setActiveLayers(prev =>
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    )
  }

  if (!hasValidCoordinates && (parseFloat(new URLSearchParams(window.location.search).get('lat') || '0') !== 0 || parseFloat(new URLSearchParams(window.location.search).get('lon') || '0') !== 0)) {
    return <ErrorState message="Invalid coordinates provided" />
  }

  // Right sidebar content
  const rightSidebar = !loading ? (
    <V2RightSidebar
      forecastData={forecastData}
      openMeteoData={openMeteoData}
      tideData={tideData}
      selectedDay={selectedDay}
      species={species}
      selectedLocation={selectedLocation}
      onDetailsClick={() => setShowAlgorithmModal(true)}
    />
  ) : null

  return (
    <AppShellV2 rightSidebar={rightSidebar}>
      <div className="relative h-full">
        {/* Full-screen map */}
        {loading ? (
          <div className="absolute inset-0 bg-rc-bg-darkest flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse [animation-delay:300ms]" />
              </div>
              <p className="text-sm text-rc-text-muted">Loading forecast data...</p>
            </div>
          </div>
        ) : (
          <>
            {currentLocation && (
              <div className="absolute inset-0">
                <ForecastMapSwitcher
                  key={`${selectedLocation}-${selectedHotspot}`}
                  variant="fullscreen"
                  location={selectedLocation}
                  hotspot={selectedHotspot}
                  hotspots={currentLocation.hotspots}
                  centerCoordinates={coordinates}
                  onHotspotChange={handleHotspotChange}
                  openMeteoData={openMeteoData}
                  tideData={tideData}
                />
              </div>
            )}

            {/* Desktop overlays (pointer-events-none container) */}
            <div className="absolute inset-0 pointer-events-none hidden lg:flex flex-col z-10">
              <MapOverlayTopBar
                selectedLocation={selectedLocation}
                selectedHotspot={selectedHotspot}
                species={species}
              />

              <DayOutlookOverlay
                forecasts={forecastData}
                selectedDay={selectedDay}
                onDaySelect={setSelectedDay}

              />

              <MapLayerControls
                activeLayers={activeLayers}
                onToggleLayer={toggleLayer}
              />

              {/* Spacer pushes bottom panel down */}
              <div className="flex-1" />

              <BottomDataPanel
                forecasts={forecastData}
                openMeteoData={openMeteoData}
                tideData={tideData}
                dataMetadata={dataMetadata}
                selectedDay={selectedDay}
                species={species}
                hoveredHourIndex={hoveredHourIndex}
                onHoverChange={setHoveredHourIndex}
                mobilePeriod={mobilePeriod}
                onPeriodChange={setMobilePeriod}
              />
            </div>

            {/* Mobile overlays */}
            <div className="absolute inset-0 pointer-events-none lg:hidden flex flex-col z-10">
              <MapOverlayTopBar
                selectedLocation={selectedLocation}
                selectedHotspot={selectedHotspot}
                species={species}
                compact
              />

              <DayOutlookOverlay
                forecasts={forecastData}
                selectedDay={selectedDay}
                onDaySelect={setSelectedDay}

                compact
              />

              <div className="flex-1" />
            </div>

            {/* Mobile bottom sheet */}
            <div className="lg:hidden">
              <BottomSheetMobile
                forecastData={forecastData}
                openMeteoData={openMeteoData}
                tideData={tideData}
                dataMetadata={dataMetadata}
                selectedDay={selectedDay}
                species={species}
                selectedLocation={selectedLocation}
                hoveredHourIndex={hoveredHourIndex}
                onHoverChange={setHoveredHourIndex}
                mobilePeriod={mobilePeriod}
                onPeriodChange={setMobilePeriod}
                onDetailsClick={() => setShowAlgorithmModal(true)}
              />
            </div>
          </>
        )}

        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <ErrorState message={error} />
          </div>
        )}
      </div>

      {/* Algorithm Info Modal */}
      <AlgorithmInfoModal
        isOpen={showAlgorithmModal}
        onClose={() => setShowAlgorithmModal(false)}
        species={species}
      />
    </AppShellV2>
  )
}

function HomePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    const loadDefaultLocation = async () => {
      if (!searchParams.get('location') && !searchParams.get('hotspot')) {
        try {
          const defaultLocation = await UserPreferencesService.getDefaultLocation()

          const params = new URLSearchParams({
            location: defaultLocation.location,
            hotspot: defaultLocation.hotspot,
            lat: defaultLocation.lat.toString(),
            lon: defaultLocation.lon.toString(),
          })

          if (defaultLocation.species) {
            params.set('species', defaultLocation.species)
          }

          router.replace(`/?${params.toString()}`)
        } catch (error) {
          console.error('Error loading default location:', error)
          const params = new URLSearchParams({
            location: 'Victoria, Sidney',
            hotspot: 'Waterfront',
            lat: '48.4284',
            lon: '-123.3656',
          })
          router.replace(`/?${params.toString()}`)
        }
      }
    }

    loadDefaultLocation()
  }, [searchParams, router, user])

  return <V2ForecastContent />
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  )
}
