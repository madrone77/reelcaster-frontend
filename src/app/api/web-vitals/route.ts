import { NextResponse } from 'next/server'
import { isBotUserAgent } from '@/lib/device'
import { pacificDay } from '@/lib/pacific-day'
import {
  bucketFor,
  storedValue,
  VITAL_METRICS,
  VITAL_SURFACES,
  type VitalMetric,
  type VitalSurface,
} from '@/lib/web-vitals-buckets'

/**
 * Sink for the web-vitals reporter (src/app/components/analytics/
 * web-vitals-reporter.tsx). One beacon per page visit, sent on pagehide,
 * carrying every metric the browser produced for that page.
 *
 * Validates hard and answers 200 either way: a beacon is never worth an
 * error to the reader, and sendBeacon cannot read the answer anyway. Rows
 * land in web_vitals_daily through bump_web_vitals, the only supported way
 * in, so every writer agrees on the shape of a key.
 *
 * Bots are dropped by user agent. They rarely run the reporter at all, but
 * a headless Chrome that does would put its own network in the p75.
 */

const MAX_ROWS = 40

interface Sample {
  surface: VitalSurface
  metric: VitalMetric
  bucket: number
  value: number
}

function parse(payload: unknown): Sample[] {
  if (!payload || typeof payload !== 'object') return []
  const rows = (payload as { rows?: unknown }).rows
  if (!Array.isArray(rows)) return []
  const out: Sample[] = []
  for (const r of rows.slice(0, MAX_ROWS)) {
    if (!r || typeof r !== 'object') continue
    const { surface, metric, value } = r as Record<string, unknown>
    if (typeof surface !== 'string' || !(VITAL_SURFACES as readonly string[]).includes(surface)) continue
    if (typeof metric !== 'string' || !(VITAL_METRICS as readonly string[]).includes(metric)) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 120_000) continue
    const stored = storedValue(metric as VitalMetric, value)
    out.push({
      surface: surface as VitalSurface,
      metric: metric as VitalMetric,
      bucket: bucketFor(stored),
      value: stored,
    })
  }
  return out
}

export async function POST(request: Request) {
  const ok = NextResponse.json({ ok: true })
  if (isBotUserAgent(request.headers.get('user-agent'))) return ok

  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    return ok
  }
  const rows = parse(payload)
  if (rows.length === 0) return ok

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return ok

  try {
    await fetch(`${url}/rest/v1/rpc/bump_web_vitals`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: key,
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_day: pacificDay(), p_rows: rows }),
    })
  } catch {
    // A counter is never worth an error. The next page load reports again.
  }
  return ok
}
