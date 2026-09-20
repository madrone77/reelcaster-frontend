'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { classifyPage } from '@/lib/traffic-source'
import { VITAL_METRICS, type VitalMetric, type VitalSurface } from '@/lib/web-vitals-buckets'

/**
 * Renders nothing. Reports Core Web Vitals for the page the reader is on to
 * POST /api/web-vitals, once per page visit, on pagehide.
 *
 * Why our own and not Vercel Speed Insights: Speed Insights has no read API,
 * and the admin wants load time on the same dashboard as scoring freshness
 * and failed payments. The numbers land in web_vitals_daily on the ReelCaster
 * project as histogram counters (see the migration), never as a per-visit
 * event, so there is nothing here to leak.
 *
 * Batched, not streamed. LCP and CLS are only final when the page is left,
 * INP later still, so `next/web-vitals` reports each metric when it settles;
 * the reporter buffers them and sends one beacon when the page hides. A
 * client-side navigation counts as a page visit of its own: the buffer is
 * flushed against the surface it was collected on when the pathname changes.
 *
 * Surface, not path. The reader's page is folded to explore / spot / city /
 * home / lp / other through the same classifier the traffic counter uses, so
 * "spot page speed" is every spot, not one slug per row.
 */

type Row = { surface: VitalSurface; metric: VitalMetric; value: number }

function surfaceFor(pathname: string): VitalSurface | null {
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

function send(rows: Row[]) {
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

export default function WebVitalsReporter() {
  const pathname = usePathname()
  const buffer = useRef<Row[]>([])
  const surface = useRef<VitalSurface | null>(null)

  // A new pathname is a new page visit: flush what the last one produced.
  useEffect(() => {
    const rows = buffer.current
    buffer.current = []
    send(rows)
    surface.current = surfaceFor(pathname ?? '/')
  }, [pathname])

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return
      const rows = buffer.current
      buffer.current = []
      send(rows)
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  useReportWebVitals((metric) => {
    const s = surface.current
    if (!s) return
    if (!(VITAL_METRICS as readonly string[]).includes(metric.name)) return
    if (typeof metric.value !== 'number' || !Number.isFinite(metric.value)) return
    buffer.current.push({ surface: s, metric: metric.name as VitalMetric, value: metric.value })
  })

  return null
}
