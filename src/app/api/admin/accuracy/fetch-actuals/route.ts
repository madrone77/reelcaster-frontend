/**
 * Fetch Historical Actuals API
 *
 * POST /api/admin/accuracy/fetch-actuals?date=YYYY-MM-DD
 *
 * Fetches actual weather and tide data for a past date from archive APIs,
 * runs the scoring algorithm with actual data, and stores results.
 *
 * Called by GitHub Actions (scrape-data.yml) at 2 AM UTC for yesterday's data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FISHING_LOCATIONS } from '@/app/config/locations'
import { fetchOpenMeteoHistoricalWeather } from '@/app/utils/openMeteoApi'
import { fetchObservedWaterLevels, type CHSWaterLevel } from '@/app/utils/chsTideApi'
import { resolveStationForLocation } from '@/app/utils/dfoStationRegistry'
import { calculateOpenMeteoFishingScore } from '@/app/utils/fishingCalculations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

  let hotspotsProcessed = 0
  let hoursCaptured = 0
  const errors: string[] = []

  const activeLocations = FISHING_LOCATIONS.filter(l => l.available)

  for (const location of activeLocations) {
    // Process hotspots in batches of 3
    for (let i = 0; i < location.hotspots.length; i += 3) {
      const batch = location.hotspots.slice(i, i + 3)

      await Promise.allSettled(
        batch.map(async (hotspot) => {
          try {
            // Fetch historical weather from Open Meteo Archive
            const weatherResult = await fetchOpenMeteoHistoricalWeather(
              hotspot.coordinates,
              targetDate,
              targetDate,
            )

            if (!weatherResult.success || !weatherResult.data) {
              throw new Error(`Weather fetch failed: ${weatherResult.error}`)
            }

            // Fetch observed tide data from CHS
            const resolved = await resolveStationForLocation(
              hotspot.coordinates.lat,
              hotspot.coordinates.lon,
              hotspot.tideStationCode,
            )

            let observedLevels: CHSWaterLevel[] = []
            if (resolved) {
              const dayStart = new Date(`${targetDate}T00:00:00Z`)
              const dayEnd = new Date(`${targetDate}T23:59:59Z`)
              observedLevels = await fetchObservedWaterLevels(resolved.station.id, dayStart, dayEnd)
            }

            // Get sunrise/sunset for this day
            const dayData = weatherResult.data.daily[0]
            const sunriseTimestamp = dayData ? new Date(dayData.sunrise).getTime() / 1000 : 0
            const sunsetTimestamp = dayData ? new Date(dayData.sunset).getTime() / 1000 : 0

            // Process each hour (Open Meteo Archive is hourly, simulated to 4x15min)
            // Take every 4th entry to get hourly data back
            const minutely = weatherResult.data.minutely15
            const rows: any[] = []

            for (let h = 0; h < minutely.length; h += 4) {
              const hourData = minutely[h]
              if (!hourData) continue

              // Find nearest observed tide level for this hour
              const hourTs = hourData.timestamp
              let tideHeight: number | null = null
              let tideIsRising: boolean | null = null
              let tideChangeRate: number | null = null
              let currentSpeed: number | null = null

              if (observedLevels.length > 0) {
                const nearest = findNearestWaterLevel(observedLevels, hourTs)
                if (nearest) {
                  tideHeight = nearest.height
                  // Compute rising/falling from surrounding levels
                  const riseInfo = computeTideDirection(observedLevels, hourTs)
                  tideIsRising = riseInfo.isRising
                  tideChangeRate = riseInfo.changeRate
                  currentSpeed = riseInfo.estimatedCurrentSpeed
                }
              }

              // Run the scoring algorithm with actual data
              const score = calculateOpenMeteoFishingScore(
                hourData,
                sunriseTimestamp,
                sunsetTimestamp,
                null, // No full CHSWaterData object for historical - score without tide detail
                null, // General algorithm
                {
                  latitude: hotspot.coordinates.lat,
                  longitude: hotspot.coordinates.lon,
                  locationName: location.name,
                },
              )

              const observationHour = new Date(hourTs * 1000).toISOString()

              rows.push({
                location_id: location.id,
                hotspot_name: hotspot.name,
                latitude: hotspot.coordinates.lat,
                longitude: hotspot.coordinates.lon,
                observation_date: targetDate,
                observation_hour: observationHour,
                temperature_2m: hourData.temp,
                relative_humidity: hourData.humidity,
                dew_point: hourData.dewPoint,
                apparent_temperature: hourData.apparentTemp,
                precipitation: hourData.precipitation,
                weather_code: hourData.weatherCode,
                surface_pressure: hourData.pressure,
                cloud_cover: hourData.cloudCover,
                wind_speed_10m: hourData.windSpeed,
                wind_direction_10m: hourData.windDirection,
                wind_gusts_10m: hourData.windGusts,
                visibility: hourData.visibility,
                sunshine_duration: hourData.sunshineDuration,
                tide_height: tideHeight,
                tide_is_rising: tideIsRising,
                tide_change_rate: tideChangeRate,
                current_speed: currentSpeed,
                computed_score: score.total,
                computed_breakdown: score.breakdown,
                data_sources: {
                  weather: 'open-meteo-archive',
                  tide: observedLevels.length > 0 ? 'chs-observed' : null,
                },
              })
            }

            if (rows.length > 0) {
              const { error: upsertError } = await supabase
                .from('historical_actuals')
                .upsert(rows, {
                  onConflict: 'location_id,hotspot_name,observation_hour',
                  ignoreDuplicates: false,
                })

              if (upsertError) {
                throw new Error(`Upsert failed for ${hotspot.name}: ${upsertError.message}`)
              }

              hoursCaptured += rows.length
            }

            hotspotsProcessed++
          } catch (err: any) {
            errors.push(`${hotspot.name}: ${err.message}`)
            console.error(`Error fetching actuals for ${hotspot.name}:`, err)
          }
        }),
      )
    }
  }

  const duration = Date.now() - startTime

  console.log('Historical actuals fetch complete:', {
    targetDate,
    hotspotsProcessed,
    hoursCaptured,
    errors: errors.length,
    durationMs: duration,
  })

  return NextResponse.json({
    success: true,
    targetDate,
    hotspotsProcessed,
    hoursCaptured,
    errors,
    durationMs: duration,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYesterdayUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

function findNearestWaterLevel(
  levels: CHSWaterLevel[],
  targetTimestamp: number,
): CHSWaterLevel | null {
  if (levels.length === 0) return null

  let nearest = levels[0]
  let minDiff = Math.abs(levels[0].timestamp - targetTimestamp)

  for (const level of levels) {
    const diff = Math.abs(level.timestamp - targetTimestamp)
    if (diff < minDiff) {
      minDiff = diff
      nearest = level
    }
  }

  // Only use if within 30 minutes
  return minDiff <= 1800 ? nearest : null
}

function computeTideDirection(
  levels: CHSWaterLevel[],
  targetTimestamp: number,
): { isRising: boolean; changeRate: number; estimatedCurrentSpeed: number } {
  // Find levels before and after the target timestamp
  let before: CHSWaterLevel | null = null
  let after: CHSWaterLevel | null = null

  for (const level of levels) {
    if (level.timestamp <= targetTimestamp) {
      before = level
    } else if (!after) {
      after = level
    }
  }

  if (!before || !after) {
    return { isRising: true, changeRate: 0, estimatedCurrentSpeed: 0 }
  }

  const timeDiffHours = (after.timestamp - before.timestamp) / 3600
  const heightDiff = after.height - before.height
  const changeRate = timeDiffHours > 0 ? heightDiff / timeDiffHours : 0

  // Rough estimate: current speed correlates with rate of tide change
  // ~1 knot per 0.5 m/hr change rate (empirical approximation for BC waters)
  const estimatedCurrentSpeed = Math.abs(changeRate) * 2

  return {
    isRising: heightDiff > 0,
    changeRate: Math.abs(changeRate),
    estimatedCurrentSpeed,
  }
}
