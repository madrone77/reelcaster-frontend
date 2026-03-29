/**
 * Capture Prediction Snapshots API
 *
 * POST /api/admin/accuracy/capture-predictions
 *
 * Daily cron job that snapshots the algorithm's current predictions
 * for all active hotspots. Stores 2-hour block scores with full
 * factor breakdowns and input data for later accuracy comparison.
 *
 * Called by GitHub Actions (scrape-data.yml) at 2 AM UTC.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FISHING_LOCATIONS } from '@/app/config/locations'
import { fetchForecastBundle } from '@/app/utils/forecastDataProvider'
import {
  generateOpenMeteoDailyForecasts,
  type FishingScore,
} from '@/app/utils/fishingCalculations'
import {
  PROD_CHS_WEIGHTS,
  PROD_NO_CHS_WEIGHTS,
  CURRENT_ALGORITHM_VERSION,
} from '@/app/utils/algorithmWeights'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let hotspotsProcessed = 0
  let blocksCaptured = 0
  const errors: string[] = []

  // Get active locations only
  const activeLocations = FISHING_LOCATIONS.filter(l => l.available)

  for (const location of activeLocations) {
    // Process hotspots in batches of 3 to respect rate limits
    for (let i = 0; i < location.hotspots.length; i += 3) {
      const batch = location.hotspots.slice(i, i + 3)

      const results = await Promise.allSettled(
        batch.map(async (hotspot) => {
          try {
            // Fetch current forecast data for this hotspot
            const bundle = await fetchForecastBundle(
              hotspot.coordinates.lat,
              hotspot.coordinates.lon,
              {
                forecastDays: 3, // Only need next 2-3 days, not full 14
                tideStationCode: hotspot.tideStationCode,
                includeStormglass: false, // Skip stormglass to save API quota
              },
            )

            const hasCHS = !!bundle.tide
            const weights = hasCHS ? PROD_CHS_WEIGHTS : PROD_NO_CHS_WEIGHTS

            // Generate daily forecasts with 2-hour block scores
            const dailyForecasts = generateOpenMeteoDailyForecasts(
              bundle.weather,
              bundle.tide,
              null, // General algorithm only (no species)
              {
                latitude: hotspot.coordinates.lat,
                longitude: hotspot.coordinates.lon,
                locationName: location.name,
              },
            )

            // Build snapshot rows for each 2-hour block
            const rows: any[] = []

            for (const day of dailyForecasts) {
              const forecastDate = new Date(day.date * 1000).toISOString().split('T')[0]

              for (const block of day.twoHourForecasts) {
                const score: FishingScore = block.score

                // Build weather input snapshot from the block data
                const weatherInput = {
                  avgTemp: block.avgTemp,
                  windSpeed: block.windSpeed,
                  precipitation: block.precipitation,
                  pressure: block.pressure,
                  conditions: block.conditions,
                }

                // Build tide input snapshot
                const tideInput = bundle.tide ? {
                  currentHeight: bundle.tide.currentHeight,
                  isRising: bundle.tide.isRising,
                  changeRate: bundle.tide.changeRate,
                  tidalRange: bundle.tide.tidalRange,
                  timeToNextTide: bundle.tide.timeToNextTide,
                  currentSpeed: bundle.tide.currentSpeed,
                  currentDirection: bundle.tide.currentDirection,
                  stationCode: bundle.tide.stationCode,
                } : null

                rows.push({
                  location_id: location.id,
                  hotspot_name: hotspot.name,
                  latitude: hotspot.coordinates.lat,
                  longitude: hotspot.coordinates.lon,
                  forecast_date: forecastDate,
                  block_start_time: new Date(block.startTime * 1000).toISOString(),
                  block_end_time: new Date(block.endTime * 1000).toISOString(),
                  algorithm_version: CURRENT_ALGORITHM_VERSION,
                  species_name: null,
                  total_score: score.total,
                  score_breakdown: score.breakdown,
                  weights_used: weights,
                  has_chs_data: hasCHS,
                  weather_input: weatherInput,
                  tide_input: tideInput,
                })
              }
            }

            // Upsert in batches
            if (rows.length > 0) {
              const { error: upsertError } = await supabase
                .from('prediction_snapshots')
                .upsert(rows, {
                  onConflict: 'location_id,hotspot_name,forecast_date,block_start_time,algorithm_version',
                  ignoreDuplicates: false,
                })

              if (upsertError) {
                throw new Error(`Upsert failed for ${hotspot.name}: ${upsertError.message}`)
              }

              blocksCaptured += rows.length
            }

            hotspotsProcessed++
          } catch (err: any) {
            errors.push(`${hotspot.name}: ${err.message}`)
            console.error(`Error capturing predictions for ${hotspot.name}:`, err)
          }
        }),
      )

      // Log any rejected promises
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          errors.push(`${batch[idx].name}: ${result.reason}`)
        }
      })
    }
  }

  const duration = Date.now() - startTime

  console.log('Prediction capture complete:', {
    hotspotsProcessed,
    blocksCaptured,
    errors: errors.length,
    durationMs: duration,
  })

  return NextResponse.json({
    success: true,
    hotspotsProcessed,
    blocksCaptured,
    errors,
    durationMs: duration,
  })
}
