'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForecastData } from '@/hooks/use-forecast-data'
import ErrorState from '../components/common/error-state'
import { useAuth } from '@/contexts/auth-context'
import { UserPreferencesService } from '@/lib/user-preferences'

import { AppShell } from '../components/layout'
import DashboardHeader from '../components/forecast/dashboard-header'

import NewForecastHeader from '../components/forecast/new-forecast-header'
import DayOutlookNew from '../components/forecast/day-outlook-new'
import HourlyChartNew from '../components/forecast/hourly-chart-new'
import HourlyTableNew from '../components/forecast/hourly-table-new'
import WeatherConditions from '../components/forecast/weather-conditions'
import FishingReports from '../components/forecast/fishing-reports'
import { FishingReportDisplay } from '../components/forecast/fishing-report-display'
import SeasonalStatusBanner from '../components/forecast/seasonal-status-banner'
import AlgorithmInfoModal from '../components/forecast/algorithm-info-modal'
import TideForecastChart from '../components/forecast/tide-forecast-chart'
import ForecastMapSwitcher from '../components/forecast/forecast-map-switcher'

// Widgets
import OverallScoreWidget from '../components/forecast/overall-score-widget'
import MapViewWidget from '../components/forecast/map-view-widget'
import WeatherWidget from '../components/forecast/weather-widget'
import TideWidget from '../components/forecast/tide-widget'
import MapModal from '../components/forecast/map-modal'

function V1ForecastContent() {
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
    isMapModalOpen,
    setIsMapModalOpen,
    isCachedData,
    isRefreshing,
    cacheInfo,
    currentLocation,
    hasValidCoordinates,
    handleHotspotChange,
    handleAlgorithmChange,
    dataMetadata,
  } = data

  // Handle invalid coordinates
  if (!hasValidCoordinates && (parseFloat(new URLSearchParams(window.location.search).get('lat') || '0') !== 0 || parseFloat(new URLSearchParams(window.location.search).get('lon') || '0') !== 0)) {
    return <ErrorState message="Invalid coordinates provided" />
  }

  // Right sidebar content for desktop
  const rightSidebarContent = !loading ? (
    <div className="p-4 space-y-4">
      <OverallScoreWidget
        score={
          forecastData[selectedDay]?.twoHourForecasts.length > 0
            ? Math.max(...forecastData[selectedDay].twoHourForecasts.map(f => f.score.total))
            : 0
        }
        onDetailsClick={() => setShowAlgorithmModal(true)}
      />
      <MapViewWidget
        lat={coordinates.lat}
        lon={coordinates.lon}
        locationName={selectedLocation}
        hotspotName={selectedHotspot}
        onExpand={() => setIsMapModalOpen(true)}
      />
      <WeatherWidget
        forecasts={forecastData}
        openMeteoData={openMeteoData}
        selectedDay={selectedDay}
      />
      <TideWidget tideData={tideData} selectedDay={selectedDay} />
    </div>
  ) : null

  return (
    <AppShell rightSidebar={rightSidebarContent}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Reports"
          showAlgorithm={false}
          showTimeframe={false}
          onAlgorithmChange={handleAlgorithmChange}
        />

        <NewForecastHeader
          isCachedData={isCachedData}
          isRefreshing={isRefreshing}
          cacheInfo={cacheInfo}
        />

        <SeasonalStatusBanner
          forecasts={forecastData}
          species={species}
          selectedDay={selectedDay}
        />

        {error && <ErrorState message={error} />}

        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {loading ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-20 h-24 bg-rc-bg-light rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl h-64 animate-pulse" />
              <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl h-96 animate-pulse" />
              <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl h-64 animate-pulse" />
            </div>
          ) : (
            <>
              <DayOutlookNew
                forecasts={forecastData}
                selectedDay={selectedDay}
                onDaySelect={setSelectedDay}
              />

              {currentLocation && (
                <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
                  <ForecastMapSwitcher
                    key={`${selectedLocation}-${selectedHotspot}`}
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

              <HourlyChartNew
                forecasts={forecastData}
                selectedDay={selectedDay}
                species={species}
                tideData={tideData}
                onHoverChange={setHoveredHourIndex}
                mobilePeriod={mobilePeriod}
                onPeriodChange={setMobilePeriod}
              />

              <HourlyTableNew
                forecasts={forecastData}
                openMeteoData={openMeteoData}
                tideData={tideData}
                dataMetadata={dataMetadata}
                selectedDay={selectedDay}
                highlightedIndex={hoveredHourIndex}
                mobilePeriod={mobilePeriod}
                onPeriodChange={setMobilePeriod}
              />

              <TideForecastChart tideData={tideData} />
            </>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3 sm:space-y-6">
          {!loading && (
            <div className="lg:hidden">
              <WeatherConditions
                forecasts={forecastData}
                openMeteoData={openMeteoData}
                tideData={tideData}
                selectedDay={selectedDay}
              />
            </div>
          )}
        </div>

        <div className="lg:hidden">
          <FishingReports />
        </div>

        <div className="mt-6">
          <FishingReportDisplay location={selectedLocation} hotspot={selectedHotspot} />
        </div>
      </div>

      <AlgorithmInfoModal
        isOpen={showAlgorithmModal}
        onClose={() => setShowAlgorithmModal(false)}
        species={species}
      />

      {currentLocation && (
        <MapModal
          isOpen={isMapModalOpen}
          onClose={() => setIsMapModalOpen(false)}
          location={selectedLocation}
          hotspot={selectedHotspot}
          hotspots={currentLocation.hotspots}
          centerCoordinates={coordinates}
          onHotspotChange={handleHotspotChange}
          openMeteoData={openMeteoData}
          tideData={tideData}
        />
      )}
    </AppShell>
  )
}

function V1HomePage() {
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

          router.replace(`/v1?${params.toString()}`)
        } catch (error) {
          console.error('Error loading default location:', error)
          const params = new URLSearchParams({
            location: 'Victoria, Sidney',
            hotspot: 'Waterfront',
            lat: '48.4284',
            lon: '-123.3656',
          })
          router.replace(`/v1?${params.toString()}`)
        }
      }
    }

    loadDefaultLocation()
  }, [searchParams, router, user])

  return <V1ForecastContent />
}

export default function V1Page() {
  return (
    <Suspense fallback={null}>
      <V1HomePage />
    </Suspense>
  )
}
