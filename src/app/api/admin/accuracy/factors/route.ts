/**
 * Factor Error Breakdown API
 *
 * GET /api/admin/accuracy/factors?location=...&hotspot=...&version=...&from=...&to=...
 *
 * Returns per-factor average errors for the given period, sorted by absolute error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Factor display names
const FACTOR_LABELS: Record<string, string> = {
  pressure: 'Pressure',
  pressureTrend: 'Pressure Trend',
  wind: 'Wind',
  temperature: 'Temperature',
  waterTemperature: 'Water Temp',
  precipitation: 'Precipitation',
  cloudCover: 'Cloud Cover',
  timeOfDay: 'Time of Day',
  visibility: 'Visibility',
  sunshine: 'Sunshine',
  lightning: 'Lightning',
  atmospheric: 'Atmospheric',
  comfort: 'Comfort',
  tide: 'Tide',
  currentSpeed: 'Current Speed',
  currentAcceleration: 'Current Accel.',
  currentDirection: 'Current Dir.',
  species: 'Species',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const hotspot = searchParams.get('hotspot')
    const version = searchParams.get('version')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || (() => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - 30)
      return d.toISOString().split('T')[0]
    })()

    let query = supabase
      .from('accuracy_comparisons')
      .select('factor_errors')
      .gte('comparison_date', startDate)
      .lte('comparison_date', endDate)
      .is('species_name', null)

    if (location) query = query.eq('location_id', location)
    if (hotspot) query = query.eq('hotspot_name', hotspot)
    if (version) query = query.eq('algorithm_version', version)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Aggregate factor errors across all rows
    const sums: Record<string, { predicted: number; actual: number; error: number; count: number }> = {}

    for (const row of data || []) {
      if (!row.factor_errors) continue
      for (const [key, val] of Object.entries(row.factor_errors as Record<string, any>)) {
        if (!sums[key]) sums[key] = { predicted: 0, actual: 0, error: 0, count: 0 }
        sums[key].predicted += val.predicted || 0
        sums[key].actual += val.actual || 0
        sums[key].error += val.error || 0
        sums[key].count++
      }
    }

    const factors = Object.entries(sums)
      .map(([key, val]) => ({
        factor: key,
        label: FACTOR_LABELS[key] || key,
        avgPredicted: val.count > 0 ? Math.round((val.predicted / val.count) * 100) / 100 : 0,
        avgActual: val.count > 0 ? Math.round((val.actual / val.count) * 100) / 100 : 0,
        avgError: val.count > 0 ? Math.round((val.error / val.count) * 100) / 100 : 0,
        absError: val.count > 0 ? Math.round((Math.abs(val.error / val.count)) * 100) / 100 : 0,
        dataPoints: val.count,
      }))
      .sort((a, b) => b.absError - a.absError)

    return NextResponse.json({ factors })
  } catch (err: any) {
    console.error('Factor accuracy error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
