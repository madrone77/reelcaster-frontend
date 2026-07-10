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
import { useAnalytics } from '@/hooks/use-analytics'
import { UserPreferences, UserPreferencesService } from '@/lib/user-preferences'
import { AppShell } from '../components/layout'
import DashboardHeader from '../components/forecast/dashboard-header'
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
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const originalPreferences = useRef<UserPreferences>({})
  const hasTrackedView = useRef(false)

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
      <AppShell showLocationPanel={false}>
        <div className="flex-1 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-rc-text">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const currentLocation = fishingLocations.find(loc => loc.name === preferences.favoriteLocation)
  const availableHotspots = currentLocation?.hotspots || []

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Profile Settings"
          showTimeframe={false}
          showSetLocation={false}
        />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Message */}
          {message && (
            <Alert
              className={
                message.type === 'success'
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : 'border-red-500 bg-red-50 text-red-800'
              }
            >
              {message.text}
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Account Information */}
            <Card className="bg-rc-bg-dark border-rc-bg-light">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-rc-text" />
                  </div>
                  <div>
                    <CardTitle className="text-rc-text">Account Information</CardTitle>
                    <CardDescription className="text-rc-text-muted">Your account details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-rc-bg-light/50 rounded-lg">
                    <Mail className="h-5 w-5 text-rc-text-muted" />
                    <div>
                      <p className="text-sm font-medium text-rc-text">Email</p>
                      <p className="text-sm text-rc-text-muted">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-rc-bg-light/50 rounded-lg">
                    <Calendar className="h-5 w-5 text-rc-text-muted" />
                    <div>
                      <p className="text-sm font-medium text-rc-text">Member Since</p>
                      <p className="text-sm text-rc-text-muted">{new Date(user.created_at || '').toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-rc-bg-light">
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="w-full border-red-500 text-red-400 hover:bg-red-500 hover:text-rc-text"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Favorite Locations */}
            <Card className="bg-rc-bg-dark border-rc-bg-light lg:col-span-2">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-rc-text" />
                  </div>
                  <div>
                    <CardTitle className="text-rc-text text-xl">Favorite Fishing Location</CardTitle>
                    <CardDescription className="text-rc-text-muted mt-1">
                      Set your default location for quick access to forecasts
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-rc-text font-medium text-sm">
                      Location
                    </Label>
                    <Select value={preferences.favoriteLocation} onValueChange={handleLocationChange}>
                      <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
                    <p className="text-xs text-rc-text-muted">Choose your preferred fishing region</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hotspot" className="text-rc-text font-medium text-sm">
                      Fishing Hotspot
                    </Label>
                    <Select value={preferences.favoriteHotspot} onValueChange={handleHotspotChange}>
                      <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
                    <p className="text-xs text-rc-text-muted">Specific spot within your chosen location</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="species" className="text-rc-text font-medium text-sm">
                    Target Species <span className="text-rc-text-muted font-normal">(Optional)</span>
                  </Label>
                  <div className="max-w-md">
                    <Select
                      value={preferences.favoriteSpecies || 'none'}
                      onValueChange={value =>
                        setPreferences(prev => ({ ...prev, favoriteSpecies: value === 'none' ? undefined : value }))
                      }
                    >
                      <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
                  <p className="text-xs text-rc-text-muted">Species-specific forecasts and recommendations</p>
                </div>

                {preferences.favoriteLat && preferences.favoriteLon && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-slate-700/40 to-slate-600/40 rounded-xl border border-rc-bg-light/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-rc-text">Location Confirmed</p>
                        <p className="text-xs text-rc-text-muted">
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
          <Card className="bg-rc-bg-dark border-rc-bg-light">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <Gauge className="h-6 w-6 text-rc-text" />
                </div>
                <div>
                  <CardTitle className="text-rc-text text-xl">Unit Preferences</CardTitle>
                  <CardDescription className="text-rc-text-muted mt-1">
                    Choose your preferred units for weather and environmental data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Wind Unit */}
                <div className="space-y-2">
                  <Label htmlFor="wind-unit" className="text-rc-text font-medium text-sm">
                    Wind Speed
                  </Label>
                  <Select
                    value={preferences.windUnit || 'kph'}
                    onValueChange={value =>
                      setPreferences(prev => ({ ...prev, windUnit: value as 'kph' | 'mph' | 'knots' }))
                    }
                  >
                    <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kph">km/h</SelectItem>
                      <SelectItem value="mph">mph</SelectItem>
                      <SelectItem value="knots">knots</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-rc-text-muted">Wind and current speed</p>
                </div>

                {/* Temperature Unit */}
                <div className="space-y-2">
                  <Label htmlFor="temp-unit" className="text-rc-text font-medium text-sm">
                    Temperature
                  </Label>
                  <Select
                    value={preferences.tempUnit || 'C'}
                    onValueChange={value =>
                      setPreferences(prev => ({ ...prev, tempUnit: value as 'C' | 'F' }))
                    }
                  >
                    <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="C">Celsius (°C)</SelectItem>
                      <SelectItem value="F">Fahrenheit (°F)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-rc-text-muted">Air and water temperature</p>
                </div>

                {/* Precipitation Unit */}
                <div className="space-y-2">
                  <Label htmlFor="precip-unit" className="text-rc-text font-medium text-sm">
                    Precipitation
                  </Label>
                  <Select
                    value={preferences.precipUnit || 'mm'}
                    onValueChange={value =>
                      setPreferences(prev => ({ ...prev, precipUnit: value as 'mm' | 'inches' }))
                    }
                  >
                    <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">Millimeters (mm)</SelectItem>
                      <SelectItem value="inches">Inches (in)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-rc-text-muted">Rainfall and precipitation</p>
                </div>

                {/* Height Unit */}
                <div className="space-y-2">
                  <Label htmlFor="height-unit" className="text-rc-text font-medium text-sm">
                    Height / Depth
                  </Label>
                  <Select
                    value={preferences.heightUnit || 'm'}
                    onValueChange={value =>
                      setPreferences(prev => ({ ...prev, heightUnit: value as 'ft' | 'm' }))
                    }
                  >
                    <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Meters (m)</SelectItem>
                      <SelectItem value="ft">Feet (ft)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-rc-text-muted">Tide heights and wave heights</p>
                </div>

                {/* Distance Unit */}
                <div className="space-y-2">
                  <Label htmlFor="distance-unit" className="text-rc-text font-medium text-sm">
                    Distance
                  </Label>
                  <Select
                    value={preferences.distanceUnit || 'km'}
                    onValueChange={value =>
                      setPreferences(prev => ({ ...prev, distanceUnit: value as 'km' | 'miles' }))
                    }
                  >
                    <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Kilometers (km)</SelectItem>
                      <SelectItem value="miles">Miles (mi)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-rc-text-muted">Map and travel distance</p>
                </div>

                {/* Pressure Unit */}
                <div className="space-y-2">
                  <Label htmlFor="pressure-unit" className="text-rc-text font-medium text-sm">
                    Pressure
                  </Label>
                  <Select
                    value={preferences.pressureUnit || 'mb'}
                    onValueChange={value =>
                      setPreferences(prev => ({ ...prev, pressureUnit: value as 'mb' | 'inHg' }))
                    }
                  >
                    <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mb">Millibars (mb)</SelectItem>
                      <SelectItem value="inHg">Inches of mercury (inHg)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-rc-text-muted">Barometric pressure</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-slate-700/40 to-slate-600/40 rounded-xl border border-rc-bg-light/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Gauge className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-rc-text">Quick Tip</p>
                    <p className="text-xs text-rc-text-muted mt-1">
                      You can also click on any value in the forecast to cycle through available units without visiting this page.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="bg-rc-bg-dark border-rc-bg-light">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                  <Bell className="h-6 w-6 text-rc-text" />
                </div>
                <div>
                  <CardTitle className="text-rc-text text-xl">Notification Preferences</CardTitle>
                  <CardDescription className="text-rc-text-muted mt-1">
                    Manage how you receive updates and alerts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-rc-bg-light/30 rounded-xl border border-rc-bg-light/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <Mail className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-rc-text font-medium">Email Forecasts</p>
                    <p className="text-sm text-rc-text-muted">Receive daily forecast emails</p>
                  </div>
                </div>
                <Button
                  variant={preferences.emailForecasts ? 'default' : 'outline'}
                  size="sm"
                  className={preferences.emailForecasts ? 'bg-green-600 hover:bg-green-700' : ''}
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
                <div className="p-4 bg-rc-bg-dark/50 rounded-xl border border-rc-bg-light/30">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-rc-text font-medium">Notification Timing</h4>
                      <p className="text-xs text-rc-text-muted">Customize when you receive daily forecasts</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="notification-time" className="text-rc-text text-sm font-medium">
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
                        className="bg-rc-bg-light border-rc-bg-light text-rc-text h-10 focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-rc-text-muted">Time to receive daily forecast (24-hour format)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="text-rc-text text-sm font-medium">
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
                        <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text h-10 focus:ring-2 focus:ring-blue-500">
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
                      <p className="text-xs text-rc-text-muted">Your local timezone for notifications</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-400" />
                      <p className="text-sm text-blue-400 font-medium">
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
              <div className="pt-4 mt-6 border-t border-rc-bg-light">
                <Button
                  variant="outline"
                  onClick={() => router.push('/profile/forecast-emails')}
                  className="w-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-blue-500/30 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 transition-all"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Forecast Email Settings
                  <span className="ml-auto text-xs bg-blue-500/20 px-2 py-1 rounded">
                    New
                  </span>
                </Button>
                <p className="text-xs text-rc-text-muted mt-2 text-center">
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
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-rc-text px-8 py-3 text-base font-semibold shadow-lg hover:shadow-blue-500/20 transition-all duration-300"
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
    </AppShell>
  )
}
