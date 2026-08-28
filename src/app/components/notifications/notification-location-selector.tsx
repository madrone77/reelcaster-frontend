'use client'

import React, { useState, useCallback, useRef } from 'react'
import Map, {
  Marker,
  Layer,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import { MapPin } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useReliefStyle } from '@/lib/map/use-relief-style'

interface NotificationLocationSelectorProps {
  initialLat?: number
  initialLng?: number
  initialRadius?: number
  onLocationChange: (lat: number, lng: number, radius: number) => void
}

// Default to Victoria, BC if no initial location
const DEFAULT_LAT = 48.4284
const DEFAULT_LNG = -123.3656
const DEFAULT_RADIUS = 25 // km

// Min/max radius in kilometers
const MIN_RADIUS = 5
const MAX_RADIUS = 100

const NotificationLocationSelector: React.FC<NotificationLocationSelectorProps> = ({
  initialLat = DEFAULT_LAT,
  initialLng = DEFAULT_LNG,
  initialRadius = DEFAULT_RADIUS,
  onLocationChange,
}) => {
  const mapRef = useRef<MapRef>(null)
  const [viewport, setViewport] = useState({
    latitude: initialLat,
    longitude: initialLng,
    zoom: 9,
  })

  const [markerPosition, setMarkerPosition] = useState({
    latitude: initialLat,
    longitude: initialLng,
  })

  const [radius, setRadius] = useState(initialRadius)
  const mapStyle = useReliefStyle()

  // Handle map click to set marker position
  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const { lngLat } = event
      const newPosition = {
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      }
      setMarkerPosition(newPosition)
      onLocationChange(lngLat.lat, lngLat.lng, radius)
    },
    [radius, onLocationChange],
  )

  // Handle radius change
  const handleRadiusChange = useCallback(
    (newRadius: number) => {
      setRadius(newRadius)
      onLocationChange(markerPosition.latitude, markerPosition.longitude, newRadius)
    },
    [markerPosition, onLocationChange],
  )

  // Create GeoJSON circle for the radius visualization
  const createGeoJSONCircle = (center: [number, number], radiusInKm: number, points: number = 64) => {
    const coords = {
      latitude: center[1],
      longitude: center[0],
    }

    const km = radiusInKm
    const ret = []
    const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180))
    const distanceY = km / 110.574

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI)
      const x = distanceX * Math.cos(theta)
      const y = distanceY * Math.sin(theta)
      ret.push([coords.longitude + x, coords.latitude + y])
    }
    ret.push(ret[0])

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ret],
      },
      properties: {},
    }
  }

  const circleGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [createGeoJSONCircle([markerPosition.longitude, markerPosition.latitude], radius)],
  }

  const circleFillLayerStyle = {
    id: 'radius-fill',
    type: 'fill' as const,
    paint: {
      'fill-color': '#2536D9',
      'fill-opacity': 0.1,
    },
  }

  const circleOutlineLayerStyle = {
    id: 'radius-outline',
    type: 'line' as const,
    paint: {
      'line-color': '#2536D9',
      'line-width': 2,
      'line-opacity': 0.8,
    },
  }

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div className="relative w-full h-[300px] sm:h-[500px] rounded-lg overflow-hidden border border-rc-rule">
        <Map
          ref={mapRef}
          {...viewport}
          onMove={evt => setViewport(evt.viewState)}
          onClick={handleMapClick}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Radius Circle */}
          <Source id="radius-source" type="geojson" data={circleGeoJSON}>
            <Layer {...circleFillLayerStyle} />
            <Layer {...circleOutlineLayerStyle} />
          </Source>

          {/* Center Marker */}
          <Marker
            latitude={markerPosition.latitude}
            longitude={markerPosition.longitude}
            draggable
            onDragEnd={event => {
              const newPosition = {
                latitude: event.lngLat.lat,
                longitude: event.lngLat.lng,
              }
              setMarkerPosition(newPosition)
              onLocationChange(event.lngLat.lat, event.lngLat.lng, radius)
            }}
          >
            <div className="cursor-move">
              <MapPin className="w-8 h-8 text-rc-brand drop-shadow-lg" fill="currentColor" />
            </div>
          </Marker>
        </Map>

        {/* Helper Text Overlay */}
        <div className="absolute top-4 left-4 bg-rc-panel/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-rc-rule">
          <p className="text-xs font-medium text-rc-ink">Click or drag marker to set location</p>
        </div>
      </div>

      {/* Radius Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="radius-slider" className="text-sm font-medium text-rc-ink-soft">
            Notification Radius
          </label>
          <span className="text-sm font-semibold text-rc-brand">{radius} km</span>
        </div>
        <input
          id="radius-slider"
          type="range"
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={1}
          value={radius}
          onChange={e => handleRadiusChange(Number(e.target.value))}
          className="w-full h-2 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
        />
        <div className="flex justify-between text-xs text-rc-ink-mute">
          <span>{MIN_RADIUS} km</span>
          <span>{MAX_RADIUS} km</span>
        </div>
      </div>

      {/* Location Info */}
      <div className="p-3 bg-rc-surface rounded-lg border border-rc-rule">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-rc-ink-mute">Latitude:</span>
            <span className="ml-2 font-mono text-rc-ink">{markerPosition.latitude.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-rc-ink-mute">Longitude:</span>
            <span className="ml-2 font-mono text-rc-ink">{markerPosition.longitude.toFixed(6)}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-rc-ink-mute">
          You&apos;ll receive notifications for fishing conditions within {radius} km of this location.
        </p>
      </div>
    </div>
  )
}

export default NotificationLocationSelector
