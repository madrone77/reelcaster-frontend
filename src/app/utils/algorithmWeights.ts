/**
 * Shared production algorithm weights
 *
 * These are the canonical weight definitions used by both the Algorithm Designer
 * and the accuracy tracking pipeline. Keep in sync with any algorithm version changes.
 */

import type { FactorKey } from './algorithmDesigner'

/** Production weights (with CHS tide data — 18 factors, sums to 1.0) */
export const PROD_CHS_WEIGHTS: Record<FactorKey, number> = {
  pressure: 0.11, pressureTrend: 0.08, wind: 0.11, temperature: 0.08,
  waterTemperature: 0.04, precipitation: 0.09, tide: 0.07,
  currentSpeed: 0.03, currentAcceleration: 0.04, currentDirection: 0.02,
  cloudCover: 0.05, visibility: 0.05, sunshine: 0.05, lightning: 0.04,
  atmospheric: 0.04, comfort: 0.03, timeOfDay: 0.04, species: 0.03,
}

/** Production weights (without CHS data — marine factors zeroed, sums to 1.0) */
export const PROD_NO_CHS_WEIGHTS: Record<FactorKey, number> = {
  pressure: 0.12, pressureTrend: 0.08, wind: 0.12, temperature: 0.10,
  waterTemperature: 0, precipitation: 0.10, tide: 0.10,
  currentSpeed: 0, currentAcceleration: 0, currentDirection: 0,
  cloudCover: 0.05, visibility: 0.05, sunshine: 0.05, lightning: 0.05,
  atmospheric: 0.04, comfort: 0.04, timeOfDay: 0.04, species: 0.06,
}

/** Current production algorithm version identifier */
export const CURRENT_ALGORITHM_VERSION = 'v1.0'
