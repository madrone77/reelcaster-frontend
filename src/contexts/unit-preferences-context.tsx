'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { UserPreferencesService } from '@/lib/user-preferences'
import {
  WindUnit,
  TempUnit,
  PrecipUnit,
  HeightUnit,
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
  tempUnit: TempUnit
  precipUnit: PrecipUnit
  heightUnit: HeightUnit
  distanceUnit: DistanceUnit
  pressureUnit: PressureUnit
}

interface UnitPreferencesContextType extends UnitPrefs {
  setUnit: (type: MetricType, unit: AnyUnit) => Promise<void>
  cycleUnit: (type: MetricType) => Promise<void>
  /** Re-pull saved prefs (e.g. after the profile page bulk-saves). */
  refresh: () => Promise<void>
  loading: boolean
}

// Defaults: marine convention (wind/current in knots, pressure mb), and
// heights/depths in FEET — BC anglers think in feet, so imperial depth is the
// out-of-the-box experience and metres is the toggle. Keep in step with
// DEFAULT_PREFERENCES in lib/user-preferences.ts.
const DEFAULT_UNITS: UnitPrefs = {
  windUnit: 'knots',
  tempUnit: 'C',
  precipUnit: 'mm',
  heightUnit: 'ft',
  distanceUnit: 'km',
  pressureUnit: 'mb',
}

const UNIT_KEY: Record<MetricType, keyof UnitPrefs> = {
  wind: 'windUnit',
  temp: 'tempUnit',
  precip: 'precipUnit',
  height: 'heightUnit',
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
  const [units, setUnits] = useState<UnitPrefs>(DEFAULT_UNITS)
  const [loading, setLoading] = useState(true)

  const loadSaved = useCallback(async () => {
    // Local copy first so anonymous visitors (and the first paint for
    // signed-in users) don't flash defaults.
    const local = readLocal()
    setUnits((prev) => ({ ...prev, ...local }))

    if (user) {
      const p = await UserPreferencesService.getUserPreferences()
      const server: UnitPrefs = {
        windUnit: p.windUnit || DEFAULT_UNITS.windUnit,
        tempUnit: p.tempUnit || DEFAULT_UNITS.tempUnit,
        precipUnit: p.precipUnit || DEFAULT_UNITS.precipUnit,
        heightUnit: p.heightUnit || DEFAULT_UNITS.heightUnit,
        distanceUnit: p.distanceUnit || DEFAULT_UNITS.distanceUnit,
        pressureUnit: p.pressureUnit || DEFAULT_UNITS.pressureUnit,
      }
      setUnits(server)
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
      setUnits((prev) => {
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
