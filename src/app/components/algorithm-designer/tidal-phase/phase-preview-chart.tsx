'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { TideHalfCycle } from '@/app/utils/tidalPhaseScoring'
import { HALF_CYCLE_COLORS, SLACK_COLOR } from '@/app/utils/tidalPhaseScoring'

export interface PhaseTimelineBlock {
  time: string
  timestamp: number
  tideHeight: number
  score: number
  halfCycle: TideHalfCycle
  phase: number
  inSlack: boolean
  segmentName: string
}

interface PhasePreviewChartProps {
  blocks: PhaseTimelineBlock[]
  tideEvents?: { timestamp: number; height: number; type: 'high' | 'low' }[]
}

export default function PhasePreviewChart({
  blocks,
  tideEvents,
}: PhasePreviewChartProps) {
  // Compute domains
  const heights = blocks.map((b) => b.tideHeight)
  const minH = Math.min(...heights) - 0.3
  const maxH = Math.max(...heights) + 0.3

  // Build data with fill colors
  const data = blocks.map((b) => ({
    ...b,
    fillColor: b.inSlack
      ? SLACK_COLOR
      : HALF_CYCLE_COLORS[b.halfCycle],
  }))

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />

          <XAxis dataKey="time" tick={{ fill: '#aaa', fontSize: 11 }} />

          {/* Left Y: Tide height */}
          <YAxis
            yAxisId="height"
            orientation="left"
            domain={[minH, maxH]}
            tick={{ fill: '#aaa', fontSize: 11 }}
            width={35}
            label={{
              value: 'm',
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
          />

          {/* Quality threshold lines */}
          <ReferenceLine yAxisId="score" y={8} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.2} />
          <ReferenceLine yAxisId="score" y={4} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.2} />

          {/* Tide events as reference lines */}
          {tideEvents?.map((evt, i) => {
            const matchingBlock = blocks.find(
              (b) => Math.abs(b.timestamp - evt.timestamp) < 7200,
            )
            if (!matchingBlock) return null
            return (
              <ReferenceLine
                key={i}
                yAxisId="height"
                x={matchingBlock.time}
                stroke="#555"
                strokeDasharray="3 3"
                label={{
                  value: evt.type === 'high' ? 'H' : 'L',
                  position: 'top',
                  fill: '#888',
                  fontSize: 9,
                }}
              />
            )
          })}

          <Tooltip
            contentStyle={{
              backgroundColor: '#2B2B2B',
              border: '1px solid #333',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              if (name === 'tideHeight') return [`${value.toFixed(2)} m`, 'Tide Height']
              if (name === 'score') return [value.toFixed(1), 'Phase Score']
              return [value, name]
            }}
          />

          {/* Tide height area */}
          <Area
            yAxisId="height"
            dataKey="tideHeight"
            type="monotone"
            fill="#3b82f6"
            fillOpacity={0.15}
            stroke="#3b82f6"
            strokeWidth={1.5}
            isAnimationActive={false}
          />

          {/* Phase score line */}
          <Line
            yAxisId="score"
            dataKey="score"
            type="stepAfter"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#14b8a6' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
