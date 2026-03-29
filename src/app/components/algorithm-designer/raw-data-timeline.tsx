'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface TimelineBlock {
  time: string
  rawInput: number | null
  productionScore: number
  customScore: number
}

interface RawDataTimelineProps {
  blocks: TimelineBlock[]
  color: string
  inputLabel: string
  inputUnit: string
}

export default function RawDataTimeline({
  blocks,
  color,
  inputLabel,
  inputUnit,
}: RawDataTimelineProps) {
  // Filter out blocks where rawInput is null for Y-axis domain calc
  const rawValues = blocks.map((b) => b.rawInput).filter((v): v is number => v !== null)
  const maxRaw = rawValues.length > 0 ? Math.max(...rawValues) * 1.2 : 10
  const minRaw = rawValues.length > 0 ? Math.min(0, Math.min(...rawValues)) : 0

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={blocks} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />

          <XAxis dataKey="time" tick={{ fill: '#aaa', fontSize: 11 }} />

          {/* Left Y: Raw input values */}
          <YAxis
            yAxisId="raw"
            orientation="left"
            domain={[minRaw, maxRaw]}
            tick={{ fill: '#aaa', fontSize: 11 }}
            width={40}
            label={{
              value: inputUnit,
              angle: -90,
              position: 'insideLeft',
              fill: '#aaa',
              fontSize: 10,
              offset: 10,
            }}
          />

          {/* Right Y: Score 0-10 */}
          <YAxis
            yAxisId="score"
            orientation="right"
            domain={[0, 10]}
            tick={{ fill: '#aaa', fontSize: 11 }}
            width={30}
            label={{
              value: 'Score',
              angle: 90,
              position: 'insideRight',
              fill: '#aaa',
              fontSize: 10,
              offset: 10,
            }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#2B2B2B',
              border: '1px solid #333',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              if (name === 'rawInput')
                return [
                  `${value !== null ? value.toFixed(1) : '—'} ${inputUnit}`,
                  inputLabel,
                ]
              if (name === 'productionScore') return [value.toFixed(1), 'Production']
              if (name === 'customScore') return [value.toFixed(1), 'Custom']
              return [value, name]
            }}
          />

          {/* Bars: Raw input values */}
          <Bar
            yAxisId="raw"
            dataKey="rawInput"
            fill={color}
            fillOpacity={0.4}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />

          {/* Dashed line: Production score */}
          <Line
            yAxisId="score"
            dataKey="productionScore"
            type="monotone"
            stroke="#fff"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />

          {/* Solid line: Custom score */}
          <Line
            yAxisId="score"
            dataKey="customScore"
            type="monotone"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
