/**
 * Accuracy Overview API
 *
 * GET /api/admin/accuracy/overview?location=...&hotspot=...&version=...&days=30
 *
 * Returns rolling accuracy KPIs: mean absolute error, hit rates, trend direction.
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
    const days = parseInt(searchParams.get('days') || '30')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setUTCDate(startDate.getUTCDate() - days)

    let query = supabase
      .from('accuracy_comparisons')
      .select('*')
      .gte('comparison_date', startDate.toISOString().split('T')[0])
      .lte('comparison_date', endDate.toISOString().split('T')[0])
      .is('species_name', null)

    if (location) query = query.eq('location_id', location)
    if (hotspot) query = query.eq('hotspot_name', hotspot)
    if (version) query = query.eq('algorithm_version', version)

    const { data, error } = await query.order('comparison_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        meanAbsError: null,
        hitRate1pt: null,
        hitRate2pt: null,
        totalBlocks: 0,
        totalDays: 0,
        trendDirection: 'stable',
        topOverpredictedFactor: null,
        topUnderpredictedFactor: null,
      })
    }

    // Aggregate metrics
    let totalAbsError = 0
    let totalBlocksCompared = 0
    let totalWithin1pt = 0
    let totalWithin2pt = 0
    let totalCatches = 0
    let totalLanded = 0

    // Factor error aggregation
    const factorErrorSums: Record<string, { error: number; count: number }> = {}

    for (const row of data) {
      totalAbsError += (row.abs_error || 0) * (row.blocks_compared || 0)
      totalBlocksCompared += row.blocks_compared || 0
      totalWithin1pt += row.blocks_within_1pt || 0
      totalWithin2pt += row.blocks_within_2pt || 0
      totalCatches += row.catch_count || 0
      totalLanded += row.landed_count || 0

      if (row.factor_errors) {
        for (const [key, val] of Object.entries(row.factor_errors as Record<string, any>)) {
          if (!factorErrorSums[key]) factorErrorSums[key] = { error: 0, count: 0 }
          factorErrorSums[key].error += val.error || 0
          factorErrorSums[key].count++
        }
      }
    }

    const meanAbsError = totalBlocksCompared > 0
      ? Math.round((totalAbsError / totalBlocksCompared) * 100) / 100
      : null
    const hitRate1pt = totalBlocksCompared > 0
      ? Math.round((totalWithin1pt / totalBlocksCompared) * 100)
      : null
    const hitRate2pt = totalBlocksCompared > 0
      ? Math.round((totalWithin2pt / totalBlocksCompared) * 100)
      : null

    // Find most over/under-predicted factors
    let topOverpredicted: { factor: string; avgError: number } | null = null
    let topUnderpredicted: { factor: string; avgError: number } | null = null

    for (const [key, val] of Object.entries(factorErrorSums)) {
      if (val.count === 0) continue
      const avgError = val.error / val.count
      if (!topOverpredicted || avgError > topOverpredicted.avgError) {
        topOverpredicted = { factor: key, avgError: Math.round(avgError * 100) / 100 }
      }
      if (!topUnderpredicted || avgError < topUnderpredicted.avgError) {
        topUnderpredicted = { factor: key, avgError: Math.round(avgError * 100) / 100 }
      }
    }

    // Trend: compare first half vs second half
    const midIdx = Math.floor(data.length / 2)
    const firstHalf = data.slice(0, midIdx)
    const secondHalf = data.slice(midIdx)

    const firstHalfError = firstHalf.reduce((s, r) => s + (r.abs_error || 0), 0) / (firstHalf.length || 1)
    const secondHalfError = secondHalf.reduce((s, r) => s + (r.abs_error || 0), 0) / (secondHalf.length || 1)
    const trendDirection = secondHalfError < firstHalfError - 0.1
      ? 'improving'
      : secondHalfError > firstHalfError + 0.1
        ? 'degrading'
        : 'stable'

    return NextResponse.json({
      meanAbsError,
      hitRate1pt,
      hitRate2pt,
      totalBlocks: totalBlocksCompared,
      totalDays: data.length,
      totalCatches,
      totalLanded,
      trendDirection,
      topOverpredictedFactor: topOverpredicted,
      topUnderpredictedFactor: topUnderpredicted,
    })
  } catch (err: any) {
    console.error('Accuracy overview error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
