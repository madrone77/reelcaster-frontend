'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { UserPreferences, UserPreferencesService } from '@/lib/user-preferences'
import ExploreTopBar from '@/app/explore/components/explore-top-bar'
import NotificationPreferencesForm from '@/app/components/notifications/notification-preferences-form'
import { FISHING_LOCATIONS } from '@/app/config/locations'
import { SPECIES_OPTIONS } from '@/app/config/species'

const fishingLocations = FISHING_LOCATIONS
const fishSpecies = SPECIES_OPTIONS

/**
 * Preferences settings — the default fishing location/species (stored on the
 * user's metadata) plus all notification & alert delivery, which is owned by
 * the `notification_preferences` table via NotificationPreferencesForm (the
 * same form the old /profile/forecast-emails wrapped). Notification delivery
 * lives entirely in that table now; the legacy user-metadata email toggle it
 * duplicated was dropped in the /profile → /settings split.
 */
export default function PreferencesSettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const originalPreferences = useRef<UserPreferences>({})

  useEffect(() => {
    const load = async () => {
      try {
        const userPrefs = await UserPreferencesService.getUserPreferences()
        setPreferences(userPrefs)
        originalPreferences.current = userPrefs
      } catch (error) {
        console.error('Error loading preferences:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
    else if (user === null) router.push('/')
  }, [user, router])

  const handleSavePreferences = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await UserPreferencesService.updateUserPreferences(preferences)
      if (result.success) {
        setMessage({ type: 'success', text: 'Preferences saved.' })
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
    const location = fishingLocations.find((loc) => loc.name === locationName)
    if (location) {
      const firstHotspot = location.hotspots[0]
      setPreferences((prev) => ({
        ...prev,
        favoriteLocation: locationName,
        favoriteHotspot: firstHotspot.name,
        favoriteLat: firstHotspot.coordinates.lat,
        favoriteLon: firstHotspot.coordinates.lon,
      }))
    }
  }

  const handleHotspotChange = (hotspotName: string) => {
    const currentLocation = fishingLocations.find((loc) => loc.name === preferences.favoriteLocation)
    const hotspot = currentLocation?.hotspots.find((h) => h.name === hotspotName)
    if (hotspot) {
      setPreferences((prev) => ({
        ...prev,
        favoriteHotspot: hotspotName,
        favoriteLat: hotspot.coordinates.lat,
        favoriteLon: hotspot.coordinates.lon,
      }))
    }
  }

  if (!user) return null

  const currentLocation = fishingLocations.find((loc) => loc.name === preferences.favoriteLocation)
  const availableHotspots = currentLocation?.hotspots || []

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <div className="rc-label text-[10px] text-rc-brand">Settings</div>
            <h1 className="text-2xl font-bold text-rc-ink mt-1">Preferences</h1>
            <p className="text-sm text-rc-ink-soft mt-1.5">
              Your default location and how ReelCaster reaches you.
            </p>
          </div>

          {loading ? (
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-rc-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
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

              {/* Favorite location + species */}
              <Card className="border-rc-rule shadow-none">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-rc-brand" />
                    </div>
                    <div>
                      <CardTitle className="text-rc-ink text-xl">Default fishing location</CardTitle>
                      <CardDescription className="text-rc-ink-mute mt-1">
                        Where forecasts open to, and your target species
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-rc-ink font-medium text-sm">Location</Label>
                      <Select value={preferences.favoriteLocation} onValueChange={handleLocationChange}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {fishingLocations.map((location) => (
                            <SelectItem key={location.id} value={location.name}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-rc-ink-mute">Choose your preferred fishing region</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hotspot" className="text-rc-ink font-medium text-sm">Fishing Hotspot</Label>
                      <Select value={preferences.favoriteHotspot} onValueChange={handleHotspotChange}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select hotspot" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableHotspots.map((hotspot) => (
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
                        onValueChange={(value) =>
                          setPreferences((prev) => ({ ...prev, favoriteSpecies: value === 'none' ? undefined : value }))
                        }
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select species" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No preference</SelectItem>
                          {fishSpecies.map((species) => (
                            <SelectItem key={species.id} value={species.name}>
                              {species.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-rc-ink-mute">Species-specific forecasts and recommendations</p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSavePreferences}
                      disabled={saving}
                      className="bg-rc-brand hover:bg-rc-brand-hover text-white px-6"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Notification & alert delivery (notification_preferences table) */}
              <Card className="border-rc-rule shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-rc-ink text-xl">Notifications</CardTitle>
                  <CardDescription className="text-rc-ink-mute mt-1">
                    Scheduled forecast digests and the conditions that trigger them. Real-time
                    bite alerts and SMS live in{' '}
                    <a href="/alerts" className="text-rc-brand hover:underline">Alerts</a>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationPreferencesForm />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
