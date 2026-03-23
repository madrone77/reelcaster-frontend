'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Info } from 'lucide-react'
import { AppShell } from '@/app/components/layout'
import DashboardHeader from '@/app/components/forecast/dashboard-header'
import ModernLoadingState from '@/app/components/common/modern-loading-state'
import ErrorState from '@/app/components/common/error-state'
import DataControls from './data-controls'
import WeightControlsPanel from './weight-controls-panel'
import StackedScoreChart, { type ChartDataPoint } from './stacked-score-chart'
import ComparisonSummary from './comparison-summary'
import FactorDrillDown from './factor-drill-down'

import {
  FISHING_LOCATIONS,
  type FishingLocation,
  type FishingHotspot,
} from '@/app/config/locations'
import {
  generateOpenMeteoDailyForecasts,
  createTideDataAtTimestamp,
  type OpenMeteoDailyForecast,
  type FishingScore,
} from '@/app/utils/fishingCalculations'
import { fetchForecastBundle } from '@/app/utils/forecastDataProvider'
import type { ProcessedOpenMeteoData } from '@/app/utils/openMeteoApi'
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
import {
  DEFAULT_SCORING_CURVES,
  evaluateCurve,
  extractBlockAveragedData,
  FACTOR_INPUT_MAP,
  type ScoringCurve,
} from '@/app/utils/scoringCurves'

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
  const hasCHSRef = useRef(true) // Fix #5: track CHS as a ref, not derived from factor state
  const [hasCHS, setHasCHS] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Weight state
  const [factorStates, setFactorStates] = useState<Record<FactorKey, FactorState>>(
    getDefaultFactorStates(true),
  )
  const [activePreset, setActivePreset] = useState<string | null>('default')

  // Drill-down state
  const [activeDrillDown, setActiveDrillDown] = useState<FactorKey | null>(null)
  const [customCurves, setCustomCurves] = useState<Partial<Record<FactorKey, ScoringCurve>>>({})
  const [rawWeatherData, setRawWeatherData] = useState<ProcessedOpenMeteoData | null>(null)
  const [rawTideData, setRawTideData] = useState<CHSWaterData | null>(null)

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
      const prevCHS = hasCHSRef.current
      hasCHSRef.current = chsAvailable
      setHasCHS(chsAvailable)

      // Store raw data for drill-down
      setRawWeatherData(bundle.weather)
      setRawTideData(bundle.tide ?? null)

      const forecasts = generateOpenMeteoDailyForecasts(
        bundle.weather,
        bundle.tide,
        selectedSpecies,
      )

      // Use today (index 0)
      setTodayForecast(forecasts[0] ?? null)

      // Fix #5: Reset weights only when CHS availability actually changes
      if (prevCHS !== chsAvailable) {
        setFactorStates(getDefaultFactorStates(chsAvailable))
        setActivePreset('default')
      }
    } catch (e: any) {
      console.error('Algorithm Designer data load failed:', e)
      setError(e.message || 'Failed to load forecast data')
    } finally {
      setLoading(false)
    }
  }, [selectedHotspot, selectedSpecies])

  // Fix #1: Auto-load on mount
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      loadData()
    }
  }, [loadData])

  // Fix #2: Auto-reload when location/hotspot/species change (skip initial)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    loadData()
  }, [selectedHotspot, selectedSpecies]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fix #10: Keyboard shortcut — Cmd/Ctrl+Enter to refresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        loadData()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loadData])

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
      setFactorStates(() => {
        const next = {} as Record<FactorKey, FactorState>
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

  // ─── Drill-down handlers ──────────────────────────────────────────────

  const handleFactorDrillDown = useCallback((key: FactorKey) => {
    setActiveDrillDown(key)
  }, [])

  const handleCurveChange = useCallback(
    (key: FactorKey, curve: ScoringCurve) => {
      setCustomCurves((prev) => ({ ...prev, [key]: curve }))
    },
    [],
  )

  const handleCurveReset = useCallback((key: FactorKey) => {
    setCustomCurves((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

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

  // ─── Copy weights handler (Fix #6) ────────────────────────────────────

  const handleCopyWeights = useCallback(() => {
    const normalized = normalizeWeights(factorStates)
    const output: Record<string, { enabled: boolean; rawWeight: number; normalizedPct: string }> = {}
    for (const meta of FACTOR_META) {
      output[meta.key] = {
        enabled: factorStates[meta.key].enabled,
        rawWeight: factorStates[meta.key].rawWeight,
        normalizedPct: `${(normalized[meta.key] * 100).toFixed(1)}%`,
      }
    }
    navigator.clipboard.writeText(JSON.stringify(output, null, 2))
  }, [factorStates])

  // ─── Computed ─────────────────────────────────────────────────────────

  const normalized = useMemo(() => normalizeWeights(factorStates), [factorStates])

  // Reconstruct averaged block data from raw weather + tide for drill-down
  const blockRawData = useMemo(() => {
    if (!rawWeatherData || !todayForecast) return null

    // Group minutely15 by day, same as generateOpenMeteoDailyForecasts
    const minutelyByDay: Record<string, typeof rawWeatherData.minutely15> = {}
    for (const m of rawWeatherData.minutely15) {
      const d = new Date(m.timestamp * 1000)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!minutelyByDay[key]) minutelyByDay[key] = []
      minutelyByDay[key].push(m)
    }

    // Get day 1 (today) — same as generateOpenMeteoDailyForecasts uses dayKeys[1]
    const dayKeys = Object.keys(minutelyByDay).sort()
    const todayKey = dayKeys[1] // index 0 is partial previous day
    if (!todayKey) return null

    const dayMinutely = minutelyByDay[todayKey]
    return extractBlockAveragedData(dayMinutely)
  }, [rawWeatherData, todayForecast])

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

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        // Start with production breakdown
        const bd = { ...block.score.breakdown }

        // Override breakdown scores for factors with custom curves
        if (blockRawData && blockRawData[i] && Object.keys(customCurves).length > 0) {
          const avgBlock = blockRawData[i]
          const tideAtBlock = rawTideData
            ? createTideDataAtTimestamp(rawTideData, avgBlock.timestamp)
            : null

          for (const [factorKey, curve] of Object.entries(customCurves) as [FactorKey, ScoringCurve][]) {
            const def = FACTOR_INPUT_MAP[factorKey]
            const rawVal = def.extractor(
              avgBlock,
              tideAtBlock ?? rawTideData,
              todayForecast.sunrise,
              todayForecast.sunset,
            )
            if (rawVal !== null) {
              bd[factorKey] = evaluateCurve(curve, rawVal)
            }
          }
        }

        const contributions = calculateFactorContributions(bd, normalized)
        const customScore = recalculateScore(bd, normalized)
        const origScore = getOriginalScore(block.score.breakdown, hasCHS)

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
    }, [todayForecast, normalized, hasCHS, customCurves, blockRawData, rawTideData])

  // Drill-down data for the active factor
  const drillDownData = useMemo(() => {
    if (!activeDrillDown || !todayForecast) return null

    const key = activeDrillDown
    const curve = customCurves[key] ?? DEFAULT_SCORING_CURVES[key]
    const defaultCurve = DEFAULT_SCORING_CURVES[key]
    const blocks = todayForecast.twoHourForecasts

    let inputSum = 0
    let inputCount = 0

    const timelineBlocks = blocks.map((block, i) => {
      const productionScore = block.score.breakdown[key] ?? 0

      let rawInput: number | null = null
      let customScore = productionScore

      if (blockRawData && blockRawData[i]) {
        const avgBlock = blockRawData[i]
        const tideAtBlock = rawTideData
          ? createTideDataAtTimestamp(rawTideData, avgBlock.timestamp)
          : null

        const def = FACTOR_INPUT_MAP[key]
        rawInput = def.extractor(
          avgBlock,
          tideAtBlock ?? rawTideData,
          todayForecast.sunrise,
          todayForecast.sunset,
        )

        if (rawInput !== null) {
          customScore = evaluateCurve(curve, rawInput)
          inputSum += rawInput
          inputCount++
        }
      }

      return {
        time: formatTime(block.startTime),
        rawInput,
        productionScore,
        customScore,
      }
    })

    return {
      curve,
      defaultCurve,
      blocks: timelineBlocks,
      avgInput: inputCount > 0 ? inputSum / inputCount : null,
    }
  }, [activeDrillDown, todayForecast, customCurves, blockRawData, rawTideData])

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

          {/* Fix #7: No-CHS data indicator */}
          {!loading && !hasCHS && todayForecast && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                CHS tide station data unavailable for this location. Marine factors (water temperature, current speed/direction) are disabled.
              </p>
            </div>
          )}

          {/* Loading / Error */}
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
                    customCurveKeys={Object.keys(customCurves) as FactorKey[]}
                    onToggle={handleToggle}
                    onWeightChange={handleWeightChange}
                    onApplyPreset={handleApplyPreset}
                    onEnableAll={handleEnableAll}
                    onDisableAll={handleDisableAll}
                    onReset={handleReset}
                    onCopyWeights={handleCopyWeights}
                    onFactorDrillDown={handleFactorDrillDown}
                  />
                </div>

                <div className="xl:col-span-8 space-y-6">
                  {/* Factor Drill-Down — stacked above the chart */}
                  {activeDrillDown && drillDownData && (
                    <FactorDrillDown
                      factorKey={activeDrillDown}
                      onClose={() => setActiveDrillDown(null)}
                      curve={drillDownData.curve}
                      defaultCurve={drillDownData.defaultCurve}
                      onCurveChange={(curve) => handleCurveChange(activeDrillDown, curve)}
                      onReset={() => handleCurveReset(activeDrillDown)}
                      blocks={drillDownData.blocks}
                      avgInput={drillDownData.avgInput}
                    />
                  )}

                  <StackedScoreChart
                    data={chartData}
                    factorStates={factorStates}
                  />
                </div>
              </div>

              {/* Keyboard shortcut hint */}
              <p className="text-xs text-rc-text-muted text-center">
                Press <kbd className="px-1.5 py-0.5 bg-rc-bg-light rounded text-rc-text-light text-[10px] font-mono">Cmd+Enter</kbd> to refresh data
              </p>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
