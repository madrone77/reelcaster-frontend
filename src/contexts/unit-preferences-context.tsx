'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { UserPreferencesService } from '@/lib/user-preferences'
import {
  WindUnit,
  CurrentUnit,
  TempUnit,
  PrecipUnit,
  TideUnit,
  WaveUnit,
  DepthUnit,
  DistanceUnit,
  PressureUnit,
  AnyUnit,
  MetricType,
  getNextUnit,
} from '@/app/utils/unit-conversions'
import { useAuth } from './auth-context'
import { useMixpanel } from './mixpanel-context'

export interface UnitPrefs {
  windUnit: WindUnit
  currentUnit: CurrentUnit
  tempUnit: TempUnit
  precipUnit: PrecipUnit
  tideUnit: TideUnit
  waveUnit: WaveUnit
  depthUnit: DepthUnit
  distanceUnit: DistanceUnit
  pressureUnit: PressureUnit
}

interface UnitPreferencesContextType extends UnitPrefs {
  setUnit: (type: MetricType, unit: AnyUnit) => Promise<void>
  /**
   * Set several variables at once in a single save. `setUnit` per variable
   * costs one `auth.updateUser` round-trip each, which for a whole-preset
   * change is nine sequential writes racing to merge the same metadata blob.
   */
  setUnits: (units: Partial<Record<MetricType, AnyUnit>>) => Promise<void>
  cycleUnit: (type: MetricType) => Promise<void>
  /** Re-pull saved prefs (e.g. after the profile page bulk-saves). */
  refresh: () => Promise<void>
  loading: boolean
}

// Defaults: BC marine convention. Wind + current in knots and pressure in mb
// (marine standard); tide + wave heights in METRES (how DFO tide tables and
// marine forecasts quote them); TIDE and DEPTH in FEET (how BC anglers talk
// about both — the charts are metric but nobody says "the tide is 1.5 metres");
// distance in km. Each variable is independent — a mixed screen (km + ft + m)
// is the intended default, not an accident. Keep in step with
// DEFAULT_PREFERENCES in lib/user-preferences.ts.
const DEFAULT_UNITS: UnitPrefs = {
  windUnit: 'knots',
  currentUnit: 'knots',
  tempUnit: 'C',
  precipUnit: 'mm',
  tideUnit: 'ft',
  waveUnit: 'm',
  depthUnit: 'ft',
  distanceUnit: 'km',
  pressureUnit: 'mb',
}

const UNIT_KEY: Record<MetricType, keyof UnitPrefs> = {
  wind: 'windUnit',
  current: 'currentUnit',
  temp: 'tempUnit',
  precip: 'precipUnit',
  tide: 'tideUnit',
  wave: 'waveUnit',
  depth: 'depthUnit',
  distance: 'distanceUnit',
  pressure: 'pressureUnit',
}

// Anonymous visitors keep their units in localStorage; signed-in users get
// the same fast local read first, then the server copy wins when it loads.
const STORAGE_KEY = 'rc-unit-prefs'

function readLocal(): Partial<UnitPrefs> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeLocal(prefs: UnitPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private-mode/quota failures just mean no persistence.
  }
}

const UnitPreferencesContext = createContext<UnitPreferencesContextType | undefined>(undefined)

export function UnitPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { trackEvent } = useMixpanel()
  const [units, setUnitsState] = useState<UnitPrefs>(DEFAULT_UNITS)
  const [loading, setLoading] = useState(true)

  const loadSaved = useCallback(async () => {
    // Local copy first so anonymous visitors (and the first paint for
    // signed-in users) don't flash defaults.
    const local = readLocal()
    setUnitsState((prev) => ({ ...prev, ...local }))

    if (user) {
      const p = await UserPreferencesService.getUserPreferences()
      const server: UnitPrefs = {
        windUnit: p.windUnit || DEFAULT_UNITS.windUnit,
        // Current historically borrowed the wind unit; seed from it once.
        currentUnit: p.currentUnit || p.windUnit || DEFAULT_UNITS.currentUnit,
        tempUnit: p.tempUnit || DEFAULT_UNITS.tempUnit,
        precipUnit: p.precipUnit || DEFAULT_UNITS.precipUnit,
        // Tide + wave were one "height" key; the new default is metres, so we
        // don't migrate the old (feet) height here — a deliberate convention shift.
        tideUnit: p.tideUnit || DEFAULT_UNITS.tideUnit,
        waveUnit: p.waveUnit || DEFAULT_UNITS.waveUnit,
        // Depth stays feet, matching the legacy height default, so migrating an
        // explicit old height choice into depth is safe.
        depthUnit: p.depthUnit || p.heightUnit || DEFAULT_UNITS.depthUnit,
        distanceUnit: p.distanceUnit || DEFAULT_UNITS.distanceUnit,
        pressureUnit: p.pressureUnit || DEFAULT_UNITS.pressureUnit,
      }
      setUnitsState(server)
      writeLocal(server)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadSaved()
  }, [loadSaved])

  const setUnit = useCallback(
    async (type: MetricType, unit: AnyUnit) => {
      const key = UNIT_KEY[type]
      setUnitsState((prev) => {
        const next = { ...prev, [key]: unit }
        writeLocal(next)
        return next
      })
      if (user) {
        await UserPreferencesService.updateUserPreferences({ [key]: unit })
      }
    },
    [user],
  )

  const setUnits = useCallback(
    async (next: Partial<Record<MetricType, AnyUnit>>) => {
      const patch: Partial<UnitPrefs> = {}
      for (const [type, unit] of Object.entries(next)) {
        if (unit) patch[UNIT_KEY[type as MetricType]] = unit as never
      }
      if (Object.keys(patch).length === 0) return

      setUnitsState((prev) => {
        const merged = { ...prev, ...patch }
        writeLocal(merged)
        return merged
      })
      if (user) {
        await UserPreferencesService.updateUserPreferences(patch)
      }
    },
    [user],
  )

  const cycleUnit = useCallback(
    async (type: MetricType) => {
      const current = units[UNIT_KEY[type]]
      const next = getNextUnit(current, type) as AnyUnit

      trackEvent('Unit Cycled', {
        metricType: type,
        oldUnit: current,
        newUnit: next,
        timestamp: new Date().toISOString(),
      })

      await setUnit(type, next)
    },
    [units, setUnit, trackEvent],
  )

  const value: UnitPreferencesContextType = {
    ...units,
    setUnit,
    setUnits,
    cycleUnit,
    refresh: loadSaved,
    loading,
  }

  return (
    <UnitPreferencesContext.Provider value={value}>
      {children}
    </UnitPreferencesContext.Provider>
  )
}

export function useUnitPreferences() {
  const context = useContext(UnitPreferencesContext)
  if (context === undefined) {
    throw new Error('useUnitPreferences must be used within a UnitPreferencesProvider')
  }
  return context
}
