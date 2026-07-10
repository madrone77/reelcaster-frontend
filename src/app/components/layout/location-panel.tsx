'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Star } from 'lucide-react'
import { Logo } from '@/app/components/common/logo'
import { getRegulationsByLocation } from '@/app/data/regulations'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import {
  FISHING_LOCATIONS,
  getLocationByName,
  getDefaultLocation,
  type FishingLocation,
  type Hotspot,
} from '@/app/config/locations'

interface FavoriteSpot {
  id: string
  name: string
  location: string | null
  lat: number
  lon: number
}
/** Selected item background color */
const SELECTED_BG = 'bg-[#2F2F2F]'

interface FishSpecies {
  id: string
  name: string
  status: string
  scientificName?: string
}

interface SectionHeaderProps {
  children: React.ReactNode
}

function SectionHeader({ children }: SectionHeaderProps) {
  return (
    <h3 className="text-xs font-semibold text-rc-text-muted uppercase tracking-wider mb-2">
      {children}
    </h3>
  )
}

interface SelectableItemProps {
  isSelected: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function SelectableItem({ isSelected, disabled, onClick, children }: SelectableItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
        isSelected
          ? `${SELECTED_BG} text-rc-text`
          : disabled
          ? 'text-rc-text-muted cursor-not-allowed'
          : 'text-rc-text-light hover:bg-rc-bg-light hover:text-rc-text'
      }`}
    >
      {children}
    </button>
  )
}

export default function LocationPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const currentLocation = searchParams.get('location') || 'Victoria, Sidney'
  const currentHotspot = searchParams.get('hotspot') || 'Breakwater'
  const currentSpecies = searchParams.get('species') || null

  // Favorite spots
  const [favoriteSpots, setFavoriteSpots] = useState<FavoriteSpot[]>([])

  useEffect(() => {
    if (!user) return
    const fetchFavorites = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/favorite-spots', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setFavoriteSpots(data.spots || [])
        }
      } catch {
        // silently fail
      }
    }
    fetchFavorites()
  }, [user])

  const selectedLocationData = useMemo(() => {
    return getLocationByName(currentLocation) || getDefaultLocation()
  }, [currentLocation])

  const species = useMemo((): FishSpecies[] => {
    const regulations = getRegulationsByLocation(currentLocation)
    if (!regulations) return []
    return regulations.species.map(s => ({
      id: s.id,
      name: s.name,
      scientificName: s.scientificName,
      status: s.status,
    }))
  }, [currentLocation])

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`/?${params.toString()}`)
  }, [router, searchParams])

  const handleLocationSelect = useCallback((location: FishingLocation) => {
    if (!location.available) return

    const firstHotspot = location.hotspots[0]
    updateParams({
      location: location.name,
      hotspot: firstHotspot?.name || null,
      lat: firstHotspot?.coordinates.lat.toString() || null,
      lon: firstHotspot?.coordinates.lon.toString() || null,
      species: null,
    })
  }, [updateParams])

  const handleHotspotSelect = useCallback((hotspot: Hotspot) => {
    updateParams({
      hotspot: hotspot.name,
      lat: hotspot.coordinates.lat.toString(),
      lon: hotspot.coordinates.lon.toString(),
    })
  }, [updateParams])

  const handleSpeciesSelect = useCallback((speciesItem: FishSpecies | null) => {
    updateParams({
      species: speciesItem?.id || null,
    })
  }, [updateParams])

  return (
    <div className="hidden lg:flex w-[200px] h-screen bg-rc-bg-darkest border-r border-rc-bg-light flex-col fixed left-[100px] top-0 z-40">
    
      <div className="h-20 flex items-center px-4 border-b border-rc-bg-light">
        <Logo size="lg" className="mr-2 text-white" />
        <span className="text-2xl font-bold text-rc-text">Reelcaster</span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Location Section */}
        <section className="p-3" aria-label="Location selection">
          <SectionHeader>Location</SectionHeader>
          <ul className="space-y-1">
            {FISHING_LOCATIONS.map(location => (
              <li key={location.name}>
                <SelectableItem
                  isSelected={currentLocation === location.name}
                  disabled={!location.available}
                  onClick={() => handleLocationSelect(location)}
                >
                  <div className="font-medium text-sm">{location.name}</div>
                  <div className="text-xs text-rc-text-muted">
                    {location.available
                      ? `${location.hotspots.length} Hotspots`
                      : 'Coming soon'}
                  </div>
                </SelectableItem>
              </li>
            ))}
          </ul>
        </section>

        {/* Area Section */}
        <section className="p-3 border-t border-rc-bg-light" aria-label="Area selection">
          <SectionHeader>Area</SectionHeader>
          <ul className="space-y-0.5">
            {selectedLocationData.hotspots.map(hotspot => (
              <li key={hotspot.name}>
                <SelectableItem
                  isSelected={currentHotspot === hotspot.name}
                  onClick={() => handleHotspotSelect(hotspot)}
                >
                  <span className="text-sm">{hotspot.name}</span>
                </SelectableItem>
              </li>
            ))}
            {currentHotspot === 'Custom Pin' && (
              <li>
                <SelectableItem isSelected onClick={() => {}}>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-sm text-amber-400">Custom Pin</span>
                  </div>
                </SelectableItem>
              </li>
            )}
          </ul>
        </section>

        {/* Favorites Section */}
        {favoriteSpots.length > 0 && (
          <section className="p-3 border-t border-rc-bg-light" aria-label="Favorite spots">
            <div className="flex items-center justify-between mb-2">
              <SectionHeader>Favorites</SectionHeader>
            </div>
            <ul className="space-y-0.5">
              {favoriteSpots.map(spot => (
                <li key={spot.id}>
                  <SelectableItem
                    isSelected={currentHotspot === spot.name}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString())
                      params.set('hotspot', spot.name)
                      params.set('lat', spot.lat.toString())
                      params.set('lon', spot.lon.toString())
                      if (spot.location) params.set('location', spot.location)
                      router.push(`/?${params.toString()}`)
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span className="text-sm truncate">{spot.name}</span>
                    </div>
                  </SelectableItem>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Species Section */}
        <section className="p-3 border-t border-rc-bg-light" aria-label="Species selection">
          <SectionHeader>Species</SectionHeader>
          <ul className="space-y-0.5">
            <li>
              <SelectableItem
                isSelected={!currentSpecies}
                onClick={() => handleSpeciesSelect(null)}
              >
                <span className="text-sm">All Species</span>
              </SelectableItem>
            </li>
            {species.map(s => (
              <li key={s.id}>
                <SelectableItem
                  isSelected={currentSpecies === s.id}
                  onClick={() => handleSpeciesSelect(s)}
                >
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className={`text-xs ${
                    s.status === 'Open' || s.status === 'open' ? 'text-green-400' :
                    s.status === 'Restricted' || s.status === 'restricted' ? 'text-yellow-400' :
                    s.status === 'Non Retention' || s.status === 'non-retention' ? 'text-orange-400' :
                    s.status === 'Closed' || s.status === 'closed' ? 'text-red-400' :
                    'text-rc-text-muted'
                  }`}>
                    {s.status}
                  </div>
                </SelectableItem>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
