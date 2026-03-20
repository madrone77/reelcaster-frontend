'use client'

import { RefreshCw } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FISHING_LOCATIONS,
  type FishingLocation,
  type FishingHotspot,
} from '@/app/config/locations'
import { SPECIES_PROFILES } from '@/app/utils/fishingCalculations'

interface DataControlsProps {
  selectedLocation: FishingLocation
  selectedHotspot: FishingHotspot
  selectedSpecies: string | null
  loading: boolean
  onLocationChange: (locationId: string) => void
  onHotspotChange: (hotspotName: string) => void
  onSpeciesChange: (species: string | null) => void
  onRefresh: () => void
}

const availableLocations = FISHING_LOCATIONS.filter((l) => l.available)
const speciesKeys = Object.keys(SPECIES_PROFILES)

export default function DataControls({
  selectedLocation,
  selectedHotspot,
  selectedSpecies,
  loading,
  onLocationChange,
  onHotspotChange,
  onSpeciesChange,
  onRefresh,
}: DataControlsProps) {
  return (
    <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-rc-text-muted mb-2">
            Location
          </label>
          <Select
            value={selectedLocation.id}
            onValueChange={onLocationChange}
          >
            <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hotspot */}
        <div>
          <label className="block text-xs font-medium text-rc-text-muted mb-2">
            Hotspot
          </label>
          <Select
            value={selectedHotspot.name}
            onValueChange={onHotspotChange}
          >
            <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectedLocation.hotspots.map((h) => (
                <SelectItem key={h.name} value={h.name}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Species */}
        <div>
          <label className="block text-xs font-medium text-rc-text-muted mb-2">
            Species
          </label>
          <Select
            value={selectedSpecies ?? '__none__'}
            onValueChange={(v) =>
              onSpeciesChange(v === '__none__' ? null : v)
            }
          >
            <SelectTrigger className="bg-rc-bg-light border-rc-bg-light text-rc-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">General (No Species)</SelectItem>
              {speciesKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {SPECIES_PROFILES[key].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refresh */}
        <div className="flex items-end">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-rc-text rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
