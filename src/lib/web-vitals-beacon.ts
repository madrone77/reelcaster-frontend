import { classifyPage } from '@/lib/traffic-source'
import type { VitalMetric, VitalSurface } from '@/lib/web-vitals-buckets'

/**
 * The two halves of a web-vitals report every sender shares: which surface a
 * path belongs to, and the beacon to POST /api/web-vitals. Used by the page
 * reporter (src/app/components/analytics/web-vitals-reporter.tsx) and the
 * paywall modal's open timer (./modal-timing.ts).
 *
 * Surface, not path. The reader's page is folded to explore / spot / city /
 * home / lp / other through the same classifier the traffic counter uses, so
 * "spot page speed" is every spot, not one slug per row.
 */

export type VitalRow = { surface: VitalSurface; metric: VitalMetric; value: number }

export function surfaceFor(pathname: string): VitalSurface | null {
  const page = classifyPage(pathname)
  if (!page) return null
  switch (page.kind) {
    case 'explore':
      return 'explore'
    case 'spot':
      return 'spot'
    case 'city':
      return 'city'
    case 'home':
      return 'home'
    case 'lp':
      return 'lp'
    default:
      return 'other'
  }
}

export function sendVitals(rows: VitalRow[]) {
  if (rows.length === 0) return
  const body = JSON.stringify({ rows })
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/web-vitals', blob)) return
    }
    void fetch('/api/web-vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Never let a beacon surface to the reader.
  }
}
