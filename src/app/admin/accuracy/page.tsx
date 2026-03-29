'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/app/components/layout'
import DashboardHeader from '@/app/components/forecast/dashboard-header'
import AccuracyFilterBar from '@/app/components/accuracy/accuracy-filter-bar'
import AccuracyKPICards from '@/app/components/accuracy/accuracy-kpi-cards'
import PredictedVsActualChart from '@/app/components/accuracy/predicted-vs-actual-chart'
import FactorErrorChart from '@/app/components/accuracy/factor-error-chart'
import RollingAccuracyChart from '@/app/components/accuracy/rolling-accuracy-chart'

interface OverviewData {
  meanAbsError: number | null
  hitRate1pt: number | null
  hitRate2pt: number | null
  totalBlocks: number
  totalDays: number
  trendDirection: 'improving' | 'degrading' | 'stable'
  totalCatches: number
  totalLanded: number
}

interface DailyDataPoint {
  date: string
  avgPredicted: number
  avgActual: number
  delta: number
  blocksCompared: number
  catchCount: number
  landedCount: number
  biteCount: number
}

interface FactorError {
  factor: string
  label: string
  avgPredicted: number
  avgActual: number
  avgError: number
  absError: number
  dataPoints: number
}

interface AlgorithmVersion {
  id: string
  name: string
  isProduction: boolean
}

function getDefaultDateRange() {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  return { from, to }
}

export default function AccuracyDashboard() {
  const [location, setLocation] = useState('')
  const [hotspot, setHotspot] = useState('')
  const [version, setVersion] = useState('')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [versions, setVersions] = useState<AlgorithmVersion[]>([])

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [dailyData, setDailyData] = useState<DailyDataPoint[]>([])
  const [factorData, setFactorData] = useState<FactorError[]>([])

  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [loadingFactors, setLoadingFactors] = useState(true)

  // Build query params
  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (hotspot) params.set('hotspot', hotspot)
    if (version) params.set('version', version)
    if (dateRange.from) params.set('from', dateRange.from)
    if (dateRange.to) params.set('to', dateRange.to)
    return params.toString()
  }, [location, hotspot, version, dateRange])

  // Fetch algorithm versions (once)
  useEffect(() => {
    fetch('/api/admin/accuracy/versions')
      .then(r => r.json())
      .then(data => {
        if (data.versions) {
          setVersions(data.versions.map((v: any) => ({
            id: v.id,
            name: v.name,
            isProduction: v.isProduction,
          })))
        }
      })
      .catch(console.error)
  }, [])

  // Fetch overview data
  useEffect(() => {
    setLoadingOverview(true)
    const days = Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) || 30
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (hotspot) params.set('hotspot', hotspot)
    if (version) params.set('version', version)
    params.set('days', String(days))

    fetch(`/api/admin/accuracy/overview?${params}`)
      .then(r => r.json())
      .then(data => setOverview(data))
      .catch(console.error)
      .finally(() => setLoadingOverview(false))
  }, [location, hotspot, version, dateRange])

  // Fetch daily data
  useEffect(() => {
    setLoadingDaily(true)
    fetch(`/api/admin/accuracy/daily?${buildParams()}`)
      .then(r => r.json())
      .then(data => setDailyData(data.dates || []))
      .catch(console.error)
      .finally(() => setLoadingDaily(false))
  }, [buildParams])

  // Fetch factor data
  useEffect(() => {
    setLoadingFactors(true)
    fetch(`/api/admin/accuracy/factors?${buildParams()}`)
      .then(r => r.json())
      .then(data => setFactorData(data.factors || []))
      .catch(console.error)
      .finally(() => setLoadingFactors(false))
  }, [buildParams])

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Prediction Accuracy"
          showTimeframe={false}
          showSetLocation={false}
          showCustomize={false}
        />

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filter Bar */}
          <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
            <AccuracyFilterBar
              location={location}
              hotspot={hotspot}
              version={version}
              dateRange={dateRange}
              onLocationChange={setLocation}
              onHotspotChange={setHotspot}
              onVersionChange={setVersion}
              onDateRangeChange={setDateRange}
              versions={versions}
            />
          </div>

          {/* KPI Cards */}
          <AccuracyKPICards
            meanAbsError={overview?.meanAbsError ?? null}
            hitRate1pt={overview?.hitRate1pt ?? null}
            hitRate2pt={overview?.hitRate2pt ?? null}
            totalBlocks={overview?.totalBlocks ?? 0}
            totalDays={overview?.totalDays ?? 0}
            trendDirection={overview?.trendDirection ?? 'stable'}
            totalCatches={overview?.totalCatches ?? 0}
            totalLanded={overview?.totalLanded ?? 0}
            loading={loadingOverview}
          />

          {/* Predicted vs Actual Chart */}
          <PredictedVsActualChart
            data={dailyData}
            loading={loadingDaily}
          />

          {/* Two-column layout for factor errors and rolling accuracy */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Factor Error Breakdown */}
            <FactorErrorChart
              data={factorData}
              loading={loadingFactors}
            />

            {/* Rolling Accuracy Trend */}
            <RollingAccuracyChart
              data={dailyData}
              loading={loadingDaily}
            />
          </div>

          {/* Data Collection Status */}
          <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
            <h3 className="text-sm font-semibold text-rc-text mb-3">Pipeline Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusCard
                label="Prediction Snapshots"
                description="Captured daily at 2 AM UTC for all 14 hotspots"
                endpoint="POST /api/admin/accuracy/capture-predictions"
              />
              <StatusCard
                label="Historical Actuals"
                description="Fetched from Open Meteo Archive + CHS observed data"
                endpoint="POST /api/admin/accuracy/fetch-actuals"
              />
              <StatusCard
                label="Accuracy Comparisons"
                description="Per-day, per-hotspot predicted vs actual metrics"
                endpoint="POST /api/admin/accuracy/compute-comparisons"
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function StatusCard({ label, description, endpoint }: {
  label: string
  description: string
  endpoint: string
}) {
  return (
    <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-3">
      <p className="text-sm font-medium text-rc-text">{label}</p>
      <p className="text-xs text-rc-text-muted mt-1">{description}</p>
      <code className="text-xs text-blue-400/70 mt-2 block">{endpoint}</code>
    </div>
  )
}
