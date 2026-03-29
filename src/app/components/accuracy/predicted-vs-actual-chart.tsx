'use client'

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from 'recharts'

interface DailyDataPoint {
  date: string
  avgPredicted: number
  avgActual: number
  delta: number
  blocksCompared: number
  catchCount: number
}

interface PredictedVsActualChartProps {
  data: DailyDataPoint[]
  loading: boolean
}

export default function PredictedVsActualChart({ data, loading }: PredictedVsActualChartProps) {
  if (loading) {
    return (
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="h-4 w-48 bg-rc-bg-light rounded mb-4" />
        <div className="h-64 bg-rc-bg-light rounded animate-pulse" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <h3 className="text-sm font-semibold text-rc-text mb-4">Predicted vs Actual Score</h3>
        <div className="text-center py-12">
          <p className="text-sm text-rc-text-muted">No comparison data available yet.</p>
          <p className="text-xs text-rc-text-muted mt-1">Data will appear after the daily pipeline runs.</p>
        </div>
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    date: formatDate(d.date),
    rawDate: d.date,
  }))

  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-rc-text">Predicted vs Actual Score</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-500 rounded" />
            <span className="text-rc-text-muted">Predicted</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 rounded" />
            <span className="text-rc-text-muted">Actual</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#aaa' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: '#aaa' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={5} stroke="#555" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="avgPredicted"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            name="Predicted"
          />
          <Line
            type="monotone"
            dataKey="avgActual"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981' }}
            name="Actual"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const data = payload[0]?.payload
  return (
    <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-3 shadow-lg">
      <p className="text-xs text-rc-text-muted mb-2">{data?.rawDate || label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{entry.value?.toFixed(1)}</span>
        </p>
      ))}
      {data?.delta !== undefined && (
        <p className={`text-xs mt-1 ${data.delta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
          Delta: {data.delta > 0 ? '+' : ''}{data.delta.toFixed(1)}
        </p>
      )}
      {data?.catchCount > 0 && (
        <p className="text-xs text-rc-text-muted mt-1">
          Catches: {data.catchCount}
        </p>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
