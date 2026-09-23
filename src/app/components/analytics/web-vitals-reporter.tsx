'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { VITAL_METRICS, type VitalMetric, type VitalSurface } from '@/lib/web-vitals-buckets'
import { sendVitals as send, surfaceFor, type VitalRow as Row } from '@/lib/web-vitals-beacon'
import { useInputClock } from '@/lib/modal-timing'

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
 * Surface, not path: see @/lib/web-vitals-beacon.
 */

export default function WebVitalsReporter() {
  const pathname = usePathname()
  const buffer = useRef<Row[]>([])
  const surface = useRef<VitalSurface | null>(null)

  // The clock the paywall modals time their opening against. Installed here
  // because this component mounts on every page at hydration, before any
  // modal's chunk exists to install it. See @/lib/modal-timing.
  useInputClock()

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
