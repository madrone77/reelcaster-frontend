'use client'

import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import type { SlackZoneConfig } from '@/app/utils/tidalPhaseScoring'

interface SlackZoneConfigProps {
  slackHigh: SlackZoneConfig
  slackLow: SlackZoneConfig
  onChangeHigh: (config: SlackZoneConfig) => void
  onChangeLow: (config: SlackZoneConfig) => void
}

export default function SlackZoneConfigPanel({
  slackHigh,
  slackLow,
  onChangeHigh,
  onChangeLow,
}: SlackZoneConfigProps) {
  return (
    <div className="space-y-2">
      <SlackRow
        label="High Slack"
        sublabel="At high tide (flood→ebb)"
        config={slackHigh}
        onChange={onChangeHigh}
      />
      <SlackRow
        label="Low Slack"
        sublabel="At low tide (ebb→flood)"
        config={slackLow}
        onChange={onChangeLow}
      />
    </div>
  )
}

function SlackRow({
  label,
  sublabel,
  config,
  onChange,
}: {
  label: string
  sublabel: string
  config: SlackZoneConfig
  onChange: (c: SlackZoneConfig) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2 px-2 rounded-lg bg-rc-bg-darkest transition-opacity ${
        config.enabled ? '' : 'opacity-40'
      }`}
    >
      <Switch
        checked={config.enabled}
        onCheckedChange={(enabled) => onChange({ ...config, enabled })}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="text-xs text-rc-text font-medium">{label}</div>
        <div className="text-[10px] text-rc-text-muted">{sublabel}</div>
      </div>

      {/* Duration slider */}
      <div className="w-20">
        <Slider
          value={[config.durationPct]}
          min={1}
          max={15}
          step={1}
          disabled={!config.enabled}
          onValueChange={([v]) => onChange({ ...config, durationPct: v })}
        />
        <div className="text-[10px] text-rc-text-muted text-center mt-0.5">
          {config.durationPct}%
        </div>
      </div>

      {/* Score */}
      <Input
        type="number"
        step="0.5"
        min={0}
        max={10}
        value={config.score}
        disabled={!config.enabled}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange({ ...config, score: Math.min(10, Math.max(0, v)) })
        }}
        className="h-7 w-14 text-sm font-mono text-center"
      />
    </div>
  )
}
