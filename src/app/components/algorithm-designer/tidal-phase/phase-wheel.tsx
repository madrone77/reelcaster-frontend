'use client'

import { useMemo } from 'react'
import type { PhaseProfile, TideHalfCycle } from '@/app/utils/tidalPhaseScoring'
import { HALF_CYCLE_COLORS, SLACK_COLOR } from '@/app/utils/tidalPhaseScoring'

interface PhaseWheelProps {
  profile: PhaseProfile
  currentPhase?: number
  currentHalfCycle?: TideHalfCycle
  size?: number
}

/**
 * SVG circular visualization of the full tidal cycle.
 * Top half = flood (teal), bottom half = ebb (amber).
 * Arc opacity = score/10 per segment.
 * Slack zones as thin arcs at 12 o'clock (high) and 6 o'clock (low).
 */
export default function PhaseWheel({
  profile,
  currentPhase,
  currentHalfCycle,
  size = 180,
}: PhaseWheelProps) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8 // padding for labels
  const slackR = r - 4   // slightly inner ring for slack

  // Build arc data for all segments + slack zones
  const arcs = useMemo(() => {
    const result: {
      startAngle: number
      endAngle: number
      color: string
      opacity: number
      label: string
      isSlack: boolean
      radius: number
    }[] = []

    // Flood = top half: -90° (12 o'clock) to +90° (6 o'clock) going clockwise (right side)
    // But we want: high tide at top (12 o'clock), low tide at bottom (6 o'clock)
    // Flood (low→high): bottom-right to top, 180° to 360° (6 o'clock up to 12 o'clock, right side)
    // Ebb (high→low): top to bottom, 0° to 180° (12 o'clock down to 6 o'clock, right side)

    // Actually simpler: treat it as a clock.
    // 12 o'clock = HIGH TIDE = 0°
    // 6 o'clock = LOW TIDE = 180°
    // Flood goes from LOW (180°) to HIGH (360°/0°) — right half
    // Ebb goes from HIGH (0°) to LOW (180°) — left half...
    //
    // Let's use: Ebb on the right side (clockwise from top), Flood on the left side
    // Or simpler: Flood = right half (0° to 180°), Ebb = left half (180° to 360°)
    // With HIGH at top (0°) and LOW at bottom (180°)

    // Convention:
    // HIGH TIDE at top (0° / 12 o'clock)
    // LOW TIDE at bottom (180° / 6 o'clock)
    // EBB: high→low = 0°→180° (right side, clockwise)
    // FLOOD: low→high = 180°→360° (left side, clockwise)

    const addSegments = (
      segments: typeof profile.flood,
      halfCycle: TideHalfCycle,
      startDeg: number,
      endDeg: number,
    ) => {
      const span = endDeg - startDeg
      for (const seg of segments) {
        const segStart = startDeg + (seg.startPct / 100) * span
        const segEnd = startDeg + (seg.endPct / 100) * span
        result.push({
          startAngle: segStart,
          endAngle: segEnd,
          color: HALF_CYCLE_COLORS[halfCycle],
          opacity: 0.15 + (seg.score / 10) * 0.85, // min 0.15 so empty arcs are visible
          label: seg.name,
          isSlack: false,
          radius: r,
        })
      }
    }

    // Ebb segments: 0°→180° (right side)
    addSegments(profile.ebb, 'ebb', 0, 180)
    // Flood segments: 180°→360° (left side)
    addSegments(profile.flood, 'flood', 180, 360)

    // Slack zones (thinner, on inner ring)
    // High slack at 0° (top)
    if (profile.slackHigh.enabled) {
      const slackSpan = (profile.slackHigh.durationPct / 100) * 180 // degrees
      // End of flood → start of ebb
      result.push({
        startAngle: 360 - slackSpan,
        endAngle: 360 + slackSpan,
        color: SLACK_COLOR,
        opacity: 0.15 + (profile.slackHigh.score / 10) * 0.85,
        label: 'High Slack',
        isSlack: true,
        radius: slackR,
      })
    }

    // Low slack at 180° (bottom)
    if (profile.slackLow.enabled) {
      const slackSpan = (profile.slackLow.durationPct / 100) * 180
      result.push({
        startAngle: 180 - slackSpan,
        endAngle: 180 + slackSpan,
        color: SLACK_COLOR,
        opacity: 0.15 + (profile.slackLow.score / 10) * 0.85,
        label: 'Low Slack',
        isSlack: true,
        radius: slackR,
      })
    }

    return result
  }, [profile, r, slackR])

  // Current phase needle
  const needleAngle = useMemo(() => {
    if (currentPhase === undefined || !currentHalfCycle) return null
    // Ebb: 0°→180°, Flood: 180°→360°
    if (currentHalfCycle === 'ebb') return currentPhase * 180
    return 180 + currentPhase * 180
  }, [currentPhase, currentHalfCycle])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#333" strokeWidth={1} />

      {/* Segment arcs */}
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={describeArc(cx, cy, arc.radius, arc.startAngle - 90, arc.endAngle - 90)}
          fill="none"
          stroke={arc.color}
          strokeWidth={arc.isSlack ? 6 : 14}
          strokeLinecap="butt"
          opacity={arc.opacity}
        />
      ))}

      {/* Labels: HIGH at top, LOW at bottom */}
      <text x={cx} y={14} textAnchor="middle" fill="#aaa" fontSize={9} fontWeight={600}>
        HIGH
      </text>
      <text x={cx} y={size - 6} textAnchor="middle" fill="#aaa" fontSize={9} fontWeight={600}>
        LOW
      </text>

      {/* Half-cycle labels */}
      <text x={size - 6} y={cy + 3} textAnchor="end" fill={HALF_CYCLE_COLORS.ebb} fontSize={8} opacity={0.7}>
        Ebb
      </text>
      <text x={8} y={cy + 3} textAnchor="start" fill={HALF_CYCLE_COLORS.flood} fontSize={8} opacity={0.7}>
        Flood
      </text>

      {/* Current phase needle */}
      {needleAngle !== null && (
        <>
          <line
            x1={cx}
            y1={cy}
            x2={cx + (r - 20) * Math.cos(((needleAngle - 90) * Math.PI) / 180)}
            y2={cy + (r - 20) * Math.sin(((needleAngle - 90) * Math.PI) / 180)}
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.8}
          />
          <circle cx={cx} cy={cy} r={3} fill="#fff" opacity={0.8} />
        </>
      )}
    </svg>
  )
}

/** SVG arc path descriptor. Angles in degrees, 0 = top (12 o'clock). */
function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}
