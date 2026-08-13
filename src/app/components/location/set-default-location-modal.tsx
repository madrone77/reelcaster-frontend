'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, MapPin, Heart, ChevronDown, Star, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { UserPreferencesService } from '@/lib/user-preferences'
import { FISHING_LOCATIONS, type FishingLocation } from '@/app/config/locations'
import LocationMiniMap from './location-mini-map'

interface SetDefaultLocationModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SelectedLocation {
  name: string
  lat: number
  lon: number
  type: 'predefined' | 'saved' | 'custom'
  region?: string
}

interface SavedLocation {
  id: string
  name: string
  location: string | null
  lat: number
  lon: number
  notes: string | null
  created_at: string
}

type TabType = 'predefined' | 'saved' | 'custom'

export default function SetDefaultLocationModal({ isOpen, onClose }: SetDefaultLocationModalProps) {
  const router = useRouter()
  const { user, session } = useAuth()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('predefined')

  // Selection state
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [navigateAfter, setNavigateAfter] = useState(true)

  // Current default location
  const [currentDefault, setCurrentDefault] = useState<{
    location: string
    hotspot: string
    lat: number
    lon: number
  } | null>(null)

  // Saved locations data
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [savedLocationsLoading, setSavedLocationsLoading] = useState(false)

  // Custom pin position
  const [customPin, setCustomPin] = useState<{ lat: number; lon: number } | null>(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Expanded location groups
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({})

  // Load current default on mount
  useEffect(() => {
    if (isOpen) {
      UserPreferencesService.getDefaultLocation().then(setCurrentDefault)
      // Reset state when modal opens
      setSelectedLocation(null)
      setSaveError(null)
      setCustomPin(null)
    }
  }, [isOpen])

  const loadSavedLocations = useCallback(async () => {
    if (!session) return
    setSavedLocationsLoading(true)
    try {
      const res = await fetch('/api/favorite-spots', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setSavedLocations(data.spots || [])
      }
    } catch (error) {
      console.error('Error loading savedLocations:', error)
    } finally {
      setSavedLocationsLoading(false)
    }
  }, [session])

  // Load savedLocations when tab changes or modal opens
  useEffect(() => {
    if (isOpen && user && session && activeTab === 'saved') {
      loadSavedLocations()
    }
  }, [isOpen, user, session, activeTab, loadSavedLocations])

  // Toggle location group expansion
  const toggleExpand = useCallback((locationName: string) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationName]: !prev[locationName],
    }))
  }, [])

  // Select a location
  const selectLocation = useCallback((location: SelectedLocation) => {
    setSelectedLocation(location)
    setSaveError(null)
  }, [])

  // Handle custom pin change
  const handleCustomPinChange = useCallback((position: { lat: number; lon: number }) => {
    setCustomPin(position)
    selectLocation({
      name: 'Custom Pin',
      lat: position.lat,
      lon: position.lon,
      type: 'custom',
    })
  }, [selectLocation])

  // Check if a hotspot is the current default
  const isCurrentDefault = useCallback((hotspotName: string, lat: number, lon: number) => {
    if (!currentDefault) return false
    return (
      currentDefault.hotspot === hotspotName &&
      Math.abs(currentDefault.lat - lat) < 0.0001 &&
      Math.abs(currentDefault.lon - lon) < 0.0001
    )
  }, [currentDefault])

  // Save as default location
  const handleSave = useCallback(async () => {
    if (!selectedLocation || !user) return

    setSaving(true)
    setSaveError(null)

    try {
      // These four keys are stored user preferences, not local names, and they
      // predate the split between saved locations and saved spots. Renaming
      // them to match the rest of this file would orphan the default location
      // of every account that has one.
      const result = await UserPreferencesService.updateUserPreferences({
        favoriteLocation: selectedLocation.region || selectedLocation.name,
        favoriteHotspot: selectedLocation.name,
        favoriteLat: selectedLocation.lat,
        favoriteLon: selectedLocation.lon,
      })

      if (!result.success) {
        setSaveError(result.error || 'Failed to save preferences')
        setSaving(false)
        return
      }

      // Navigate if checkbox is checked
      if (navigateAfter) {
        const params = new URLSearchParams()
        if (selectedLocation.region) {
          params.set('location', selectedLocation.region)
        }
        params.set('hotspot', selectedLocation.name)
        params.set('lat', selectedLocation.lat.toString())
        params.set('lon', selectedLocation.lon.toString())
        router.push(`/?${params.toString()}`)
      }

      onClose()
    } catch (error) {
      console.error('Error saving default location:', error)
      setSaveError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }, [selectedLocation, user, navigateAfter, router, onClose])

  // Open auth dialog (using the existing auth-dialog)
  const handleOpenAuth = useCallback(() => {
    // Dispatch custom event to open auth dialog
    window.dispatchEvent(new CustomEvent('open-auth-dialog'))
  }, [])

  // Available locations (only show available ones)
  const availableLocations = useMemo(() => {
    return FISHING_LOCATIONS.filter(l => l.available)
  }, [])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-rc-bg-dark rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-rc-bg-light">
            <h2 className="text-lg font-semibold text-rc-text">Set Default Location</h2>
            <button
              onClick={onClose}
              className="text-rc-text-muted hover:text-rc-text p-1 rounded-lg hover:bg-rc-bg-light transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Default Display */}
          {currentDefault && (
            <div className="px-5 py-3 bg-rc-bg-darkest border-b border-rc-bg-light">
              <p className="text-xs text-rc-text-muted mb-1">Current Default</p>
              <p className="text-sm font-medium text-rc-text">{currentDefault.hotspot}</p>
              <p className="text-xs text-rc-text-muted">
                {currentDefault.lat.toFixed(4)}°N, {Math.abs(currentDefault.lon).toFixed(4)}°W
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-rc-bg-light">
            <button
              onClick={() => setActiveTab('predefined')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'predefined'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-rc-bg-light/30'
                  : 'text-rc-text-muted hover:text-rc-text hover:bg-rc-bg-light/20'
              }`}
            >
              Predefined
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'saved'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-rc-bg-light/30'
                  : 'text-rc-text-muted hover:text-rc-text hover:bg-rc-bg-light/20'
              }`}
            >
              Saved locations
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'custom'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-rc-bg-light/30'
                  : 'text-rc-text-muted hover:text-rc-text hover:bg-rc-bg-light/20'
              }`}
            >
              Custom Pin
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Predefined Hotspots Tab */}
            {activeTab === 'predefined' && (
              <div className="space-y-2">
                {availableLocations.map(location => (
                  <LocationGroup
                    key={location.id}
                    location={location}
                    isExpanded={expandedLocations[location.name] ?? false}
                    onToggleExpand={() => toggleExpand(location.name)}
                    selectedLocation={selectedLocation}
                    onSelectLocation={selectLocation}
                    isCurrentDefault={isCurrentDefault}
                  />
                ))}
              </div>
            )}

            {/* Saved locations tab */}
            {activeTab === 'saved' && (
              <div className="space-y-2">
                {!user ? (
                  <AuthPrompt onSignIn={handleOpenAuth} />
                ) : savedLocationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-rc-text-muted animate-spin" />
                  </div>
                ) : savedLocations.length === 0 ? (
                  <EmptySavedLocations />
                ) : (
                  savedLocations.map(spot => (
                    <SavedLocationItem
                      key={spot.id}
                      spot={spot}
                      isSelected={
                        selectedLocation?.type === 'saved' &&
                        selectedLocation?.name === spot.name
                      }
                      onSelect={() =>
                        selectLocation({
                          name: spot.name,
                          lat: spot.lat,
                          lon: spot.lon,
                          type: 'saved',
                          region: spot.location || undefined,
                        })
                      }
                    />
                  ))
                )}
              </div>
            )}

            {/* Custom Pin Tab */}
            {activeTab === 'custom' && (
              <div>
                {!user ? (
                  <AuthPrompt onSignIn={handleOpenAuth} />
                ) : (
                  <LocationMiniMap
                    initialPosition={customPin || undefined}
                    onPositionChange={handleCustomPinChange}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-rc-bg-light space-y-3">
            {/* Navigate checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={navigateAfter}
                onChange={e => setNavigateAfter(e.target.checked)}
                className="w-4 h-4 rounded border-rc-bg-light bg-rc-bg-light text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-rc-text-light">Also navigate to this location</span>
            </label>

            {/* Error message */}
            {saveError && (
              <p className="text-sm text-red-400">{saveError}</p>
            )}

            {/* Save button */}
            {user ? (
              <button
                onClick={handleSave}
                disabled={!selectedLocation || saving}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                  selectedLocation && !saving
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-rc-bg-light text-rc-text-muted cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : selectedLocation ? (
                  `Set ${selectedLocation.name} as Default`
                ) : (
                  'Select a location'
                )}
              </button>
            ) : (
              <button
                onClick={handleOpenAuth}
                className="w-full py-3 rounded-xl text-sm font-medium bg-rc-bg-light text-rc-text-muted hover:bg-rc-bg-light/80 transition-colors"
              >
                Sign in to set default location
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// Sub-components

interface LocationGroupProps {
  location: FishingLocation
  isExpanded: boolean
  onToggleExpand: () => void
  selectedLocation: SelectedLocation | null
  onSelectLocation: (location: SelectedLocation) => void
  isCurrentDefault: (hotspotName: string, lat: number, lon: number) => boolean
}

function LocationGroup({
  location,
  isExpanded,
  onToggleExpand,
  selectedLocation,
  onSelectLocation,
  isCurrentDefault,
}: LocationGroupProps) {
  return (
    <div className="border border-rc-bg-light rounded-xl overflow-hidden">
      {/* Group Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 bg-rc-bg-light/50 hover:bg-rc-bg-light transition-colors"
      >
        <span className="text-sm font-medium text-rc-text">{location.name}</span>
        <ChevronDown
          className={`w-4 h-4 text-rc-text-muted transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Hotspots */}
      {isExpanded && (
        <div className="p-2 space-y-1">
          {location.hotspots.map(hotspot => {
            const isSelected =
              selectedLocation?.type === 'predefined' &&
              selectedLocation?.name === hotspot.name &&
              selectedLocation?.region === location.name
            const isDefault = isCurrentDefault(
              hotspot.name,
              hotspot.coordinates.lat,
              hotspot.coordinates.lon
            )

            return (
              <button
                key={hotspot.name}
                onClick={() =>
                  onSelectLocation({
                    name: hotspot.name,
                    lat: hotspot.coordinates.lat,
                    lon: hotspot.coordinates.lon,
                    type: 'predefined',
                    region: location.name,
                  })
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isSelected
                    ? 'bg-blue-600/20 ring-2 ring-blue-500/50'
                    : 'hover:bg-rc-bg-light'
                }`}
              >
                <MapPin
                  className={`w-4 h-4 flex-shrink-0 ${
                    isSelected ? 'text-blue-400' : 'text-rc-text-muted'
                  }`}
                />
                <div className="flex-1 text-left">
                  <p className={`text-sm ${isSelected ? 'text-rc-text font-medium' : 'text-rc-text-light'}`}>
                    {hotspot.name}
                  </p>
                  <p className="text-xs text-rc-text-muted">
                    {hotspot.coordinates.lat.toFixed(4)}°N, {Math.abs(hotspot.coordinates.lon).toFixed(4)}°W
                  </p>
                </div>
                {isDefault && (
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface SavedLocationItemProps {
  spot: SavedLocation
  isSelected: boolean
  onSelect: () => void
}

function SavedLocationItem({ spot, isSelected, onSelect }: SavedLocationItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isSelected
          ? 'bg-blue-600/20 ring-2 ring-blue-500/50'
          : 'bg-rc-bg-light hover:bg-rc-bg-darkest'
      }`}
    >
      <Heart
        className={`w-5 h-5 flex-shrink-0 ${
          isSelected ? 'text-red-400 fill-red-400' : 'text-red-400/60'
        }`}
      />
      <div className="flex-1 text-left">
        <p className={`text-sm ${isSelected ? 'text-rc-text font-medium' : 'text-rc-text-light'}`}>
          {spot.name}
        </p>
        <p className="text-xs text-rc-text-muted">
          {spot.location || `${spot.lat.toFixed(4)}°N, ${Math.abs(spot.lon).toFixed(4)}°W`}
        </p>
      </div>
    </button>
  )
}

function EmptySavedLocations() {
  return (
    <div className="text-center py-12">
      <Heart className="w-12 h-12 text-rc-text-muted mx-auto mb-4" />
      <h3 className="text-lg font-medium text-rc-text mb-2">No saved locations</h3>
      <p className="text-sm text-rc-text-muted">
        Save spots from the forecast map to see them here.
      </p>
    </div>
  )
}

interface AuthPromptProps {
  onSignIn: () => void
}

function AuthPrompt({ onSignIn }: AuthPromptProps) {
  return (
    <div className="text-center py-12">
      <Heart className="w-12 h-12 text-rc-text-muted mx-auto mb-4" />
      <h3 className="text-lg font-medium text-rc-text mb-2">Sign In Required</h3>
      <p className="text-sm text-rc-text-muted mb-4">
        Sign in to access your saved savedLocations and set custom locations.
      </p>
      <button
        onClick={onSignIn}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Sign In
      </button>
    </div>
  )
}
