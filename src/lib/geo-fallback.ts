/**
 * Initial-pin resolution for the catch wizard's location picker when the
 * photo has no EXIF GPS. Fallback chain:
 *
 *   1. browser geolocation — ONLY if permission is already granted (never
 *      auto-prompts; the location step offers an explicit opt-in button)
 *   2. IP approximation via /api/geo (Vercel geo headers; null on localhost)
 *   3. last-viewed Explore city (localStorage "rc:lastCity")
 *   4. Victoria BC default
 *
 * Each rung is best-effort; the chain never throws.
 */

import {
  checkGeolocationPermission,
  getCurrentPosition,
} from './geolocation-service'

export type PinSource = 'exif' | 'geolocation' | 'ip' | 'city' | 'default'

export interface ResolvedPin {
  lat: number
  lng: number
  source: PinSource
}

const VICTORIA = { lat: 48.4284, lng: -123.3656 }

export async function resolveInitialPin(
  exif: { lat: number | null; lng: number | null } | null,
): Promise<ResolvedPin> {
  if (exif && exif.lat !== null && exif.lng !== null) {
    return { lat: exif.lat, lng: exif.lng, source: 'exif' }
  }

  try {
    // Silent only: use precise location when the user has already granted
    // permission; on "prompt"/"denied" fall through without ever popping
    // the browser dialog (the map step has an explicit opt-in button).
    if ((await checkGeolocationPermission()) === 'granted') {
      const pos = await getCurrentPosition()
      if (Number.isFinite(pos.latitude) && Number.isFinite(pos.longitude)) {
        return { lat: pos.latitude, lng: pos.longitude, source: 'geolocation' }
      }
    }
  } catch {
    /* unavailable — next rung */
  }

  try {
    const res = await fetch('/api/geo', { cache: 'no-store' })
    if (res.ok) {
      const geo = (await res.json()) as { lat: number | null; lng: number | null }
      if (geo.lat !== null && geo.lng !== null) {
        return { lat: geo.lat, lng: geo.lng, source: 'ip' }
      }
    }
  } catch {
    /* next rung */
  }

  try {
    const raw = localStorage.getItem('rc:lastCity')
    if (raw) {
      const city = JSON.parse(raw) as { lat?: number; lng?: number }
      if (typeof city.lat === 'number' && typeof city.lng === 'number') {
        return { lat: city.lat, lng: city.lng, source: 'city' }
      }
    }
  } catch {
    /* next rung */
  }

  return { ...VICTORIA, source: 'default' }
}
