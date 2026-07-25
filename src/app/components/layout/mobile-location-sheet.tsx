'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, MapPin, Target, ChevronRight } from 'lucide-react'
import { getRegulationsByLocation } from '@/app/data/regulations'
import {
  FISHING_LOCATIONS,
  type FishingLocation,
  type Hotspot,
} from '@/app/config/locations'

interface MobileLocationSheetProps {
  isOpen: boolean
  onClose: () => void
}

interface FishSpecies {
  id: string
  name: string
  status: 'open' | 'restricted' | 'closed' | 'non-retention'
}

type Step = 'location' | 'area' | 'species'

export default function MobileLocationSheet({ isOpen, onClose }: MobileLocationSheetProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>('location')
  const [selectedLocation, setSelectedLocation] = useState<FishingLocation | null>(null)
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null)

  const currentLocation = searchParams.get('location') || 'Victoria, Sidney'
  const currentHotspot = searchParams.get('hotspot') || 'Breakwater'

  // Initialize from URL params
  useEffect(() => {
    if (isOpen) {
      const loc = FISHING_LOCATIONS.find(l => l.name === currentLocation)
      if (loc) {
        setSelectedLocation(loc)
        const hotspot = loc.hotspots.find(h => h.name === currentHotspot)
        if (hotspot) {
          setSelectedHotspot(hotspot)
        }
      }
      setStep('location')
    }
  }, [isOpen, currentLocation, currentHotspot])

  const species = useMemo(() => {
    if (!selectedLocation) return []
    const regulations = getRegulationsByLocation(selectedLocation.name)
    if (!regulations) return []
    return regulations.species.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status as 'open' | 'restricted' | 'closed' | 'non-retention',
    }))
  }, [selectedLocation])

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    router.push(`/?${params.toString()}`)
  }

  const handleLocationSelect = (location: FishingLocation) => {
    if (!location.available) return
    setSelectedLocation(location)
    setStep('area')
  }

  const handleHotspotSelect = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot)
    setStep('species')
  }

  const handleSpeciesSelect = (speciesItem: FishSpecies | null) => {
    if (!selectedLocation || !selectedHotspot) return

    updateParams({
      location: selectedLocation.name,
      hotspot: selectedHotspot.name,
      lat: selectedHotspot.coordinates.lat.toString(),
      lon: selectedHotspot.coordinates.lon.toString(),
      species: speciesItem?.id || null,
    })
    onClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-green-400'
      case 'restricted': return 'text-red-400'
      case 'non-retention': return 'text-orange-400'
      case 'closed': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const getStepTitle = () => {
    switch (step) {
      case 'location': return 'Select Location'
      case 'area': return 'Select Area'
      case 'species': return 'Select Species'
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 lg:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden animate-slide-up">
        <div className="bg-rc-bg-dark rounded-t-2xl max-h-[80vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-rc-bg-light rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-rc-bg-light">
            <div className="flex items-center gap-2">
              {step !== 'location' && (
                <button
                  onClick={() => setStep(step === 'species' ? 'area' : 'location')}
                  className="text-rc-text-muted hover:text-rc-text p-1"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              )}
              <h2 className="text-lg font-semibold text-rc-text">{getStepTitle()}</h2>
            </div>
            <button onClick={onClose} className="text-rc-text-muted hover:text-rc-text p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-safe">
            {step === 'location' && (
              <ul className="space-y-2">
                {FISHING_LOCATIONS.map(location => (
                  <li key={location.name}>
                    <button
                      onClick={() => handleLocationSelect(location)}
                      disabled={!location.available}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        selectedLocation?.name === location.name
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : location.available
                          ? 'bg-rc-bg-light active:bg-rc-bg-darkest'
                          : 'bg-rc-bg-light/50 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className={`w-5 h-5 ${location.available ? 'text-blue-400' : 'text-rc-text-muted'}`} />
                        <div>
                          <div className="font-medium text-rc-text">{location.name}</div>
                          <div className="text-sm text-rc-text-muted">
                            {location.available ? `${location.hotspots.length} Hotspots` : 'Coming soon'}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step === 'area' && selectedLocation && (
              <ul className="space-y-2">
                {selectedLocation.hotspots.map(hotspot => (
                  <li key={hotspot.name}>
                    <button
                      onClick={() => handleHotspotSelect(hotspot)}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        selectedHotspot?.name === hotspot.name
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : 'bg-rc-bg-light active:bg-rc-bg-darkest'
                      }`}
                    >
                      <div className="font-medium text-rc-text">{hotspot.name}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {step === 'species' && (
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => handleSpeciesSelect(null)}
                    className="w-full text-left p-4 rounded-xl bg-rc-bg-light active:bg-rc-bg-darkest transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-blue-400" />
                      <div className="font-medium text-rc-text">All Species</div>
                    </div>
                  </button>
                </li>
                {species.map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => handleSpeciesSelect(s)}
                      className="w-full text-left p-4 rounded-xl bg-rc-bg-light active:bg-rc-bg-darkest transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Target className={`w-5 h-5 ${getStatusColor(s.status)}`} />
                        <div>
                          <div className="font-medium text-rc-text">{s.name}</div>
                          <div className={`text-sm ${getStatusColor(s.status)}`}>
                            {s.status.charAt(0).toUpperCase() + s.status.slice(1).replace('-', ' ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
