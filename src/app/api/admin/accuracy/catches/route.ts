/**
 * Catch Correlation API
 *
 * GET /api/admin/accuracy/catches?location=...&from=...&to=...
 *
 * Returns catch data correlated with predicted scores for scatter plot visualization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || (() => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - 90)
      return d.toISOString().split('T')[0]
    })()

    // Fetch accuracy comparisons with catch data
    let query = supabase
      .from('accuracy_comparisons')
      .select('comparison_date, hotspot_name, avg_predicted_score, avg_actual_score, catch_count, landed_count, bite_count')
      .gte('comparison_date', startDate)
      .lte('comparison_date', endDate)
      .is('species_name', null)
      .gt('catch_count', 0)

    if (location) query = query.eq('location_id', location)

    const { data, error } = await query.order('comparison_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build scatter data points
    const points = (data || []).map(row => ({
      date: row.comparison_date,
      hotspot: row.hotspot_name,
      predictedScore: row.avg_predicted_score,
      actualScore: row.avg_actual_score,
      catchCount: row.catch_count,
      landedCount: row.landed_count,
      biteCount: row.bite_count,
      landedRate: row.catch_count > 0
        ? Math.round((row.landed_count / row.catch_count) * 100)
        : 0,
    }))

    // Compute overall correlation if enough data points
    let correlation: number | null = null
    if (points.length >= 5) {
      const scores = points.map(p => p.predictedScore)
      const catches = points.map(p => p.catchCount)
      correlation = pearsonCorrelation(scores, catches)
    }

    // Top days by catch count
    const topDays = [...points]
      .sort((a, b) => b.catchCount - a.catchCount)
      .slice(0, 10)

    return NextResponse.json({
      points,
      correlation,
      topDays,
      totalCatches: points.reduce((s, p) => s + p.catchCount, 0),
      totalLanded: points.reduce((s, p) => s + p.landedCount, 0),
      daysWithCatches: points.length,
    })
  } catch (err: any) {
    console.error('Catch correlation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denom = Math.sqrt(denomX * denomY)
  return denom === 0 ? 0 : Math.round((num / denom) * 100) / 100
}
