'use client'

import { ArrowLeft, RotateCcw } from 'lucide-react'
import { FACTOR_META_MAP, type FactorKey } from '@/app/utils/algorithmDesigner'
import type { ScoringCurve } from '@/app/utils/scoringCurves'
import RawDataTimeline, { type TimelineBlock } from './raw-data-timeline'
import ScoringCurveChart from './scoring-curve-chart'
import BreakpointEditor from './breakpoint-editor'

interface FactorDrillDownProps {
  factorKey: FactorKey
  onClose: () => void
  curve: ScoringCurve
  defaultCurve: ScoringCurve
  onCurveChange: (curve: ScoringCurve) => void
  onReset: () => void
  blocks: TimelineBlock[]
  avgInput: number | null
}

export default function FactorDrillDown({
  factorKey,
  onClose,
  curve,
  defaultCurve,
  onCurveChange,
  onReset,
  blocks,
  avgInput,
}: FactorDrillDownProps) {
  const meta = FACTOR_META_MAP[factorKey]
  const Icon = meta.icon
  const isSpecies = factorKey === 'species'
  const hasCustom = JSON.stringify(curve.breakpoints) !== JSON.stringify(defaultCurve.breakpoints)

  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl overflow-hidden">
      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-rc-bg-light flex items-center gap-3">
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-rc-text-muted hover:text-rc-text hover:bg-rc-bg-light transition-colors shrink-0"
          title="Close drill-down"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${meta.color}20` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-rc-text">{meta.name}</h3>
          <p className="text-xs text-rc-text-muted truncate">{curve.description}</p>
        </div>

        {hasCustom && !isSpecies && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-rc-text-muted hover:text-rc-text bg-rc-bg-light rounded-lg transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="p-4 space-y-4">
        {/* Top row: two charts side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
              Raw Data + Score
            </h4>
            <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-2">
              <RawDataTimeline
                blocks={blocks}
                color={meta.color}
                inputLabel={curve.inputLabel}
                inputUnit={curve.inputUnit}
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
              Scoring Curve
            </h4>
            <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-2">
              {isSpecies ? (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-xs text-rc-text-muted text-center px-4">
                    Composite modifier from species profiles — not a single-input curve.
                  </p>
                </div>
              ) : (
                <ScoringCurveChart
                  curve={curve}
                  defaultCurve={defaultCurve}
                  color={meta.color}
                  avgInput={avgInput}
                />
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: breakpoints + modifiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
              Breakpoints
            </h4>
            <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-3">
              {isSpecies ? (
                <p className="text-xs text-rc-text-muted text-center py-3">
                  Uses multi-factor species profiles. Not directly editable here.
                </p>
              ) : (
                <BreakpointEditor curve={curve} onChange={onCurveChange} />
              )}
            </div>
          </div>

          {curve.modifiers && curve.modifiers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
                Modifiers
              </h4>
              <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-3">
                <ul className="space-y-2">
                  {curve.modifiers.map((mod, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-rc-text-muted leading-relaxed"
                    >
                      <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-rc-text-muted/40" />
                      {mod}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
