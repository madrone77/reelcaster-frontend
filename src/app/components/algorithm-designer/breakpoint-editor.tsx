'use client'

import { useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { CurveBreakpoint, ScoringCurve } from '@/app/utils/scoringCurves'

interface BreakpointEditorProps {
  curve: ScoringCurve
  onChange: (curve: ScoringCurve) => void
  disabled?: boolean
}

export default function BreakpointEditor({ curve, onChange, disabled }: BreakpointEditorProps) {
  const updateBreakpoint = useCallback(
    (index: number, field: 'input' | 'score', value: string) => {
      const num = parseFloat(value)
      if (isNaN(num)) return

      const updated = curve.breakpoints.map((bp, i) =>
        i === index
          ? {
              ...bp,
              [field]: field === 'score' ? Math.min(10, Math.max(0, num)) : num,
            }
          : bp,
      )

      // Sort by input ascending
      updated.sort((a, b) => a.input - b.input)
      onChange({ ...curve, breakpoints: updated })
    },
    [curve, onChange],
  )

  const removeBreakpoint = useCallback(
    (index: number) => {
      if (curve.breakpoints.length <= 2) return // Need at least 2
      const updated = curve.breakpoints.filter((_, i) => i !== index)
      onChange({ ...curve, breakpoints: updated })
    },
    [curve, onChange],
  )

  const addBreakpoint = useCallback(() => {
    const bps = curve.breakpoints
    // Insert at midpoint of the range
    const lastInput = bps.length > 0 ? bps[bps.length - 1].input : 0
    const firstInput = bps.length > 0 ? bps[0].input : 0
    const newInput = Math.round(((lastInput + firstInput) / 2) * 10) / 10

    // Check for duplicate
    if (bps.some((bp) => bp.input === newInput)) return

    const newBp: CurveBreakpoint = { input: newInput, score: 5 }
    const updated = [...bps, newBp].sort((a, b) => a.input - b.input)
    onChange({ ...curve, breakpoints: updated })
  }, [curve, onChange])

  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
        <span className="text-xs font-medium text-rc-text-muted px-1">
          Input ({curve.inputUnit || '—'})
        </span>
        <span className="text-xs font-medium text-rc-text-muted px-1">Score (0-10)</span>
        <span className="w-7" />
      </div>

      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
        {curve.breakpoints.map((bp, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <Input
              type="number"
              step="any"
              value={bp.input}
              disabled={disabled}
              onChange={(e) => updateBreakpoint(i, 'input', e.target.value)}
              className="h-8 text-sm font-mono"
            />
            <Input
              type="number"
              step="0.1"
              min={0}
              max={10}
              value={bp.score}
              disabled={disabled}
              onChange={(e) => updateBreakpoint(i, 'score', e.target.value)}
              className="h-8 text-sm font-mono"
            />
            <button
              onClick={() => removeBreakpoint(i)}
              disabled={disabled || curve.breakpoints.length <= 2}
              className="w-7 h-7 flex items-center justify-center rounded-md text-rc-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addBreakpoint}
        disabled={disabled}
        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs text-rc-text-muted hover:text-rc-text bg-rc-bg-light rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Breakpoint
      </button>
    </div>
  )
}
