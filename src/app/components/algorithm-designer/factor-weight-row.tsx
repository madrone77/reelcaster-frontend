'use client'

import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import type { FactorMeta, FactorState } from '@/app/utils/algorithmDesigner'

interface FactorWeightRowProps {
  meta: FactorMeta
  state: FactorState
  normalizedPct: number
  avgScore: number | null
  onToggle: (enabled: boolean) => void
  onWeightChange: (value: number) => void
}

export default function FactorWeightRow({
  meta,
  state,
  normalizedPct,
  avgScore,
  onToggle,
  onWeightChange,
}: FactorWeightRowProps) {
  const Icon = meta.icon

  return (
    <div
      className={`py-3 border-b border-rc-bg-light last:border-0 transition-opacity ${
        state.enabled ? '' : 'opacity-40'
      }`}
    >
      <div className="flex items-center gap-3">
        <Switch
          checked={state.enabled}
          onCheckedChange={onToggle}
          className="shrink-0"
        />

        <div className="flex items-center gap-1.5 shrink-0 w-[140px]">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <Icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
          <span
            className={`text-sm font-medium truncate ${
              state.enabled ? 'text-rc-text' : 'text-rc-text-muted'
            }`}
          >
            {meta.name}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <Slider
            value={[state.rawWeight]}
            min={0}
            max={100}
            step={1}
            disabled={!state.enabled}
            onValueChange={([v]) => onWeightChange(v)}
          />
        </div>

        <span className="text-sm text-rc-text-light font-mono w-12 text-right shrink-0">
          {Math.round(normalizedPct)}%
        </span>
      </div>

      {avgScore !== null && state.enabled && (
        <div className="ml-[calc(2.25rem+140px+0.75rem)] mt-0.5">
          <span className="text-xs text-rc-text-muted">
            score: {avgScore.toFixed(1)}/10
          </span>
        </div>
      )}
    </div>
  )
}
