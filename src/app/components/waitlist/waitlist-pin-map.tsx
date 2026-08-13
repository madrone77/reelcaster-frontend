'use client';

import { useState, useCallback } from 'react';
import Map, { Marker, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { MapPin } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useReliefStyle } from '@/lib/map/use-relief-style';

interface Props {
  initialLat?: number;
  initialLon?: number;
  onChange: (pin: { lat: number; lon: number } | null) => void;
}

export default function WaitlistPinMap({ initialLat, initialLon, onChange }: Props) {
  const mapStyle = useReliefStyle();
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(
    initialLat !== undefined && initialLon !== undefined
      ? { lat: initialLat, lon: initialLon }
      : null,
  );

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const next = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      setPin(next);
      onChange(next);
    },
    [onChange],
  );

  return (
    <Map
      initialViewState={{
        latitude: initialLat ?? 48.41,
        longitude: initialLon ?? -123.4,
        zoom: 7,
      }}
      mapStyle={mapStyle}
      onClick={handleClick}
      style={{ width: '100%', height: '100%' }}
    >
      {pin && (
        <Marker latitude={pin.lat} longitude={pin.lon} anchor="bottom">
          <MapPin className="w-7 h-7 text-blue-500 fill-blue-500/30" />
        </Marker>
      )}
    </Map>
  );
}
