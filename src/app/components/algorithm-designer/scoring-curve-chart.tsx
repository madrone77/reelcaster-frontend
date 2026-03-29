'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { ScoringCurve } from '@/app/utils/scoringCurves'
import { evaluateCurve } from '@/app/utils/scoringCurves'

interface ScoringCurveChartProps {
  curve: ScoringCurve
  defaultCurve: ScoringCurve
  color: string
  avgInput: number | null
}

export default function ScoringCurveChart({
  curve,
  defaultCurve,
  color,
  avgInput,
}: ScoringCurveChartProps) {
  const data = useMemo(() => {
    const [min, max] = curve.inputRange
    const step = (max - min) / 100
    const points: { input: number; custom: number; default: number }[] = []

    // Sample at fine intervals + at each breakpoint
    const sampleInputs = new Set<number>()
    for (let x = min; x <= max; x += step) {
      sampleInputs.add(Math.round(x * 100) / 100)
    }
    for (const bp of curve.breakpoints) sampleInputs.add(bp.input)
    for (const bp of defaultCurve.breakpoints) sampleInputs.add(bp.input)

    const sorted = Array.from(sampleInputs).sort((a, b) => a - b)
    for (const x of sorted) {
      points.push({
        input: x,
        custom: evaluateCurve(curve, x),
        default: evaluateCurve(defaultCurve, x),
      })
    }

    return points
  }, [curve, defaultCurve])

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="input"
            type="number"
            domain={[curve.inputRange[0], curve.inputRange[1]]}
            tick={{ fill: '#aaa', fontSize: 11 }}
            label={{
              value: `${curve.inputLabel} (${curve.inputUnit})`,
              position: 'insideBottomRight',
              offset: -4,
              fill: '#aaa',
              fontSize: 11,
            }}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: '#aaa', fontSize: 11 }}
            width={30}
          />

          {/* Quality threshold lines */}
          <ReferenceLine y={8} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.3} />
          <ReferenceLine y={6} stroke="#3b82f6" strokeDasharray="4 4" strokeOpacity={0.3} />
          <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} />

          {/* Current average input */}
          {avgInput !== null && (
            <ReferenceLine
              x={avgInput}
              stroke="#fbbf24"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `avg: ${avgInput.toFixed(1)}`,
                position: 'top',
                fill: '#fbbf24',
                fontSize: 10,
              }}
            />
          )}

          <Tooltip
            contentStyle={{
              backgroundColor: '#2B2B2B',
              border: '1px solid #333',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `${curve.inputLabel}: ${Number(v).toFixed(1)} ${curve.inputUnit}`}
            formatter={(value: number, name: string) => [
              value.toFixed(1),
              name === 'custom' ? 'Custom' : 'Default',
            ]}
          />

          {/* Default curve (dashed, white) */}
          <Line
            dataKey="default"
            type="monotone"
            stroke="#fff"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />

          {/* Custom curve (solid, factor color) */}
          <Line
            dataKey="custom"
            type="monotone"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Overlay breakpoint dots using absolute positioning isn't practical with Recharts.
          Instead, we render them in the chart as a second tiny dataset isn't trivial.
          The breakpoint positions are visible from the curve shape + the editor table. */}
    </div>
  )
}
