/**
 * Algorithm Designer — Types, constants, normalization & recalculation helpers.
 *
 * All weights live client-side. No API routes, no DB — pure computation.
 */

import {
  Gauge,
  Wind,
  Thermometer,
  CloudRain,
  Waves,
  Droplets,
  ArrowRightLeft,
  Compass,
  Cloud,
  Eye,
  Sun,
  Zap,
  Mountain,
  Heart,
  Clock,
  Fish,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FishingScore } from './fishingCalculations'

// ─── Types ──────────────────────────────────────────────────────────────────

export type FactorKey =
  | 'pressure'
  | 'wind'
  | 'temperature'
  | 'waterTemperature'
  | 'precipitation'
  | 'tide'
  | 'currentSpeed'
  | 'currentDirection'
  | 'cloudCover'
  | 'visibility'
  | 'sunshine'
  | 'lightning'
  | 'atmospheric'
  | 'comfort'
  | 'timeOfDay'
  | 'species'

export interface FactorState {
  enabled: boolean
  rawWeight: number
}

export type FactorGroup = 'weather' | 'marine' | 'environmental' | 'safety' | 'timing'

export interface FactorMeta {
  key: FactorKey
  name: string
  icon: LucideIcon
  group: FactorGroup
  defaultWeight: number
  /** Chart / legend color */
  color: string
}

// ─── Factor metadata (16 entries) ───────────────────────────────────────────

export const FACTOR_META: FactorMeta[] = [
  { key: 'pressure',         name: 'Barometric Pressure',   icon: Gauge,          group: 'weather',       defaultWeight: 13, color: '#3b82f6' },
  { key: 'wind',             name: 'Wind Speed',            icon: Wind,           group: 'weather',       defaultWeight: 12, color: '#06b6d4' },
  { key: 'temperature',      name: 'Air Temperature',       icon: Thermometer,    group: 'weather',       defaultWeight: 9,  color: '#f97316' },
  { key: 'precipitation',    name: 'Precipitation',         icon: CloudRain,      group: 'weather',       defaultWeight: 10, color: '#6366f1' },
  { key: 'tide',             name: 'Tide Movement',         icon: Waves,          group: 'marine',        defaultWeight: 8,  color: '#14b8a6' },
  { key: 'waterTemperature', name: 'Water Temperature',     icon: Droplets,       group: 'marine',        defaultWeight: 5,  color: '#0ea5e9' },
  { key: 'currentSpeed',     name: 'Current Speed',         icon: ArrowRightLeft, group: 'marine',        defaultWeight: 4,  color: '#22d3ee' },
  { key: 'currentDirection', name: 'Current Direction',     icon: Compass,        group: 'marine',        defaultWeight: 2,  color: '#67e8f9' },
  { key: 'cloudCover',       name: 'Cloud Cover',           icon: Cloud,          group: 'environmental', defaultWeight: 6,  color: '#a78bfa' },
  { key: 'visibility',       name: 'Visibility',            icon: Eye,            group: 'environmental', defaultWeight: 6,  color: '#818cf8' },
  { key: 'sunshine',         name: 'Sunshine',              icon: Sun,            group: 'environmental', defaultWeight: 5,  color: '#fbbf24' },
  { key: 'atmospheric',      name: 'Atmospheric Stability', icon: Mountain,       group: 'environmental', defaultWeight: 4,  color: '#8b5cf6' },
  { key: 'lightning',        name: 'Lightning Safety',      icon: Zap,            group: 'safety',        defaultWeight: 5,  color: '#f43f5e' },
  { key: 'comfort',          name: 'Angler Comfort',        icon: Heart,          group: 'safety',        defaultWeight: 4,  color: '#34d399' },
  { key: 'timeOfDay',        name: 'Time of Day',           icon: Clock,          group: 'timing',        defaultWeight: 4,  color: '#fb923c' },
  { key: 'species',          name: 'Species Factor',        icon: Fish,           group: 'timing',        defaultWeight: 3,  color: '#f472b6' },
]

export const FACTOR_META_MAP: Record<FactorKey, FactorMeta> = Object.fromEntries(
  FACTOR_META.map((f) => [f.key, f]),
) as Record<FactorKey, FactorMeta>

