'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface DailyDataPoint {
  date: string
  avgPredicted: number
  avgActual: number
  delta: number
  blocksCompared: number
}

interface RollingAccuracyChartProps {
  data: DailyDataPoint[]
  loading: boolean
  windowSize?: number
}

export default function RollingAccuracyChart({
  data,
  loading,
  windowSize = 7,
}: RollingAccuracyChartProps) {
  if (loading) {
    return (
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="h-4 w-48 bg-rc-bg-light rounded mb-4" />
        <div className="h-48 bg-rc-bg-light rounded animate-pulse" />
      </div>
    )
  }

  if (data.length < windowSize) {
    return (
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <h3 className="text-sm font-semibold text-rc-text mb-4">Rolling Accuracy Trend ({windowSize}-day window)</h3>
        <div className="text-center py-8">
          <p className="text-sm text-rc-text-muted">
            Need at least {windowSize} days of data. Currently have {data.length}.
          </p>
        </div>
      </div>
    )
  }

  // Compute rolling average of absolute error
  const chartData = data.map((d, i) => {
    if (i < windowSize - 1) return null

    const window = data.slice(i - windowSize + 1, i + 1)
    const avgAbsError = window.reduce((s, w) => s + Math.abs(w.delta), 0) / window.length
    const hitRate = window.filter(w => Math.abs(w.delta) <= 1.0).length / window.length * 100

    return {
      date: formatDate(d.date),
      rawDate: d.date,
      rollingError: Math.round(avgAbsError * 100) / 100,
      rollingHitRate: Math.round(hitRate),
    }
  }).filter(Boolean) as { date: string; rawDate: string; rollingError: number; rollingHitRate: number }[]

  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
      <h3 className="text-sm font-semibold text-rc-text mb-4">
        Rolling Accuracy Trend ({windowSize}-day window)
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#aaa' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#aaa' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<RollingTooltip />} />
          <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" label="" />
          <Area
            type="monotone"
            dataKey="rollingHitRate"
            stroke="#3b82f6"
            fill="#3b82f620"
            strokeWidth={2}
            name="Hit Rate (±1pt)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function RollingTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null

  const data = payload[0]?.payload
  return (
    <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-3 shadow-lg">
      <p className="text-xs text-rc-text-muted mb-1">{data?.rawDate}</p>
      <p className="text-sm text-blue-400">
        Hit Rate: <span className="font-semibold">{data?.rollingHitRate}%</span>
      </p>
      <p className="text-sm text-rc-text-muted">
        Avg Error: <span className="font-semibold">{data?.rollingError?.toFixed(2)}</span> pts
      </p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
