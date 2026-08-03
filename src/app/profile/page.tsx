'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, MapPin, Mail, Calendar, Bell, LogOut, Save, Clock, Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { storedFirstName } from '@/lib/display-name'
import { useAnalytics } from '@/hooks/use-analytics'
import { useUnitPreferences } from '@/contexts/unit-preferences-context'
import { UserPreferences, UserPreferencesService } from '@/lib/user-preferences'
import ExploreTopBar from '@/app/explore/components/explore-top-bar'
import SubscriptionCard from '../components/account/subscription-card'
import PhoneVerifyCard from '../components/account/phone-verify-card'
import DangerZoneCard from '../components/account/danger-zone-card'

// Centralized config
import { FISHING_LOCATIONS } from '../config/locations'
import { SPECIES_OPTIONS } from '../config/species'

// Use centralized config
const fishingLocations = FISHING_LOCATIONS
const fishSpecies = SPECIES_OPTIONS

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { trackEvent } = useAnalytics()
  const { refresh: refreshUnits } = useUnitPreferences()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [firstNameInput, setFirstNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const originalPreferences = useRef<UserPreferences>({})
  const hasTrackedView = useRef(false)

  // Seed the first-name field from the auth user.
  useEffect(() => {
    setFirstNameInput(storedFirstName(user) ?? '')
  }, [user])

  const handleSaveName = async () => {
    setSavingName(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { first_name: firstNameInput.trim() },
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Name saved.' })
    } catch {
      setMessage({ type: 'error', text: 'Could not save your name.' })
    } finally {
      setSavingName(false)
    }
  }

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const userPrefs = await UserPreferencesService.getUserPreferences()
        setPreferences(userPrefs)
        originalPreferences.current = userPrefs

        // Track profile viewed
        if (!hasTrackedView.current) {
          trackEvent('Profile Viewed', {
            timestamp: new Date().toISOString(),
          })
          hasTrackedView.current = true
        }
      } catch (error) {
        console.error('Error loading preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadPreferences()
    } else {
      router.push('/')
    }
  }, [user, router, trackEvent])

  const handleSavePreferences = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const result = await UserPreferencesService.updateUserPreferences(preferences)

      if (result.success) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' })

        // Push the new units into the app-wide provider so open surfaces
        // (Explore, spot pages) reflect them without a reload.
        refreshUnits()

        // Track which fields changed
        const changedFields: string[] = []
        const original = originalPreferences.current

        if (preferences.favoriteLocation !== original.favoriteLocation) changedFields.push('favoriteLocation')
        if (preferences.favoriteHotspot !== original.favoriteHotspot) changedFields.push('favoriteHotspot')
        if (preferences.favoriteSpecies !== original.favoriteSpecies) changedFields.push('favoriteSpecies')
        if (preferences.windUnit !== original.windUnit) changedFields.push('windUnit')
        if (preferences.tempUnit !== original.tempUnit) changedFields.push('tempUnit')
        if (preferences.precipUnit !== original.precipUnit) changedFields.push('precipUnit')
        if (preferences.heightUnit !== original.heightUnit) changedFields.push('heightUnit')
        if (preferences.notificationsEnabled !== original.notificationsEnabled) changedFields.push('notificationsEnabled')
        if (preferences.emailForecasts !== original.emailForecasts) changedFields.push('emailForecasts')
        if (preferences.notificationTime !== original.notificationTime) changedFields.push('notificationTime')

        trackEvent('Preferences Saved', {
          changedFields,
          favoriteLocation: preferences.favoriteLocation,
          favoriteHotspot: preferences.favoriteHotspot,
          favoriteSpecies: preferences.favoriteSpecies,
          windUnit: preferences.windUnit,
          tempUnit: preferences.tempUnit,
          precipUnit: preferences.precipUnit,
          heightUnit: preferences.heightUnit,
          notificationsEnabled: preferences.notificationsEnabled,
          timestamp: new Date().toISOString(),
        })

        // Update original preferences
        originalPreferences.current = preferences
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save preferences' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving preferences' })
    } finally {
      setSaving(false)
    }
  }

  const handleLocationChange = (locationName: string) => {
    const location = fishingLocations.find(loc => loc.name === locationName)
    if (location) {
      const firstHotspot = location.hotspots[0]
      setPreferences(prev => ({
        ...prev,
        favoriteLocation: locationName,
        favoriteHotspot: firstHotspot.name,
        favoriteLat: firstHotspot.coordinates.lat,
        favoriteLon: firstHotspot.coordinates.lon,
      }))
    }
  }

  const handleHotspotChange = (hotspotName: string) => {
    const currentLocation = fishingLocations.find(loc => loc.name === preferences.favoriteLocation)
    const hotspot = currentLocation?.hotspots.find(h => h.name === hotspotName)

    if (hotspot) {
      setPreferences(prev => ({
        ...prev,
        favoriteHotspot: hotspotName,
        favoriteLat: hotspot.coordinates.lat,
        favoriteLon: hotspot.coordinates.lon,
      }))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-rc-page">
        <ExploreTopBar />
        <main className="pt-16">
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-rc-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-rc-ink-mute">Loading profile…</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const currentLocation = fishingLocations.find(loc => loc.name === preferences.favoriteLocation)
  const availableHotspots = currentLocation?.hotspots || []

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">Profile</h1>
            <div className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">{user.email}</div>
          </div>

          <div className="space-y-6">
            {/* Message */}
            {message && (
              <Alert
                className={
                  message.type === 'success'
                    ? 'border-rc-good-border bg-rc-good-bg text-rc-good-ink'
                    : 'border-rc-poor/40 bg-rc-poor-bg text-rc-poor-ink'
                }
              >
                {message.text}
              </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Account Information */}
              <Card className="border-rc-rule shadow-none">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-rc-brand" />
                    </div>
                    <div>
                      <CardTitle className="text-rc-ink">Account Information</CardTitle>
                      <CardDescription className="text-rc-ink-mute">Your account details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="profile-first-name" className="text-sm font-medium text-rc-ink">
                        First name
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-ink-mute" />
                          <Input
                            id="profile-first-name"
                            value={firstNameInput}
                            onChange={(e) => setFirstNameInput(e.target.value)}
                            placeholder="Your first name"
                            autoComplete="given-name"
                            className="pl-10 bg-rc-panel border-rc-rule text-rc-ink placeholder:text-rc-ink-mute focus-visible:border-rc-brand focus-visible:ring-rc-brand/25"
                          />
                        </div>
                        <Button
                          onClick={handleSaveName}
                          disabled={savingName}
                          variant="outline"
                          className="border-rc-rule text-rc-ink-soft hover:bg-rc-surface hover:text-rc-ink"
                        >
                          {savingName ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-rc-surface rounded-lg">
                      <Mail className="h-5 w-5 text-rc-ink-mute" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-rc-ink">Email</p>
                        <p className="text-sm text-rc-ink-mute truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-rc-surface rounded-lg">
                      <Calendar className="h-5 w-5 text-rc-ink-mute" />
                      <div>
                        <p className="text-sm font-medium text-rc-ink">Member Since</p>
                        <p className="text-sm text-rc-ink-mute">{new Date(user.created_at || '').toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-rc-rule">
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      className="w-full border-rc-rule text-rc-ink-soft hover:bg-rc-surface hover:text-rc-ink"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Favorite Locations */}
              <Card className="border-rc-rule shadow-none lg:col-span-2">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-rc-brand" />
                    </div>
                    <div>
                      <CardTitle className="text-rc-ink text-xl">Favorite Fishing Location</CardTitle>
                      <CardDescription className="text-rc-ink-mute mt-1">
                        Set your default location for quick access to forecasts
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-rc-ink font-medium text-sm">
                        Location
                      </Label>
                      <Select value={preferences.favoriteLocation} onValueChange={handleLocationChange}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {fishingLocations.map(location => (
                            <SelectItem key={location.id} value={location.name}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-rc-ink-mute">Choose your preferred fishing region</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hotspot" className="text-rc-ink font-medium text-sm">
                        Fishing Hotspot
                      </Label>
                      <Select value={preferences.favoriteHotspot} onValueChange={handleHotspotChange}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select hotspot" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableHotspots.map(hotspot => (
                            <SelectItem key={hotspot.name} value={hotspot.name}>
                              {hotspot.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-rc-ink-mute">Specific spot within your chosen location</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="species" className="text-rc-ink font-medium text-sm">
                      Target Species <span className="text-rc-ink-mute font-normal">(Optional)</span>
                    </Label>
                    <div className="max-w-md">
                      <Select
                        value={preferences.favoriteSpecies || 'none'}
                        onValueChange={value =>
                          setPreferences(prev => ({ ...prev, favoriteSpecies: value === 'none' ? undefined : value }))
                        }
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select species" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No preference</SelectItem>
                          {fishSpecies.map(species => (
                            <SelectItem key={species.id} value={species.name}>
                              {species.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-rc-ink-mute">Species-specific forecasts and recommendations</p>
                  </div>

                  {preferences.favoriteLat && preferences.favoriteLon && (
                    <div className="mt-6 p-4 bg-rc-good-soft rounded-xl border border-rc-good-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-rc-good-bg rounded-full flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-rc-good" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-rc-good-ink">Location Confirmed</p>
                          <p className="text-xs text-rc-ink-mute">
                            Coordinates: {preferences.favoriteLat?.toFixed(4)}, {preferences.favoriteLon?.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Subscription */}
            <SubscriptionCard />

            {/* Unit Preferences */}
            <Card className="border-rc-rule shadow-none">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                    <Gauge className="h-5 w-5 text-rc-brand" />
                  </div>
                  <div>
                    <CardTitle className="text-rc-ink text-xl">Unit Preferences</CardTitle>
                    <CardDescription className="text-rc-ink-mute mt-1">
                      Choose your preferred units for weather and environmental data
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Wind Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="wind-unit" className="text-rc-ink font-medium text-sm">
                      Wind Speed
                    </Label>
                    <Select
                      value={preferences.windUnit || 'knots'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, windUnit: value as 'kph' | 'mph' | 'knots' }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kph">km/h</SelectItem>
                        <SelectItem value="mph">mph</SelectItem>
                        <SelectItem value="knots">knots</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-rc-ink-mute">Wind and current speed</p>
                  </div>

                  {/* Temperature Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="temp-unit" className="text-rc-ink font-medium text-sm">
                      Temperature
                    </Label>
                    <Select
                      value={preferences.tempUnit || 'C'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, tempUnit: value as 'C' | 'F' }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="C">Celsius (°C)</SelectItem>
                        <SelectItem value="F">Fahrenheit (°F)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-rc-ink-mute">Air and water temperature</p>
                  </div>

                  {/* Precipitation Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="precip-unit" className="text-rc-ink font-medium text-sm">
                      Precipitation
                    </Label>
                    <Select
                      value={preferences.precipUnit || 'mm'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, precipUnit: value as 'mm' | 'inches' }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mm">Millimeters (mm)</SelectItem>
                        <SelectItem value="inches">Inches (in)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-rc-ink-mute">Rainfall and precipitation</p>
                  </div>

                  {/* Height Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="height-unit" className="text-rc-ink font-medium text-sm">
                      Height / Depth
                    </Label>
                    <Select
                      value={preferences.heightUnit || 'ft'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, heightUnit: value as 'ft' | 'm' }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Meters (m)</SelectItem>
                        <SelectItem value="ft">Feet (ft)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-rc-ink-mute">Tide heights and wave heights</p>
                  </div>

                  {/* Distance Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="distance-unit" className="text-rc-ink font-medium text-sm">
                      Distance
                    </Label>
                    <Select
                      value={preferences.distanceUnit || 'km'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, distanceUnit: value as 'km' | 'miles' }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="km">Kilometers (km)</SelectItem>
                        <SelectItem value="miles">Miles (mi)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-rc-ink-mute">Map and travel distance</p>
                  </div>

                  {/* Pressure Unit */}
                  <div className="space-y-2">
                    <Label htmlFor="pressure-unit" className="text-rc-ink font-medium text-sm">
                      Pressure
                    </Label>
                    <Select
                      value={preferences.pressureUnit || 'mb'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, pressureUnit: value as 'mb' | 'inHg' }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mb">Millibars (mb)</SelectItem>
                        <SelectItem value="inHg">Inches of mercury (inHg)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-rc-ink-mute">Barometric pressure</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-rc-surface rounded-xl border border-rc-rule">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-rc-brand-soft rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Gauge className="h-4 w-4 text-rc-brand" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-rc-ink">Quick Tip</p>
                      <p className="text-xs text-rc-ink-mute mt-1">
                        You can also click on any value in the forecast to cycle through available units without visiting this page.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card className="border-rc-rule shadow-none">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                    <Bell className="h-5 w-5 text-rc-brand" />
                  </div>
                  <div>
                    <CardTitle className="text-rc-ink text-xl">Notification Preferences</CardTitle>
                    <CardDescription className="text-rc-ink-mute mt-1">
                      Manage how you receive updates and alerts
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-rc-surface rounded-xl border border-rc-rule">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                      <Mail className="h-5 w-5 text-rc-brand" />
                    </div>
                    <div>
                      <p className="text-rc-ink font-medium">Email Forecasts</p>
                      <p className="text-sm text-rc-ink-mute">Receive daily forecast emails</p>
                    </div>
                  </div>
                  <Button
                    variant={preferences.emailForecasts ? 'default' : 'outline'}
                    size="sm"
                    className={
                      preferences.emailForecasts
                        ? 'bg-rc-good hover:bg-rc-good/90 text-white'
                        : 'border-rc-rule text-rc-ink-soft hover:bg-rc-surface'
                    }
                    onClick={() =>
                      setPreferences(prev => ({
                        ...prev,
                        emailForecasts: !prev.emailForecasts,
                      }))
                    }
                  >
                    {preferences.emailForecasts ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {preferences.emailForecasts && (
                  <div className="p-4 bg-rc-surface rounded-xl border border-rc-rule">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-rc-brand-soft rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-rc-brand" />
                      </div>
                      <div>
                        <h4 className="text-rc-ink font-medium">Notification Timing</h4>
                        <p className="text-xs text-rc-ink-mute">Customize when you receive daily forecasts</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="notification-time" className="text-rc-ink text-sm font-medium">
                          Notification Time
                        </Label>
                        <Input
                          id="notification-time"
                          type="time"
                          value={preferences.notificationTime || '06:00'}
                          onChange={e =>
                            setPreferences(prev => ({
                              ...prev,
                              notificationTime: e.target.value,
                            }))
                          }
                          className="h-10 bg-rc-panel"
                        />
                        <p className="text-xs text-rc-ink-mute">Time to receive daily forecast (24-hour format)</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timezone" className="text-rc-ink text-sm font-medium">
                          Timezone
                        </Label>
                        <Select
                          value={preferences.timezone || 'America/Vancouver'}
                          onValueChange={value =>
                            setPreferences(prev => ({
                              ...prev,
                              timezone: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 bg-rc-panel">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/Vancouver">Pacific Time (Vancouver)</SelectItem>
                            <SelectItem value="America/Edmonton">Mountain Time (Edmonton)</SelectItem>
                            <SelectItem value="America/Winnipeg">Central Time (Winnipeg)</SelectItem>
                            <SelectItem value="America/Toronto">Eastern Time (Toronto)</SelectItem>
                            <SelectItem value="America/Halifax">Atlantic Time (Halifax)</SelectItem>
                            <SelectItem value="America/St_Johns">Newfoundland Time</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-rc-ink-mute">Your local timezone for notifications</p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-rc-brand-soft border border-rc-brand-soft2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-rc-brand" />
                        <p className="text-sm text-rc-brand font-medium">
                          Daily notifications will be sent at{' '}
                          {new Date(`2000-01-01T${preferences.notificationTime || '06:00'}`).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}{' '}
                          {preferences.timezone?.split('/')[1]?.replace('_', ' ') || 'Vancouver'} time
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Link to Forecast Emails (scheduled digests) */}
                <div className="pt-4 mt-6 border-t border-rc-rule">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/profile/forecast-emails')}
                    className="w-full border-rc-rule text-rc-brand hover:bg-rc-brand-soft hover:text-rc-brand transition-colors"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Forecast Email Settings
                    <span className="ml-auto text-[10px] font-bold bg-rc-badge text-rc-ink px-2 py-1 rounded">
                      New
                    </span>
                  </Button>
                  <p className="text-xs text-rc-ink-mute mt-2 text-center">
                    Configure location, weather thresholds, species alerts & more
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Phone verification (SMS alerts) */}
            <PhoneVerifyCard />

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSavePreferences}
                disabled={saving}
                className="bg-rc-brand hover:bg-rc-brand-hover text-white px-8 py-3 text-base font-semibold"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving Preferences...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>

            {/* Danger zone */}
            <DangerZoneCard />
          </div>
        </div>
      </main>
    </div>
  )
}
