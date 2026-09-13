'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { UserPreferencesService } from '@/lib/user-preferences'
import { AnyUnit, MetricType, getNextUnit } from '@/app/utils/unit-conversions'
import {
  CA_DEFAULT_UNITS,
  chooseUnits,
  choicesFromLegacyLocal,
  type UnitChoices,
  type UnitCountry,
  type UnitPrefs,
} from '@/lib/unit-system'
import { useAuth } from './auth-context'
import { useMixpanel } from './mixpanel-context'

export type { UnitPrefs, UnitCountry } from '@/lib/unit-system'

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
  /** Only the units the angler picked. Everything else follows the country. */
  choices: UnitChoices
  /** The country these units were resolved for; null = no spot in scope. */
  country: UnitCountry | null
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

// Anonymous visitors keep their choices on the device; signed-in users get
// the same fast local read first, then the server copy wins when it loads.
//
// Only CHOICES are stored now. The old key held every unit, defaults
// included, which cannot tell a US spot whether "C" was picked or just
// written down; it is read once, differences only, when the new key is absent.
const STORAGE_KEY = 'rc-unit-choices'
const LEGACY_STORAGE_KEY = 'rc-unit-prefs'

function readLocal(): UnitChoices {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw != null) return JSON.parse(raw) ?? {}
    return choicesFromLegacyLocal(
      JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}'),
    )
  } catch {
    return {}
  }
}

function writeLocal(choices: UnitChoices) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  } catch {
    // Private-mode/quota failures just mean no persistence.
  }
}

interface ProviderValue {
  choices: UnitChoices
  setUnit: UnitPreferencesContextType['setUnit']
  setUnits: UnitPreferencesContextType['setUnits']
  refresh: () => Promise<void>
  loading: boolean
  trackEvent: ReturnType<typeof useMixpanel>['trackEvent']
}

const UnitPreferencesContext = createContext<ProviderValue | undefined>(undefined)

export function UnitPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { trackEvent } = useMixpanel()
  // Starts empty on the server and the first client render alike, so the
  // server's HTML (country defaults) and hydration agree.
  const [choices, setChoicesState] = useState<UnitChoices>({})
  const [loading, setLoading] = useState(true)

  const loadSaved = useCallback(async () => {
    // Local copy first so anonymous visitors (and the first paint for
    // signed-in users) don't flash defaults.
    setChoicesState(readLocal())

    if (user) {
      const server = await UserPreferencesService.getSavedUnitChoices()
      setChoicesState(server)
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
      setChoicesState((prev) => {
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
      const patch: UnitChoices = {}
      for (const [type, unit] of Object.entries(next)) {
        if (unit) patch[UNIT_KEY[type as MetricType]] = unit as never
      }
      if (Object.keys(patch).length === 0) return

      setChoicesState((prev) => {
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

  const value: ProviderValue = useMemo(
    () => ({ choices, setUnit, setUnits, refresh: loadSaved, loading, trackEvent }),
    [choices, setUnit, setUnits, loadSaved, loading, trackEvent],
  )

  return (
    <UnitPreferencesContext.Provider value={value}>
      {children}
    </UnitPreferencesContext.Provider>
  )
}

/**
 * The country whose units a subtree renders in. A spot page, a city page or
 * a drawer wraps its body in this; anything outside one keeps the Canadian
 * defaults every surface had before US water existed.
 */
const UnitCountryContext = createContext<UnitCountry | null>(null)

export function UnitCountryScope({
  country,
  children,
}: {
  country: UnitCountry | null
  children: React.ReactNode
}) {
  return <UnitCountryContext.Provider value={country}>{children}</UnitCountryContext.Provider>
}

/**
 * The units to render with: the angler's choices, then the defaults for the
 * spot's country. `country` overrides the nearest `UnitCountryScope`, for a
 * component that knows its own spot but renders no scope around itself.
 * `caBase` keeps a surface's own historic Canadian defaults (see
 * CA_EXPLORE_RAIL_UNITS); it never touches US water.
 */
export function useUnitPreferences(
  country?: UnitCountry | null,
  caBase: UnitPrefs = CA_DEFAULT_UNITS,
): UnitPreferencesContextType {
  const ctx = useContext(UnitPreferencesContext)
  const scoped = useContext(UnitCountryContext)
  if (ctx === undefined) {
    throw new Error('useUnitPreferences must be used within a UnitPreferencesProvider')
  }
  const resolvedCountry = country ?? scoped
  const units = chooseUnits(resolvedCountry, ctx.choices, caBase)
  const { setUnit, trackEvent } = ctx

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

  return {
    ...units,
    setUnit: ctx.setUnit,
    setUnits: ctx.setUnits,
    cycleUnit,
    refresh: ctx.refresh,
    loading: ctx.loading,
    choices: ctx.choices,
    country: resolvedCountry,
  }
}
