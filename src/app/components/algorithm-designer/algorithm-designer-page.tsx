'use client'

import { useState, useCallback, useMemo } from 'react'
import { AppShell } from '@/app/components/layout'
import DashboardHeader from '@/app/components/forecast/dashboard-header'
import ModernLoadingState from '@/app/components/common/modern-loading-state'
import ErrorState from '@/app/components/common/error-state'
import DataControls from './data-controls'
import WeightControlsPanel from './weight-controls-panel'
import StackedScoreChart, { type ChartDataPoint } from './stacked-score-chart'
import ComparisonSummary from './comparison-summary'

import {
  FISHING_LOCATIONS,
  type FishingLocation,
  type FishingHotspot,
} from '@/app/config/locations'
import {
  generateOpenMeteoDailyForecasts,
  type OpenMeteoDailyForecast,
  type FishingScore,
} from '@/app/utils/fishingCalculations'
import { fetchForecastBundle } from '@/app/utils/forecastDataProvider'
import type { CHSWaterData } from '@/app/utils/chsTideApi'

import {
  FACTOR_META,
  WEIGHT_PRESETS,
  normalizeWeights,
  recalculateScore,
  calculateFactorContributions,
  getDefaultFactorStates,
  type FactorKey,
  type FactorState,
} from '@/app/utils/algorithmDesigner'

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_LOCATION = FISHING_LOCATIONS.find((l) => l.available) ?? FISHING_LOCATIONS[0]
const DEFAULT_HOTSPOT = DEFAULT_LOCATION.hotspots[0]

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTimeRange(startTs: number, endTs: number): string {
  return `${formatTime(startTs)}-${formatTime(endTs)}`
}

/** Production weights (with CHS data) */
const PROD_CHS_WEIGHTS: Record<FactorKey, number> = {
  pressure: 0.13, wind: 0.12, temperature: 0.09, waterTemperature: 0.05,
  precipitation: 0.10, tide: 0.08, currentSpeed: 0.04, currentDirection: 0.02,
  cloudCover: 0.06, visibility: 0.06, sunshine: 0.05, lightning: 0.05,
  atmospheric: 0.04, comfort: 0.04, timeOfDay: 0.04, species: 0.03,
}

/** Production weights (without CHS data) */
const PROD_NO_CHS_WEIGHTS: Record<FactorKey, number> = {
  pressure: 0.14, wind: 0.13, temperature: 0.11, waterTemperature: 0,
  precipitation: 0.11, tide: 0.11, currentSpeed: 0, currentDirection: 0,
  cloudCover: 0.06, visibility: 0.06, sunshine: 0.05, lightning: 0.05,
  atmospheric: 0.04, comfort: 0.04, timeOfDay: 0.04, species: 0.06,
}

