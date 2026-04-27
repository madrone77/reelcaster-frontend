'use client'

import { FISHING_LOCATIONS } from '@/app/config/locations'

interface AccuracyFilterBarProps {
  location: string
  hotspot: string
  version: string
  dateRange: { from: string; to: string }
  onLocationChange: (value: string) => void
  onHotspotChange: (value: string) => void
  onVersionChange: (value: string) => void
  onDateRangeChange: (range: { from: string; to: string }) => void
  versions: { id: string; name: string }[]
}

export default function AccuracyFilterBar({
  location,
  hotspot,
  version,
  dateRange,
  onLocationChange,
  onHotspotChange,
  onVersionChange,
  onDateRangeChange,
  versions,
}: AccuracyFilterBarProps) {
  const activeLocations = FISHING_LOCATIONS.filter(l => l.available)
  const selectedLocation = activeLocations.find(l => l.id === location)
  const hotspots = selectedLocation?.hotspots || []

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Location */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-rc-text-muted">Location</label>
        <select
          value={location}
          onChange={(e) => {
            onLocationChange(e.target.value)
            onHotspotChange('')
          }}
          className="bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Locations</option>
          {activeLocations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Hotspot */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-rc-text-muted">Hotspot</label>
        <select
          value={hotspot}
          onChange={(e) => onHotspotChange(e.target.value)}
          className="bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!location}
        >
          <option value="">All Hotspots</option>
          {hotspots.map(h => (
            <option key={h.name} value={h.name}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* Algorithm Version */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-rc-text-muted">Algorithm</label>
        <select
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
          className="bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Versions</option>
          {versions.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-rc-text-muted">From</label>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
          className="bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-rc-text-muted">To</label>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
          className="bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quick range buttons */}
      <div className="flex gap-1">
        {[7, 30, 60, 90].map(days => (
          <button
            key={days}
            onClick={() => {
              const to = new Date().toISOString().split('T')[0]
              const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
              onDateRangeChange({ from, to })
            }}
            className="px-3 py-2 bg-rc-bg-light hover:bg-rc-bg-dark border border-rc-bg-light rounded-lg text-xs text-rc-text-muted hover:text-rc-text transition-colors"
          >
            {days}d
          </button>
        ))}
      </div>
    </div>
  )
}
