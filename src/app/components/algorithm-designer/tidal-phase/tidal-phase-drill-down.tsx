'use client'

import { useState, useCallback, useMemo } from 'react'
import type { CHSWaterData } from '@/app/utils/chsTideApi'
import {
  createTideDataAtTimestamp,
  type OpenMeteoDailyForecast,
} from '@/app/utils/fishingCalculations'
import {
  computeTidalPhaseScore,
  HALF_CYCLE_COLORS,
  TIDAL_PHASE_PRESETS,
  type TidalPhaseConfig,
  type TideHalfCycle,
  type PhaseProfile,
} from '@/app/utils/tidalPhaseScoring'
import PhaseWheel from './phase-wheel'
import SegmentEditor from './segment-editor'
import SlackZoneConfigPanel from './slack-zone-config'
import PhasePreviewChart, { type PhaseTimelineBlock } from './phase-preview-chart'

interface TidalPhaseDrillDownProps {
  config: TidalPhaseConfig
  onConfigChange: (config: TidalPhaseConfig) => void
  rawTideData: CHSWaterData
  todayForecast: OpenMeteoDailyForecast
}

export default function TidalPhaseDrillDown({
  config,
  onConfigChange,
  rawTideData,
  todayForecast,
}: TidalPhaseDrillDownProps) {
  const [activeHalfCycle, setActiveHalfCycle] = useState<TideHalfCycle>('flood')
  const { phaseProfile } = config

  // Compute preview blocks from forecast 2-hour blocks
  const previewBlocks: PhaseTimelineBlock[] = useMemo(() => {
    return todayForecast.twoHourForecasts.map((block) => {
      // Get tide state at this block's midpoint
      const midTs = block.startTime + (block.endTime - block.startTime) / 2

      // Compute per-block tide state (previousTide/nextTide relative to this timestamp)
      const tideAtBlock = createTideDataAtTimestamp(rawTideData, midTs)
      const tideForScoring = tideAtBlock ?? rawTideData
      const result = computeTidalPhaseScore(config, tideForScoring, midTs)

      // Use the interpolated height from the tide state
      const tideHeight = tideForScoring.currentHeight

      const time = new Date(block.startTime * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

      return {
        time,
        timestamp: midTs,
        tideHeight,
        score: result.score,
        halfCycle: result.halfCycle,
        phase: result.phase,
        inSlack: result.inSlack,
        segmentName: result.segmentName,
      }
    })
  }, [config, rawTideData, todayForecast])

  // Tide events for chart markers
  const tideEvents = useMemo(() => {
    const dayStart = todayForecast.twoHourForecasts[0]?.startTime ?? 0
    const dayEnd = todayForecast.twoHourForecasts[todayForecast.twoHourForecasts.length - 1]?.endTime ?? 0
    return rawTideData.tideEvents
      .filter((e) => e.timestamp >= dayStart && e.timestamp <= dayEnd)
      .map((e) => ({ timestamp: e.timestamp, height: e.height, type: e.type }))
  }, [rawTideData, todayForecast])

  // Current phase for the needle
  const currentPhaseInfo = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const tideNow = createTideDataAtTimestamp(rawTideData, now)
    const result = computeTidalPhaseScore(config, tideNow ?? rawTideData, now)
    return { phase: result.phase, halfCycle: result.halfCycle }
  }, [config, rawTideData])

  const handleProfileChange = useCallback(
    (updates: Partial<PhaseProfile>) => {
      onConfigChange({
        ...config,
        phaseProfile: { ...phaseProfile, ...updates },
      })
    },
    [config, phaseProfile, onConfigChange],
  )

  return (
    <div className="space-y-4">
      {/* Top row: Phase Wheel + Preview Chart */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start">
        <div className="flex flex-col items-center">
          <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2 self-start">
            Phase Wheel
          </h4>
          <PhaseWheel
            profile={phaseProfile}
            currentPhase={currentPhaseInfo.phase}
            currentHalfCycle={currentPhaseInfo.halfCycle}
            size={180}
          />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
            24h Preview
          </h4>
          <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-2">
            <PhasePreviewChart blocks={previewBlocks} tideEvents={tideEvents} />
          </div>
        </div>
      </div>

      {/* Half-cycle toggle + Segments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          {(['flood', 'ebb'] as TideHalfCycle[]).map((hc) => (
            <button
              key={hc}
              onClick={() => setActiveHalfCycle(hc)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeHalfCycle === hc ? 'text-rc-text' : 'text-rc-text-muted hover:text-rc-text'
              }`}
              style={{
                backgroundColor: activeHalfCycle === hc ? `${HALF_CYCLE_COLORS[hc]}30` : undefined,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: activeHalfCycle === hc ? `${HALF_CYCLE_COLORS[hc]}50` : 'transparent',
              }}
            >
              {hc === 'flood' ? 'Flood (Rising)' : 'Ebb (Falling)'}
            </button>
          ))}
        </div>

        <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-3">
          <SegmentEditor
            halfCycle={activeHalfCycle}
            segments={activeHalfCycle === 'flood' ? phaseProfile.flood : phaseProfile.ebb}
            onSegmentsChange={(segments) =>
              handleProfileChange({ [activeHalfCycle]: segments })
            }
          />
        </div>
      </div>

      {/* Slack zones */}
      <div>
        <h4 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
          Slack Zones
        </h4>
        <SlackZoneConfigPanel
          slackHigh={phaseProfile.slackHigh}
          slackLow={phaseProfile.slackLow}
          onChangeHigh={(c) => handleProfileChange({ slackHigh: c })}
          onChangeLow={(c) => handleProfileChange({ slackLow: c })}
        />
      </div>

      {/* Templates */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-rc-text-muted">Templates:</span>
        {TIDAL_PHASE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onConfigChange(preset.config)}
            className="px-3 py-1 rounded-full text-xs bg-rc-bg-light text-rc-text-muted hover:bg-blue-600/20 hover:text-blue-400 transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  )
}