function getOriginalScore(breakdown: FishingScore['breakdown'], hasCHS: boolean): number {
  const w = hasCHS ? PROD_CHS_WEIGHTS : PROD_NO_CHS_WEIGHTS
  let total = 0
  for (const key of Object.keys(w) as FactorKey[]) {
    total += (breakdown[key] ?? 0) * w[key]
  }
  return Math.min(Math.max(Math.round(total * 100) / 100, 0), 10)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AlgorithmDesignerPage() {
  // Location state
  const [selectedLocation, setSelectedLocation] = useState<FishingLocation>(DEFAULT_LOCATION)
  const [selectedHotspot, setSelectedHotspot] = useState<FishingHotspot>(DEFAULT_HOTSPOT)
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)

  // Data state
  const [todayForecast, setTodayForecast] = useState<OpenMeteoDailyForecast | null>(null)
  const [hasCHS, setHasCHS] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Weight state
  const [factorStates, setFactorStates] = useState<Record<FactorKey, FactorState>>(
    getDefaultFactorStates(true),
  )
  const [activePreset, setActivePreset] = useState<string | null>('default')

  // ─── Data loading ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { lat, lon } = selectedHotspot.coordinates
      const bundle = await fetchForecastBundle(lat, lon, {
        tideStationCode: selectedHotspot.tideStationCode,
        forecastDays: 3,
        marineDays: 3,
      })

      const chsAvailable = !!bundle.tide
      setHasCHS(chsAvailable)

      const forecasts = generateOpenMeteoDailyForecasts(
        bundle.weather,
        bundle.tide,
        selectedSpecies,
      )

      // Use today (index 0)
      setTodayForecast(forecasts[0] ?? null)

      // Reset weights if CHS availability changed
      setFactorStates((prev) => {
        const prevCHS = prev.waterTemperature.enabled || prev.currentSpeed.enabled
        if (prevCHS !== chsAvailable) {
          setActivePreset('default')
          return getDefaultFactorStates(chsAvailable)
        }
        return prev
      })

      setHasLoaded(true)
    } catch (e: any) {
      console.error('Algorithm Designer data load failed:', e)
      setError(e.message || 'Failed to load forecast data')
    } finally {
      setLoading(false)
    }
  }, [selectedHotspot, selectedSpecies])

  // ─── Weight handlers ───────────────────────────────────────────────────

  const handleToggle = useCallback((key: FactorKey, enabled: boolean) => {
    setFactorStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled },
    }))
    setActivePreset(null)
  }, [])

  const handleWeightChange = useCallback((key: FactorKey, value: number) => {
    setFactorStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], rawWeight: value },
    }))
    setActivePreset(null)
  }, [])

  const handleApplyPreset = useCallback(
    (presetId: string) => {
      const preset = WEIGHT_PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      setFactorStates((prev) => {
        const next = { ...prev }
        for (const meta of FACTOR_META) {
          next[meta.key] = {
            enabled: (preset.weights[meta.key] ?? 0) > 0,
            rawWeight: preset.weights[meta.key] ?? meta.defaultWeight,
          }
        }
        return next
      })
      setActivePreset(presetId)
    },
    [],
  )

  const handleEnableAll = useCallback(() => {
    setFactorStates((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next) as FactorKey[]) {
        next[key] = { ...next[key], enabled: true }
      }
      return next
    })
    setActivePreset(null)
  }, [])

  const handleDisableAll = useCallback(() => {
    setFactorStates((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next) as FactorKey[]) {
        next[key] = { ...next[key], enabled: false }
      }
      return next
    })
    setActivePreset(null)
  }, [])

  const handleReset = useCallback(() => {
    setFactorStates(getDefaultFactorStates(hasCHS))
    setActivePreset('default')
  }, [hasCHS])

  // ─── Location handlers ────────────────────────────────────────────────

  const handleLocationChange = useCallback((locationId: string) => {
    const loc = FISHING_LOCATIONS.find((l) => l.id === locationId)
    if (!loc) return
    setSelectedLocation(loc)
    setSelectedHotspot(loc.hotspots[0])
  }, [])

  const handleHotspotChange = useCallback(
    (name: string) => {
      const h = selectedLocation.hotspots.find((h) => h.name === name)
      if (h) setSelectedHotspot(h)
    },
    [selectedLocation],
  )

  // ─── Computed ─────────────────────────────────────────────────────────

  const normalized = useMemo(() => normalizeWeights(factorStates), [factorStates])

  const { chartData, originalAvg, customAvg, originalBest, customBest, avgScores } =
    useMemo(() => {
      if (!todayForecast) {
        return {
          chartData: [] as ChartDataPoint[],
          originalAvg: 0,
          customAvg: 0,
          originalBest: { window: 'N/A', score: 0 },
          customBest: { window: 'N/A', score: 0 },
          avgScores: Object.fromEntries(
            FACTOR_META.map((f) => [f.key, null]),
          ) as Record<FactorKey, number | null>,
        }
      }

      const blocks = todayForecast.twoHourForecasts
      const points: ChartDataPoint[] = []
      let origSum = 0
      let custSum = 0
      let origBestScore = 0
      let origBestWindow = ''
      let custBestScore = 0
      let custBestWindow = ''
      const factorSums: Record<FactorKey, number> = {} as any
      for (const f of FACTOR_META) factorSums[f.key] = 0

      for (const block of blocks) {
        const bd = block.score.breakdown
        const contributions = calculateFactorContributions(bd, normalized)
        const customScore = recalculateScore(bd, normalized)
        const origScore = getOriginalScore(bd, hasCHS)

        const timeStr = formatTime(block.startTime)
        const windowStr = formatTimeRange(block.startTime, block.endTime)

        const point: ChartDataPoint = {
          time: timeStr,
          originalScore: origScore,
        }
        for (const meta of FACTOR_META) {
          point[meta.key] = contributions[meta.key]
          factorSums[meta.key] += bd[meta.key] ?? 0
        }
        points.push(point)

        origSum += origScore
        custSum += customScore

        if (origScore > origBestScore) {
          origBestScore = origScore
          origBestWindow = windowStr
        }
        if (customScore > custBestScore) {
          custBestScore = customScore
          custBestWindow = windowStr
        }
      }

      const count = blocks.length || 1
      const avgScoresResult = Object.fromEntries(
        FACTOR_META.map((f) => [f.key, factorSums[f.key] / count]),
      ) as Record<FactorKey, number | null>

      return {
        chartData: points,
        originalAvg: origSum / count,
        customAvg: custSum / count,
        originalBest: { window: origBestWindow, score: origBestScore },
        customBest: { window: custBestWindow, score: custBestScore },
        avgScores: avgScoresResult,
      }
    }, [todayForecast, normalized, hasCHS])

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Algorithm Designer"
          showTimeframe={false}
          showSetLocation={false}
          showCustomize={false}
        />

        <div className="max-w-7xl mx-auto space-y-6">
          <DataControls
            selectedLocation={selectedLocation}
            selectedHotspot={selectedHotspot}
            selectedSpecies={selectedSpecies}
            loading={loading}
            onLocationChange={handleLocationChange}
            onHotspotChange={handleHotspotChange}
            onSpeciesChange={setSelectedSpecies}
            onRefresh={loadData}
          />

          {/* Loading / Error / Empty */}
          {loading && <ModernLoadingState forecastDays={3} />}

          {error && (
            <div>
              <ErrorState message={error} />
              <div className="text-center mt-3">
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-rc-text rounded-lg text-sm transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !hasLoaded && (
            <div className="text-center py-16">
              <p className="text-rc-text-muted text-sm">
                Select a location and click <strong>Refresh Data</strong> to
                load forecast data.
              </p>
            </div>
          )}

          {/* Main content — only when we have data */}
          {!loading && !error && todayForecast && (
            <>
              <ComparisonSummary
                originalAvg={originalAvg}
                customAvg={customAvg}
                originalBestWindow={originalBest.window}
                customBestWindow={customBest.window}
                originalBestScore={originalBest.score}
                customBestScore={customBest.score}
              />

              <div className="grid xl:grid-cols-12 gap-6">
                <div className="xl:col-span-4">
                  <WeightControlsPanel
                    factorStates={factorStates}
                    normalizedWeights={normalized}
                    avgScores={avgScores}
                    activePreset={activePreset}
                    onToggle={handleToggle}
                    onWeightChange={handleWeightChange}
                    onApplyPreset={handleApplyPreset}
                    onEnableAll={handleEnableAll}
                    onDisableAll={handleDisableAll}
                    onReset={handleReset}
                  />
                </div>

                <div className="xl:col-span-8">
                  <StackedScoreChart
                    data={chartData}
                    factorStates={factorStates}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
