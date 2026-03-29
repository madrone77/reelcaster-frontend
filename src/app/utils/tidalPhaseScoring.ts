/**
 * REE-13: Tidal Phase Scoring Engine
 *
 * Phase-normalized segment scoring for the Algorithm Designer.
 * Position within tide cycle expressed as 0→100% of half-cycle,
 * with configurable segments per flood/ebb + slack zones.
 */

import type { CHSWaterData } from './chsTideApi'

// ─── Types ──────────────────────────────────────────────────────────────

export type TideHalfCycle = 'flood' | 'ebb'

export interface PhaseSegment {
  id: string
  name: string
  startPct: number // 0-100
  endPct: number   // 0-100, > startPct
  score: number    // 0-10
}

export interface SlackZoneConfig {
  enabled: boolean
  durationPct: number // % of half-cycle at each transition (e.g. 8 = 8%)
  score: number       // 0-10
}

export interface PhaseProfile {
  flood: PhaseSegment[]
  ebb: PhaseSegment[]
  slackHigh: SlackZoneConfig // at high tide (end of flood / start of ebb)
  slackLow: SlackZoneConfig  // at low tide (end of ebb / start of flood)
}

export interface TidalPhaseConfig {
  phaseProfile: PhaseProfile
}

export interface PhaseComputationResult {
  phase: number            // 0-1
  halfCycle: TideHalfCycle
  inSlack: boolean
  segmentName: string
  score: number            // 0-10
}

// ─── Phase Computation ──────────────────────────────────────────────────

/** Compute phase position (0→1) within current half-cycle. */
export function computePhase(
  tideData: CHSWaterData,
  timestamp: number,
): { phase: number; halfCycle: TideHalfCycle } {
  const prevTs = tideData.previousTide.timestamp
  const nextTs = tideData.nextTide.timestamp
  const duration = nextTs - prevTs

  if (duration <= 0) return { phase: 0, halfCycle: 'flood' }

  const elapsed = timestamp - prevTs
  const phase = Math.max(0, Math.min(1, elapsed / duration))
  const halfCycle: TideHalfCycle = tideData.isRising ? 'flood' : 'ebb'

  return { phase, halfCycle }
}

/** Evaluate phase score from segments + slack zones. */
export function evaluatePhaseScore(
  phase: number,
  halfCycle: TideHalfCycle,
  profile: PhaseProfile,
): { score: number; inSlack: boolean; segmentName: string } {
  const phasePct = phase * 100

  // Slack at START of half-cycle
  // flood starts after low tide → check slackLow
  // ebb starts after high tide → check slackHigh
  const startSlack = halfCycle === 'flood' ? profile.slackLow : profile.slackHigh
  if (startSlack.enabled && phasePct < startSlack.durationPct) {
    return {
      score: startSlack.score,
      inSlack: true,
      segmentName: halfCycle === 'flood' ? 'Low Slack' : 'High Slack',
    }
  }

  // Slack at END of half-cycle
  // flood ends at high tide → check slackHigh
  // ebb ends at low tide → check slackLow
  const endSlack = halfCycle === 'flood' ? profile.slackHigh : profile.slackLow
  if (endSlack.enabled && phasePct > (100 - endSlack.durationPct)) {
    return {
      score: endSlack.score,
      inSlack: true,
      segmentName: halfCycle === 'flood' ? 'High Slack' : 'Low Slack',
    }
  }

  // Find matching segment
  const segments = halfCycle === 'flood' ? profile.flood : profile.ebb
  for (const seg of segments) {
    if (phasePct >= seg.startPct && phasePct < seg.endPct) {
      return { score: seg.score, inSlack: false, segmentName: seg.name }
    }
  }

  // Edge case: phasePct === 100 → last segment
  if (segments.length > 0) {
    const last = segments[segments.length - 1]
    return { score: last.score, inSlack: false, segmentName: last.name }
  }

  return { score: 5, inSlack: false, segmentName: 'Unknown' }
}

