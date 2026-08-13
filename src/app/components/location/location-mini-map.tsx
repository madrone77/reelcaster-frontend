'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import Map, { Marker, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import { MapPin } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useReliefStyle } from '@/lib/map/use-relief-style'

interface LocationMiniMapProps {
  initialPosition?: { lat: number; lon: number }
  onPositionChange: (position: { lat: number; lon: number }) => void
}

const LocationMiniMap: React.FC<LocationMiniMapProps> = ({
  initialPosition,
  onPositionChange,
}) => {
  const mapRef = useRef<MapRef>(null)
  const mapStyle = useReliefStyle()

  // Pin position state
  const [pinPosition, setPinPosition] = useState<{ latitude: number; longitude: number } | null>(
    initialPosition ? { latitude: initialPosition.lat, longitude: initialPosition.lon } : null
  )

  // Map viewport state - center on Victoria, BC by default
  const [viewport, setViewport] = useState({
    latitude: initialPosition?.lat ?? 48.4284,
    longitude: initialPosition?.lon ?? -123.3656,
    zoom: 10,
  })

  // Update pin position when initialPosition changes
  useEffect(() => {
    if (initialPosition) {
      setPinPosition({ latitude: initialPosition.lat, longitude: initialPosition.lon })
      setViewport(prev => ({
        ...prev,
        latitude: initialPosition.lat,
        longitude: initialPosition.lon,
      }))
    }
  }, [initialPosition])

  // Handle map click - place pin
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const { lng, lat } = e.lngLat
    setPinPosition({ latitude: lat, longitude: lng })
    onPositionChange({ lat, lon: lng })
  }, [onPositionChange])

  // Handle pin drag end
  const handlePinDragEnd = useCallback((e: { lngLat: { lng: number; lat: number } }) => {
    const { lng, lat } = e.lngLat
    setPinPosition({ latitude: lat, longitude: lng })
    onPositionChange({ lat, lon: lng })
  }, [onPositionChange])

  return (
    <div className="space-y-2">
      {/* Map Container */}
      <div className="relative w-full h-[200px] sm:h-[250px] rounded-lg overflow-hidden border border-rc-bg-light">
        <Map
          ref={mapRef}
          {...viewport}
          onMove={evt => setViewport(evt.viewState)}
          onClick={handleMapClick}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Custom Pin Marker */}
          {pinPosition && (
            <Marker
              latitude={pinPosition.latitude}
              longitude={pinPosition.longitude}
              anchor="bottom"
              draggable
              onDragEnd={handlePinDragEnd}
            >
              <div className="cursor-grab active:cursor-grabbing">
                <div className="w-10 h-10">
                  <MapPin className="w-full h-full text-amber-500 fill-amber-400 drop-shadow-lg" />
                </div>
              </div>
            </Marker>
          )}
        </Map>

        {/* Coordinates Overlay */}
        {pinPosition && (
          <div className="absolute bottom-2 left-2 bg-rc-bg-darkest/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-rc-bg-light">
            <p className="text-xs font-mono text-rc-text">
              {pinPosition.latitude.toFixed(4)}°N, {Math.abs(pinPosition.longitude).toFixed(4)}°W
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="text-center text-xs text-rc-text-muted">
        {pinPosition ? 'Drag pin to adjust • Click map to reposition' : 'Click map to place pin'}
      </p>
    </div>
  )
}

export default LocationMiniMap
