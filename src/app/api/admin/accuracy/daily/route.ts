/**
 * Daily Accuracy Data API
 *
 * GET /api/admin/accuracy/daily?location=...&hotspot=...&version=...&from=...&to=...
 *
 * Returns daily time series of predicted vs actual scores for charting.
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
    const hotspot = searchParams.get('hotspot')
    const version = searchParams.get('version')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Default to last 30 days
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || (() => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - 30)
      return d.toISOString().split('T')[0]
    })()

    let query = supabase
      .from('accuracy_comparisons')
      .select('comparison_date, avg_predicted_score, avg_actual_score, score_delta, abs_error, blocks_compared, blocks_within_1pt, blocks_within_2pt, catch_count, landed_count, bite_count, hotspot_name')
      .gte('comparison_date', startDate)
      .lte('comparison_date', endDate)
      .is('species_name', null)

    if (location) query = query.eq('location_id', location)
    if (hotspot) query = query.eq('hotspot_name', hotspot)
    if (version) query = query.eq('algorithm_version', version)

    const { data, error } = await query.order('comparison_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If no hotspot filter, aggregate across all hotspots per day
    if (!hotspot && data && data.length > 0) {
      const byDate = new Map<string, typeof data>()
      for (const row of data) {
        const date = row.comparison_date
        if (!byDate.has(date)) byDate.set(date, [])
        byDate.get(date)!.push(row)
      }

      const aggregated = Array.from(byDate.entries()).map(([date, rows]) => {
        const totalBlocks = rows.reduce((s, r) => s + (r.blocks_compared || 0), 0)
        const avgPredicted = totalBlocks > 0
          ? rows.reduce((s, r) => s + (r.avg_predicted_score || 0) * (r.blocks_compared || 0), 0) / totalBlocks
          : 0
        const avgActual = totalBlocks > 0
          ? rows.reduce((s, r) => s + (r.avg_actual_score || 0) * (r.blocks_compared || 0), 0) / totalBlocks
          : 0

        return {
          date,
          avgPredicted: Math.round(avgPredicted * 100) / 100,
          avgActual: Math.round(avgActual * 100) / 100,
          delta: Math.round((avgPredicted - avgActual) * 100) / 100,
          blocksCompared: totalBlocks,
          catchCount: rows.reduce((s, r) => s + (r.catch_count || 0), 0),
          landedCount: rows.reduce((s, r) => s + (r.landed_count || 0), 0),
          biteCount: rows.reduce((s, r) => s + (r.bite_count || 0), 0),
        }
      })

      return NextResponse.json({ dates: aggregated })
    }

    // With hotspot filter, return per-row data
    const dates = (data || []).map(row => ({
      date: row.comparison_date,
      avgPredicted: row.avg_predicted_score,
      avgActual: row.avg_actual_score,
      delta: row.score_delta,
      blocksCompared: row.blocks_compared,
      catchCount: row.catch_count,
      landedCount: row.landed_count,
      biteCount: row.bite_count,
    }))

    return NextResponse.json({ dates })
  } catch (err: any) {
    console.error('Daily accuracy error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