/** Full tidal phase score computation. */
export function computeTidalPhaseScore(
  config: TidalPhaseConfig,
  tideData: CHSWaterData,
  timestamp: number,
): PhaseComputationResult {
  const { phase, halfCycle } = computePhase(tideData, timestamp)
  const { score, inSlack, segmentName } =
    evaluatePhaseScore(phase, halfCycle, config.phaseProfile)

  return {
    phase,
    halfCycle,
    inSlack,
    segmentName,
    score: Math.max(0, Math.min(10, score)),
  }
}

// ─── Defaults ───────────────────────────────────────────────────────────

export const DEFAULT_PHASE_PROFILE: PhaseProfile = {
  flood: [
    { id: 'flood-early', name: 'Early Flood', startPct: 0, endPct: 35, score: 10 },
    { id: 'flood-mid', name: 'Mid Flood', startPct: 35, endPct: 70, score: 7 },
    { id: 'flood-late', name: 'Late Flood', startPct: 70, endPct: 100, score: 5 },
  ],
  ebb: [
    { id: 'ebb-early', name: 'Early Ebb', startPct: 0, endPct: 35, score: 6 },
    { id: 'ebb-mid', name: 'Mid Ebb', startPct: 35, endPct: 70, score: 4 },
    { id: 'ebb-late', name: 'Late Ebb', startPct: 70, endPct: 100, score: 10 },
  ],
  slackHigh: { enabled: true, durationPct: 8, score: 5 },
  slackLow: { enabled: true, durationPct: 8, score: 3 },
}

export const DEFAULT_TIDAL_PHASE_CONFIG: TidalPhaseConfig = {
  phaseProfile: DEFAULT_PHASE_PROFILE,
}

// ─── Presets ────────────────────────────────────────────────────────────

export interface TidalPhasePreset {
  id: string
  name: string
  config: TidalPhaseConfig
}

export const TIDAL_PHASE_PRESETS: TidalPhasePreset[] = [
  {
    id: 'default',
    name: 'Default',
    config: DEFAULT_TIDAL_PHASE_CONFIG,
  },
  {
    id: 'flood-focused',
    name: 'Flood Focused',
    config: {
      phaseProfile: {
        flood: [
          { id: 'ff-early', name: 'Early Flood', startPct: 0, endPct: 25, score: 10 },
          { id: 'ff-prime', name: 'Prime Flood', startPct: 25, endPct: 60, score: 10 },
          { id: 'ff-late', name: 'Late Flood', startPct: 60, endPct: 100, score: 4 },
        ],
        ebb: [
          { id: 'ff-ebb', name: 'Ebb', startPct: 0, endPct: 100, score: 3 },
        ],
        slackHigh: { enabled: true, durationPct: 8, score: 2 },
        slackLow: { enabled: true, durationPct: 8, score: 4 },
      },
    },
  },
  {
    id: 'transitions-only',
    name: 'Transitions Only',
    config: {
      phaseProfile: {
        flood: [
          { id: 'to-f', name: 'Flood', startPct: 0, endPct: 100, score: 4 },
        ],
        ebb: [
          { id: 'to-e', name: 'Ebb', startPct: 0, endPct: 100, score: 4 },
        ],
        slackHigh: { enabled: true, durationPct: 15, score: 10 },
        slackLow: { enabled: true, durationPct: 15, score: 10 },
      },
    },
  },
  {
    id: 'even-across',
    name: 'Even Across',
    config: {
      phaseProfile: {
        flood: [
          { id: 'ea-f', name: 'Flood', startPct: 0, endPct: 100, score: 7 },
        ],
        ebb: [
          { id: 'ea-e', name: 'Ebb', startPct: 0, endPct: 100, score: 7 },
        ],
        slackHigh: { enabled: true, durationPct: 8, score: 5 },
        slackLow: { enabled: true, durationPct: 8, score: 5 },
      },
    },
  },
]

// ─── Colors ─────────────────────────────────────────────────────────────

export const HALF_CYCLE_COLORS: Record<TideHalfCycle, string> = {
  flood: '#14b8a6', // teal-500
  ebb: '#f59e0b',   // amber-500
}

export const SLACK_COLOR = '#6b7280' // gray-500
