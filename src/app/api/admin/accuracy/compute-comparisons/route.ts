/**
 * Compute Accuracy Comparisons API
 *
 * POST /api/admin/accuracy/compute-comparisons?date=YYYY-MM-DD
 *
 * Joins prediction snapshots with historical actuals for a given date,
 * computes per-factor errors, correlates with catch logs, and stores
 * aggregated daily accuracy metrics.
 *
 * Called by GitHub Actions (scrape-data.yml) at 2 AM UTC after fetch-actuals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FISHING_LOCATIONS } from '@/app/config/locations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Factor keys in the score breakdown
const FACTOR_KEYS = [
  'pressure', 'pressureTrend', 'wind', 'temperature', 'waterTemperature',
  'precipitation', 'cloudCover', 'timeOfDay', 'visibility', 'sunshine',
  'lightning', 'atmospheric', 'comfort', 'tide', 'currentSpeed',
  'currentAcceleration', 'currentDirection', 'species',
] as const

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Default to yesterday UTC
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')
  const targetDate = dateParam || getYesterdayUTC()

  let comparisonsComputed = 0
  const errors: string[] = []

  const activeLocations = FISHING_LOCATIONS.filter(l => l.available)

  for (const location of activeLocations) {
    for (const hotspot of location.hotspots) {
      try {
        // Fetch prediction snapshots for this date/hotspot
        const { data: snapshots, error: snapError } = await supabase
          .from('prediction_snapshots')
          .select('*')
          .eq('location_id', location.id)
          .eq('hotspot_name', hotspot.name)
          .eq('forecast_date', targetDate)
          .order('block_start_time', { ascending: true })

        if (snapError) throw new Error(`Snapshot query failed: ${snapError.message}`)
        if (!snapshots || snapshots.length === 0) continue

        // Fetch historical actuals for this date/hotspot
        const { data: actuals, error: actualError } = await supabase
          .from('historical_actuals')
          .select('*')
          .eq('location_id', location.id)
          .eq('hotspot_name', hotspot.name)
          .eq('observation_date', targetDate)
          .order('observation_hour', { ascending: true })

        if (actualError) throw new Error(`Actuals query failed: ${actualError.message}`)
        if (!actuals || actuals.length === 0) continue

        // Group actuals by hour for matching
        const actualsByHour = new Map<number, typeof actuals[0]>()
        for (const actual of actuals) {
          const hourTs = new Date(actual.observation_hour).getTime() / 1000
          actualsByHour.set(hourTs, actual)
        }

        // Match each prediction block to actual hours
        let totalPredicted = 0
        let totalActual = 0
        let blocksCompared = 0
        let blocksWithin1pt = 0
        let blocksWithin2pt = 0
        const factorErrors: Record<string, { predicted: number; actual: number; error: number; count: number }> = {}

        // Initialize factor errors
        for (const key of FACTOR_KEYS) {
          factorErrors[key] = { predicted: 0, actual: 0, error: 0, count: 0 }
        }

        // Group snapshots by algorithm version
        const versionGroups = new Map<string, typeof snapshots>()
        for (const snap of snapshots) {
          const version = snap.algorithm_version
          if (!versionGroups.has(version)) versionGroups.set(version, [])
          versionGroups.get(version)!.push(snap)
        }

        for (const [algorithmVersion, versionSnapshots] of versionGroups) {
          totalPredicted = 0
          totalActual = 0
          blocksCompared = 0
          blocksWithin1pt = 0
          blocksWithin2pt = 0

          // Reset factor errors for this version
          for (const key of FACTOR_KEYS) {
            factorErrors[key] = { predicted: 0, actual: 0, error: 0, count: 0 }
          }

          for (const snap of versionSnapshots) {
            const blockStartTs = new Date(snap.block_start_time).getTime() / 1000
            const blockEndTs = new Date(snap.block_end_time).getTime() / 1000

            // Find actual hours that fall within this 2-hour block
            const matchingActuals: typeof actuals = []
            for (const [hourTs, actual] of actualsByHour) {
              if (hourTs >= blockStartTs && hourTs < blockEndTs) {
                matchingActuals.push(actual)
              }
            }

            if (matchingActuals.length === 0) continue

            // Average the actual scores for this block
            const avgActualScore = matchingActuals.reduce(
              (sum, a) => sum + (a.computed_score || 0), 0,
            ) / matchingActuals.length

            const predictedScore = snap.total_score
            const delta = predictedScore - avgActualScore

            totalPredicted += predictedScore
            totalActual += avgActualScore
            blocksCompared++

            if (Math.abs(delta) <= 1.0) blocksWithin1pt++
            if (Math.abs(delta) <= 2.0) blocksWithin2pt++

            // Compute per-factor errors
            const predBreakdown = snap.score_breakdown || {}
            // Average actual breakdowns across matching hours
            const avgActualBreakdown: Record<string, number> = {}
            for (const key of FACTOR_KEYS) {
              const sum = matchingActuals.reduce(
                (s, a) => s + ((a.computed_breakdown || {})[key] || 0), 0,
              )
              avgActualBreakdown[key] = sum / matchingActuals.length
            }

            for (const key of FACTOR_KEYS) {
              const pred = predBreakdown[key] || 0
              const actual = avgActualBreakdown[key] || 0
              factorErrors[key].predicted += pred
              factorErrors[key].actual += actual
              factorErrors[key].error += pred - actual
              factorErrors[key].count++
            }
          }

          if (blocksCompared === 0) continue

          // Average factor errors
          const avgFactorErrors: Record<string, { predicted: number; actual: number; error: number }> = {}
          for (const key of FACTOR_KEYS) {
            const fe = factorErrors[key]
            if (fe.count > 0) {
              avgFactorErrors[key] = {
                predicted: Math.round((fe.predicted / fe.count) * 100) / 100,
                actual: Math.round((fe.actual / fe.count) * 100) / 100,
                error: Math.round((fe.error / fe.count) * 100) / 100,
              }
            }
          }

          // Fetch catch logs for this day and location (within ~2km radius)
          const { data: catches } = await supabase
            .from('catch_logs')
            .select('outcome')
            .gte('caught_at', `${targetDate}T00:00:00Z`)
            .lte('caught_at', `${targetDate}T23:59:59Z`)
            .gte('location_lat', hotspot.coordinates.lat - 0.02) // ~2km
            .lte('location_lat', hotspot.coordinates.lat + 0.02)
            .gte('location_lng', hotspot.coordinates.lon - 0.02)
            .lte('location_lng', hotspot.coordinates.lon + 0.02)

          const catchCount = catches?.length || 0
          const landedCount = catches?.filter(c => c.outcome === 'landed').length || 0
          const biteCount = catches?.filter(c => c.outcome === 'bite').length || 0

          const avgPredicted = Math.round((totalPredicted / blocksCompared) * 100) / 100
          const avgActual = Math.round((totalActual / blocksCompared) * 100) / 100
          const scoreDelta = Math.round((avgPredicted - avgActual) * 100) / 100
          const absError = Math.round(Math.abs(scoreDelta) * 100) / 100

          const { error: upsertError } = await supabase
            .from('accuracy_comparisons')
            .upsert({
              comparison_date: targetDate,
              location_id: location.id,
              hotspot_name: hotspot.name,
              algorithm_version: algorithmVersion,
              species_name: null,
              avg_predicted_score: avgPredicted,
              avg_actual_score: avgActual,
              score_delta: scoreDelta,
              abs_error: absError,
              factor_errors: avgFactorErrors,
              blocks_compared: blocksCompared,
              blocks_within_1pt: blocksWithin1pt,
              blocks_within_2pt: blocksWithin2pt,
              catch_count: catchCount,
              landed_count: landedCount,
              bite_count: biteCount,
            }, {
              onConflict: 'comparison_date,location_id,hotspot_name,algorithm_version',
              ignoreDuplicates: false,
            })

          if (upsertError) {
            throw new Error(`Upsert failed: ${upsertError.message}`)
          }

          comparisonsComputed++
        }
      } catch (err: any) {
        errors.push(`${hotspot.name}: ${err.message}`)
        console.error(`Error computing comparison for ${hotspot.name}:`, err)
      }
    }
  }

  const duration = Date.now() - startTime

  console.log('Accuracy comparisons computed:', {
    targetDate,
    comparisonsComputed,
    errors: errors.length,
    durationMs: duration,
  })

  return NextResponse.json({
    success: true,
    targetDate,
    comparisonsComputed,
    errors,
    durationMs: duration,
  })
}

function getYesterdayUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}
