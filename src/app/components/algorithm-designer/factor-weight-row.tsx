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
      {/* Fix #4: Use grid layout instead of magic calc offset */}
      <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 sm:gap-3">
        <Switch
          checked={state.enabled}
          onCheckedChange={onToggle}
          className="shrink-0"
        />

        {/* Fix #9: On mobile show icon only, on sm+ show icon + name */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <Icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
          <span
            className={`text-sm font-medium truncate hidden sm:inline max-w-[120px] ${
              state.enabled ? 'text-rc-text' : 'text-rc-text-muted'
            }`}
            title={meta.name}
          >
            {meta.name}
          </span>
        </div>

        <div className="min-w-0">
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

      {/* Score badge — aligned under the slider using same grid */}
      {avgScore !== null && state.enabled && (
        <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 sm:gap-3 mt-0.5">
          <div /> {/* switch placeholder */}
          <div /> {/* icon placeholder */}
          <span className="text-xs text-rc-text-muted">
            score: {avgScore.toFixed(1)}/10
          </span>
          <div /> {/* % placeholder */}
        </div>
      )}
    </div>
  )
}
