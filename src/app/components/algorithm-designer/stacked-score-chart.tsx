'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import {
  FACTOR_META,
  FACTOR_META_MAP,
  type FactorKey,
  type FactorState,
} from '@/app/utils/algorithmDesigner'

export interface ChartDataPoint {
  time: string
  originalScore: number
  [factorKey: string]: number | string
}

interface StackedScoreChartProps {
  data: ChartDataPoint[]
  factorStates: Record<FactorKey, FactorState>
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  // Gather factor contributions (skip the line dataKey)
  const factors: { key: string; name: string; color: string; value: number }[] = []
  let customTotal = 0
  let originalScore = 0

  for (const entry of payload) {
    if (entry.dataKey === 'originalScore') {
      originalScore = entry.value
      continue
    }
    const meta = FACTOR_META_MAP[entry.dataKey as FactorKey]
    if (!meta) continue
    if (entry.value > 0) {
      factors.push({
        key: entry.dataKey,
        name: meta.name,
        color: meta.color,
        value: entry.value,
      })
      customTotal += entry.value
    }
  }

  factors.sort((a, b) => b.value - a.value)
  const top5 = factors.slice(0, 5)
  const remaining = factors.length - 5

  const delta = customTotal - originalScore
  const deltaStr =
    delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? delta.toFixed(1) : '0.0'

  return (
    <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-3 shadow-lg text-sm min-w-[180px]">
      <p className="font-semibold text-rc-text mb-2">{label}</p>
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-rc-text-muted">Custom:</span>
        <span className="text-blue-400 font-medium">
          {customTotal.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-rc-text-muted">Original:</span>
        <span className="text-rc-text font-medium">
          {originalScore.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 mb-3 pb-2 border-b border-rc-bg-light">
        <span className="text-rc-text-muted">Delta:</span>
        <span
          className={`font-medium ${
            delta > 0
              ? 'text-emerald-400'
              : delta < 0
                ? 'text-red-400'
                : 'text-rc-text'
          }`}
        >
          {deltaStr}
        </span>
      </div>
      {top5.map((f) => (
        <div
          key={f.key}
          className="flex items-center gap-2 py-0.5"
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: f.color }}
          />
          <span className="text-rc-text-muted text-xs flex-1 truncate">
            {f.name}
          </span>
          <span className="text-rc-text-light text-xs font-mono">
            {f.value.toFixed(2)}
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-xs text-rc-text-muted mt-1">
          and {remaining} more...
        </p>
      )}
    </div>
  )
}

export default function StackedScoreChart({
  data,
  factorStates,
}: StackedScoreChartProps) {
  const enabledFactors = FACTOR_META.filter((f) => factorStates[f.key].enabled)

  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-rc-text">
          Score Breakdown by Factor
        </h2>
        <p className="text-sm text-rc-text-muted">
          Each bar shows how individual factors contribute to the total score
        </p>
      </div>

      {/* Fix #8: Empty state when all factors disabled */}
      {enabledFactors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <BarChart3 className="w-12 h-12 text-rc-text-muted mb-4" />
          <h3 className="text-lg font-medium text-rc-text mb-2">No Factors Enabled</h3>
          <p className="text-sm text-rc-text-muted">
            Enable at least one factor in the weight panel to see the chart.
          </p>
        </div>
      ) : (
      <>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-rc-bg-light)"
            />
            <XAxis
              dataKey="time"
              stroke="#AAAAAA"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={[0, 10]}
              stroke="#AAAAAA"
              tick={{ fontSize: 12 }}
            />

            {/* Reference lines */}
            <ReferenceLine
              y={8}
              stroke="#22c55e"
              strokeDasharray="5 5"
              strokeOpacity={0.3}
              label={{ value: 'Excellent', fill: '#22c55e', fontSize: 10, position: 'right', opacity: 0.5 }}
            />
            <ReferenceLine
              y={6}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeOpacity={0.3}
              label={{ value: 'Good', fill: '#f59e0b', fontSize: 10, position: 'right', opacity: 0.5 }}
            />
            <ReferenceLine
              y={4}
              stroke="#f97316"
              strokeDasharray="5 5"
              strokeOpacity={0.3}
              label={{ value: 'Fair', fill: '#f97316', fontSize: 10, position: 'right', opacity: 0.5 }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Stacked bars — one per enabled factor */}
            {enabledFactors.map((meta, idx) => (
              <Bar
                key={meta.key}
                dataKey={meta.key}
                stackId="score"
                fill={meta.color}
                name={meta.name}
                radius={
                  idx === enabledFactors.length - 1 ? [3, 3, 0, 0] : undefined
                }
              />
            ))}

            {/* Original score comparison line */}
            <Line
              type="monotone"
              dataKey="originalScore"
              stroke="#ffffff"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Original Score"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-4">
        {enabledFactors.map((meta) => (
          <div key={meta.key} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            <span className="text-xs text-rc-text-muted">{meta.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 border-t-2 border-dashed border-white" />
          <span className="text-xs text-rc-text-muted">Original Score</span>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