export const FACTOR_GROUPS: { key: FactorGroup; name: string }[] = [
  { key: 'weather', name: 'Core Weather' },
  { key: 'marine', name: 'Marine' },
  { key: 'environmental', name: 'Environmental' },
  { key: 'safety', name: 'Safety & Comfort' },
  { key: 'timing', name: 'Timing & Species' },
]

// ─── Presets ────────────────────────────────────────────────────────────────

export interface WeightPreset {
  id: string
  name: string
  weights: Partial<Record<FactorKey, number>>
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'default',
    name: 'Default',
    weights: Object.fromEntries(FACTOR_META.map((f) => [f.key, f.defaultWeight])) as Record<FactorKey, number>,
  },
  {
    id: 'weather-heavy',
    name: 'Weather Heavy',
    weights: {
      pressure: 20, wind: 18, temperature: 14, precipitation: 16,
      tide: 5, waterTemperature: 3, currentSpeed: 2, currentDirection: 1,
      cloudCover: 6, visibility: 4, sunshine: 3, atmospheric: 3,
      lightning: 2, comfort: 1, timeOfDay: 1, species: 1,
    },
  },
  {
    id: 'tide-focused',
    name: 'Tide Focused',
    weights: {
      pressure: 8, wind: 8, temperature: 5, precipitation: 5,
      tide: 22, waterTemperature: 10, currentSpeed: 12, currentDirection: 8,
      cloudCover: 3, visibility: 3, sunshine: 2, atmospheric: 2,
      lightning: 3, comfort: 2, timeOfDay: 4, species: 3,
    },
  },
  {
    id: 'safety-first',
    name: 'Safety First',
    weights: {
      pressure: 8, wind: 18, temperature: 6, precipitation: 12,
      tide: 5, waterTemperature: 3, currentSpeed: 4, currentDirection: 2,
      cloudCover: 4, visibility: 10, sunshine: 2, atmospheric: 6,
      lightning: 12, comfort: 5, timeOfDay: 2, species: 1,
    },
  },
]

// ─── Functions ──────────────────────────────────────────────────────────────

/** Normalize enabled weights so they sum to 1.0 */
export function normalizeWeights(
  factors: Record<FactorKey, FactorState>,
): Record<FactorKey, number> {
  const enabledSum = Object.values(factors).reduce(
    (sum, f) => sum + (f.enabled ? f.rawWeight : 0),
    0,
  )
  if (enabledSum === 0) {
    // Avoid division by zero — return uniform weights for all
    const count = FACTOR_META.length
    return Object.fromEntries(
      FACTOR_META.map((f) => [f.key, 1 / count]),
    ) as Record<FactorKey, number>
  }
  return Object.fromEntries(
    FACTOR_META.map((f) => [
      f.key,
      factors[f.key].enabled ? factors[f.key].rawWeight / enabledSum : 0,
    ]),
  ) as Record<FactorKey, number>
}

/** Recalculate a single total score from breakdown + normalised weights */
export function recalculateScore(
  breakdown: FishingScore['breakdown'],
  weights: Record<FactorKey, number>,
): number {
  let total = 0
  for (const meta of FACTOR_META) {
    total += (breakdown[meta.key] ?? 0) * (weights[meta.key] ?? 0)
  }
  return Math.min(Math.max(Math.round(total * 100) / 100, 0), 10)
}

/** Per-factor weighted contribution values (for stacked chart segments) */
export function calculateFactorContributions(
  breakdown: FishingScore['breakdown'],
  weights: Record<FactorKey, number>,
): Record<FactorKey, number> {
  return Object.fromEntries(
    FACTOR_META.map((f) => [
      f.key,
      Math.round((breakdown[f.key] ?? 0) * (weights[f.key] ?? 0) * 100) / 100,
    ]),
  ) as Record<FactorKey, number>
}

/** Build initial factor states with production defaults */
export function getDefaultFactorStates(hasCHS: boolean): Record<FactorKey, FactorState> {
  // When no CHS data, disable marine-specific factors
  return Object.fromEntries(
    FACTOR_META.map((f) => [
      f.key,
      {
        enabled: hasCHS ? true : !['waterTemperature', 'currentSpeed', 'currentDirection'].includes(f.key),
        rawWeight: f.defaultWeight,
      } satisfies FactorState,
    ]),
  ) as Record<FactorKey, FactorState>
}
