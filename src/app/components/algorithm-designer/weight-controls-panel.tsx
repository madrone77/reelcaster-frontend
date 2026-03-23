'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, Clipboard, Check } from 'lucide-react'
import {
  FACTOR_META,
  FACTOR_GROUPS,
  WEIGHT_PRESETS,
  type FactorKey,
  type FactorState,
  type FactorGroup,
} from '@/app/utils/algorithmDesigner'
import FactorWeightRow from './factor-weight-row'

interface WeightControlsPanelProps {
  factorStates: Record<FactorKey, FactorState>
  normalizedWeights: Record<FactorKey, number>
  avgScores: Record<FactorKey, number | null>
  activePreset: string | null
  customCurveKeys?: FactorKey[]
  onToggle: (key: FactorKey, enabled: boolean) => void
  onWeightChange: (key: FactorKey, value: number) => void
  onApplyPreset: (presetId: string) => void
  onEnableAll: () => void
  onDisableAll: () => void
  onReset: () => void
  onCopyWeights: () => void
  onFactorDrillDown?: (key: FactorKey) => void
}

export default function WeightControlsPanel({
  factorStates,
  normalizedWeights,
  avgScores,
  activePreset,
  customCurveKeys = [],
  onToggle,
  onWeightChange,
  onApplyPreset,
  onEnableAll,
  onDisableAll,
  onReset,
  onCopyWeights,
  onFactorDrillDown,
}: WeightControlsPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<FactorGroup, boolean>
  >({
    weather: false,
    marine: false,
    environmental: false,
    safety: false,
    timing: false,
  })

  const [copied, setCopied] = useState(false)

  const toggleGroup = (group: FactorGroup) =>
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))

  const allEnabled = Object.values(factorStates).every((f) => f.enabled)

  const handleCopy = () => {
    onCopyWeights()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="p-4 border-b border-rc-bg-light shrink-0">
        <h2 className="text-lg font-semibold text-rc-text mb-2">
          Weight Configuration
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-rc-text-muted hover:text-rc-text text-xs transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={allEnabled ? onDisableAll : onEnableAll}
            className="px-3 py-1.5 text-rc-text-muted hover:text-rc-text text-xs transition-colors"
          >
            {allEnabled ? 'Disable All' : 'Enable All'}
          </button>
          {/* Fix #6: Copy weights as JSON */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-rc-text-muted hover:text-rc-text text-xs transition-colors ml-auto"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Clipboard className="w-3 h-3" />
                Copy JSON
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable factor groups */}
      <div className="overflow-y-auto flex-1">
        {FACTOR_GROUPS.map((group) => {
          const groupFactors = FACTOR_META.filter(
            (f) => f.group === group.key,
          )
          const groupTotal = groupFactors.reduce(
            (sum, f) => sum + (normalizedWeights[f.key] ?? 0),
            0,
          )
          const collapsed = collapsedGroups[group.key]

          return (
            <div key={group.key}>
              {/* Group header — Fix #3: correct chevron direction */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full px-4 py-2 bg-rc-bg-darkest flex justify-between items-center hover:bg-rc-bg-light/50 transition-colors"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-rc-text-muted flex items-center gap-1.5">
                  {collapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {group.name}
                </span>
                <span className="text-xs text-rc-text-muted">
                  {Math.round(groupTotal * 100)}%
                </span>
              </button>

              {/* Factor rows */}
              {!collapsed && (
                <div className="px-4">
                  {groupFactors.map((meta) => (
                    <FactorWeightRow
                      key={meta.key}
                      meta={meta}
                      state={factorStates[meta.key]}
                      normalizedPct={
                        (normalizedWeights[meta.key] ?? 0) * 100
                      }
                      avgScore={avgScores[meta.key]}
                      hasCustomCurve={customCurveKeys.includes(meta.key)}
                      onToggle={(v) => onToggle(meta.key, v)}
                      onWeightChange={(v) => onWeightChange(meta.key, v)}
                      onDrillDown={() => onFactorDrillDown?.(meta.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Presets */}
      <div className="p-4 border-t border-rc-bg-light shrink-0">
        <p className="text-xs text-rc-text-muted mb-2">Presets</p>
        <div className="flex flex-wrap gap-2">
          {WEIGHT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset.id)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                activePreset === preset.id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'bg-rc-bg-light text-rc-text-muted hover:bg-blue-600/20 hover:text-blue-400'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
