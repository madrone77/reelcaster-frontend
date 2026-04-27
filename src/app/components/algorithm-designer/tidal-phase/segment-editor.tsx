'use client'

import { useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { PhaseSegment, TideHalfCycle } from '@/app/utils/tidalPhaseScoring'
import { HALF_CYCLE_COLORS } from '@/app/utils/tidalPhaseScoring'

interface SegmentEditorProps {
  halfCycle: TideHalfCycle
  segments: PhaseSegment[]
  onSegmentsChange: (segments: PhaseSegment[]) => void
}

export default function SegmentEditor({
  halfCycle,
  segments,
  onSegmentsChange,
}: SegmentEditorProps) {
  const color = HALF_CYCLE_COLORS[halfCycle]

  // Internal boundaries = all startPct values except the first (which is always 0)
  const boundaries = segments.slice(1).map((s) => s.startPct)

  const handleBoundaryChange = useCallback(
    (newBoundaries: number[]) => {
      // Reconstruct segments from boundaries
      const sorted = [...newBoundaries].sort((a, b) => a - b)
      const allPoints = [0, ...sorted, 100]
      const updated: PhaseSegment[] = segments.map((seg, i) => ({
        ...seg,
        startPct: allPoints[i],
        endPct: allPoints[i + 1],
      }))
      onSegmentsChange(updated)
    },
    [segments, onSegmentsChange],
  )

  const handleScoreChange = useCallback(
    (index: number, value: string) => {
      const num = parseFloat(value)
      if (isNaN(num)) return
      const updated = segments.map((seg, i) =>
        i === index ? { ...seg, score: Math.min(10, Math.max(0, num)) } : seg,
      )
      onSegmentsChange(updated)
    },
    [segments, onSegmentsChange],
  )

  const handleNameChange = useCallback(
    (index: number, name: string) => {
      const updated = segments.map((seg, i) =>
        i === index ? { ...seg, name } : seg,
      )
      onSegmentsChange(updated)
    },
    [segments, onSegmentsChange],
  )

  const addSegment = useCallback(() => {
    // Find largest segment and split it in half
    let largestIdx = 0
    let largestSpan = 0
    segments.forEach((seg, i) => {
      const span = seg.endPct - seg.startPct
      if (span > largestSpan) {
        largestSpan = span
        largestIdx = i
      }
    })

    const target = segments[largestIdx]
    const midPct = Math.round((target.startPct + target.endPct) / 2 / 5) * 5

    if (midPct <= target.startPct || midPct >= target.endPct) return

    const newId = `${halfCycle}-${Date.now()}`
    const first: PhaseSegment = { ...target, endPct: midPct }
    const second: PhaseSegment = {
      id: newId,
      name: `New ${halfCycle === 'flood' ? 'Flood' : 'Ebb'}`,
      startPct: midPct,
      endPct: target.endPct,
      score: target.score,
    }

    const updated = [...segments]
    updated.splice(largestIdx, 1, first, second)
    onSegmentsChange(updated)
  }, [segments, halfCycle, onSegmentsChange])

  const removeSegment = useCallback(
    (index: number) => {
      if (segments.length <= 1) return
      const updated = [...segments]
      const removed = updated.splice(index, 1)[0]

      // Expand neighbor to fill gap
      if (index > 0) {
        updated[index - 1] = { ...updated[index - 1], endPct: removed.endPct }
      } else if (updated.length > 0) {
        updated[0] = { ...updated[0], startPct: removed.startPct }
      }

      onSegmentsChange(updated)
    },
    [segments, onSegmentsChange],
  )

  return (
    <div className="space-y-3">
      {/* Boundary slider (only when >1 segment) */}
      {segments.length > 1 && (
        <div className="px-1">
          <Slider
            value={boundaries}
            min={5}
            max={95}
            step={5}
            onValueChange={handleBoundaryChange}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-rc-text-muted">0%</span>
            <span className="text-[10px] text-rc-text-muted">100%</span>
          </div>
        </div>
      )}

      {/* Segment rows */}
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div
            key={seg.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-1.5 px-2 rounded-lg bg-rc-bg-darkest"
          >
            {/* Name */}
            <input
              type="text"
              value={seg.name}
              onChange={(e) => handleNameChange(i, e.target.value)}
              className="bg-transparent text-sm text-rc-text border-none outline-none min-w-0"
            />

            {/* Range badge */}
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {seg.startPct}–{seg.endPct}%
            </span>

            {/* Score */}
            <Input
              type="number"
              step="0.5"
              min={0}
              max={10}
              value={seg.score}
              onChange={(e) => handleScoreChange(i, e.target.value)}
              className="h-7 w-16 text-sm font-mono text-center"
            />

            {/* Delete */}
            <button
              onClick={() => removeSegment(i)}
              disabled={segments.length <= 1}
              className="w-6 h-6 flex items-center justify-center rounded text-rc-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add segment */}
      <button
        onClick={addSegment}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rc-text-muted hover:text-rc-text bg-rc-bg-light rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Segment
      </button>
    </div>
  )
}
