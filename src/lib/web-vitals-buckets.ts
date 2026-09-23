/**
 * Histogram buckets for the web-vitals counters (web_vitals_daily).
 *
 * Upper edge of each bucket in milliseconds; CLS is stored ×1000 so the same
 * scale serves it. The last bucket is open. BlueCaster reads percentiles
 * back from these indexes (bluecaster lib/web-vitals.ts), so the two lists
 * MUST match: a change here without a change there mislabels every bucket.
 */
export const VITAL_BUCKET_EDGES = [
  100, 200, 300, 400, 500, 600, 800, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000,
  5000, 6000, 8000, 10000, 15000, 20000,
] as const

/**
 * The five Core Web Vitals, plus MODAL: our own measure, the time from the
 * tap that asks for the paywall to the sheet painted on screen (see
 * src/lib/modal-timing.ts). Same table, same buckets, same p75.
 */
export const VITAL_METRICS = ['LCP', 'TTFB', 'FCP', 'INP', 'CLS', 'MODAL'] as const
export type VitalMetric = (typeof VITAL_METRICS)[number]

export const VITAL_SURFACES = ['explore', 'spot', 'city', 'home', 'lp', 'other'] as const
export type VitalSurface = (typeof VITAL_SURFACES)[number]

/** The stored value: ms as reported, CLS scaled to an integer-ish range. */
export function storedValue(metric: VitalMetric, value: number): number {
  return metric === 'CLS' ? value * 1000 : value
}

export function bucketFor(stored: number): number {
  const i = VITAL_BUCKET_EDGES.findIndex((edge) => stored < edge)
  return i === -1 ? VITAL_BUCKET_EDGES.length : i
}
