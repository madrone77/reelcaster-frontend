'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

interface FactorError {
  factor: string
  label: string
  avgPredicted: number
  avgActual: number
  avgError: number
  absError: number
  dataPoints: number
}

interface FactorErrorChartProps {
  data: FactorError[]
  loading: boolean
}

export default function FactorErrorChart({ data, loading }: FactorErrorChartProps) {
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
        <h3 className="text-sm font-semibold text-rc-text mb-4">Factor Error Breakdown</h3>
        <div className="text-center py-12">
          <p className="text-sm text-rc-text-muted">No factor data available yet.</p>
        </div>
      </div>
    )
  }

  // Sort by absolute error descending
  const sortedData = [...data].sort((a, b) => b.absError - a.absError)

  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-rc-text">Factor Error Breakdown</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-500/50 rounded-sm" />
            <span className="text-rc-text-muted">Overpredicted</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-blue-500/50 rounded-sm" />
            <span className="text-rc-text-muted">Underpredicted</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(300, sortedData.length * 28)}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#aaa' }}
            tickLine={false}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: '#aaa' }}
            tickLine={false}
            axisLine={false}
            width={75}
          />
          <Tooltip content={<FactorTooltip />} />
          <ReferenceLine x={0} stroke="#555" />
          <Bar dataKey="avgError" radius={[0, 4, 4, 0]}>
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.avgError > 0 ? '#f59e0b80' : '#3b82f680'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FactorTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null

  const data = payload[0]?.payload as FactorError
  return (
    <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-rc-text mb-1">{data.label}</p>
      <p className="text-xs text-rc-text-muted">
        Predicted: <span className="text-blue-400">{data.avgPredicted.toFixed(1)}</span>
        {' '}| Actual: <span className="text-emerald-400">{data.avgActual.toFixed(1)}</span>
      </p>
      <p className={`text-xs mt-1 ${data.avgError > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
        Error: {data.avgError > 0 ? '+' : ''}{data.avgError.toFixed(2)}
        {data.avgError > 0 ? ' (overpredicted)' : ' (underpredicted)'}
      </p>
      <p className="text-xs text-rc-text-muted mt-1">{data.dataPoints} data points</p>
    </div>
  )
}
