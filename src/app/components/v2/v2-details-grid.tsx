'use client'

import { Sunrise, Sunset, Moon, CloudRain, Waves, ArrowUpDown, Gauge, Navigation } from 'lucide-react'
import { OpenMeteoDailyForecast } from '@/app/utils/fishingCalculations'
import { ProcessedOpenMeteoData } from '@/app/utils/openMeteoApi'
import { CHSWaterData } from '@/app/utils/chsTideApi'
import { useUnitPreferences } from '@/contexts/unit-preferences-context'
import { convertHeight, convertWind } from '@/app/utils/unit-conversions'

interface V2DetailsGridProps {
  forecasts: OpenMeteoDailyForecast[]
  openMeteoData: ProcessedOpenMeteoData | null
  tideData: CHSWaterData | null
  selectedDay: number
}

export default function V2DetailsGrid({
  forecasts,
  openMeteoData,
  tideData,
  selectedDay,
}: V2DetailsGridProps) {
  const { heightUnit, windUnit } = useUnitPreferences()

  const selectedForecast = forecasts[selectedDay]
  const baseIndex = selectedDay * 96
  const selectedWeather = openMeteoData?.minutely15[Math.min(baseIndex, (openMeteoData?.minutely15.length || 1) - 1)]

  const sunriseTime = selectedForecast
    ? new Date(selectedForecast.sunrise * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '--'

  const sunsetTime = selectedForecast
    ? new Date(selectedForecast.sunset * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '--'

  // Moon phase
  const getMoonPhase = () => {
    const now = new Date()
    const phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    return phases[Math.floor((dayOfYear / 29.5) % phases.length)]
  }

  const precipitationProbability = selectedWeather?.precipitationProbability ?? 0

  // Tide data — guard against undefined numeric fields
  const currentHeightDisplay = tideData?.currentHeight != null
    ? convertHeight(tideData.currentHeight, 'm', heightUnit).toFixed(1) : '--'
  const changeRateDisplay = tideData?.changeRate != null
    ? Math.abs(convertHeight(tideData.changeRate, 'm', heightUnit)).toFixed(2) : '--'
  const currentSpeedDisplay = tideData?.currentSpeed != null
    ? convertWind(tideData.currentSpeed, 'knots', windUnit).toFixed(1)
    : '--'
  const currentDirection = tideData?.currentDirection != null
    ? `${Math.round(tideData.currentDirection)}°`
    : '--'

  const metrics = [
    { icon: Sunrise, label: 'Sunrise', value: sunriseTime, color: 'text-amber-400' },
    { icon: Sunset, label: 'Sunset', value: sunsetTime, color: 'text-orange-400' },
    { icon: Moon, label: 'Moon Phase', value: getMoonPhase(), color: 'text-blue-300' },
    { icon: CloudRain, label: 'Precipitation', value: `${precipitationProbability}%`, color: 'text-sky-400' },
    { icon: Waves, label: 'Tide Height', value: `${currentHeightDisplay} ${heightUnit}`, color: 'text-emerald-400' },
    { icon: ArrowUpDown, label: 'Change Rate', value: `${changeRateDisplay} ${heightUnit}/h`, color: 'text-cyan-400' },
    { icon: Gauge, label: 'Current Speed', value: `${currentSpeedDisplay} ${windUnit}`, color: 'text-purple-400' },
    { icon: Navigation, label: 'Direction', value: currentDirection, color: 'text-teal-400' },
  ]

  return (
    <div className="bg-rc-bg-darkest rounded-xl border border-rc-bg-light p-4">
      <h3 className="text-sm font-semibold text-rc-text mb-3">Details</h3>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(metric => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="bg-rc-bg-light/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${metric.color}`} />
                <span className="text-[10px] text-rc-text-muted">{metric.label}</span>
              </div>
              <p className="text-sm font-semibold text-rc-text">{metric.value}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
