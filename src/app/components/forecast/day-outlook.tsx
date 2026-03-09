import { OpenMeteoDailyForecast } from '../../utils/fishingCalculations'

interface DayOutlookProps {
  forecasts: OpenMeteoDailyForecast[]
  selectedDay?: number
  onDaySelect?: (dayIndex: number) => void
}

const getScoreColor = (score: number) => {
  if (score >= 8) return 'from-green-500 to-green-600'
  if (score >= 6) return 'from-yellow-400 to-yellow-500'
  if (score >= 4) return 'from-orange-400 to-orange-500'
  return 'from-red-400 to-red-500'
}

const getScoreGlow = (score: number) => {
  if (score >= 8) return 'shadow-green-500/30'
  if (score >= 6) return 'shadow-yellow-400/30'
  if (score >= 4) return 'shadow-orange-400/30'
  return 'shadow-red-400/30'
}

const getScoreLabel = (score: number) => {
  if (score >= 8) return 'Best'
  if (score >= 6) return 'Good'
  if (score >= 4) return 'Fair'
  return 'Poor'
}

const getTodayIndicator = (index: number) => {
  return index === 0 ? 'Today' : null
}

const getWeatherEmoji = (score: number) => {
  if (score >= 8) return '🎣'
  if (score >= 6) return '🐟'
  if (score >= 4) return '⛅'
  return '🌊'
}

export default function DayOutlook({ forecasts, selectedDay = 0, onDaySelect }: DayOutlookProps) {
  // Show all 14 days
  const displayForecasts = forecasts.slice(0, 14)

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700/50 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            14-Day Outlook
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Best fishing periods for the next two weeks</p>
        </div>

        {/* Legend - Show on mobile with smaller size */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-lg shadow-green-500/30"></div>
            <span className="text-slate-300 hidden sm:inline">Best</span>
            <span className="text-slate-300 sm:hidden">8+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full shadow-lg shadow-yellow-400/30"></div>
            <span className="text-slate-300 hidden sm:inline">Good</span>
            <span className="text-slate-300 sm:hidden">6-8</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full shadow-lg shadow-orange-400/30"></div>
            <span className="text-slate-300 hidden sm:inline">Fair</span>
            <span className="text-slate-300 sm:hidden">4-6</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gradient-to-r from-red-400 to-red-500 rounded-full shadow-lg shadow-red-400/30"></div>
            <span className="text-slate-300 hidden sm:inline">Poor</span>
            <span className="text-slate-300 sm:hidden">&lt;4</span>
          </div>
        </div>
      </div>

      {/* Days Container */}
      <div className="relative">
        {/* Scroll gradient overlays - Hidden on mobile */}
        <div className="hidden sm:block absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-slate-800 to-transparent  pointer-events-none rounded-l-xl"></div>
        <div className="hidden sm:block absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none rounded-r-xl"></div>

        <div
          className="flex gap-2 sm:gap-3 overflow-x-auto pb-3 sm:pb-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800/50 -mx-2 px-2 sm:mx-0 sm:px-2 relative"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#475569 #1e293b',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {displayForecasts.map((forecast, index) => {
            // Calculate the average score of the best 2-hour period
            const bestScore =
              forecast.twoHourForecasts.length > 0 ? Math.max(...forecast.twoHourForecasts.map(f => f.score.total)) : 0
            const dayScore = bestScore

            const date = new Date(forecast.date * 1000)
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
            const dayDate = date.getDate()
            const month = date.toLocaleDateString('en-US', { month: 'short' })

            const isSelected = selectedDay === index
            const isToday = getTodayIndicator(index)

            return (
              <div key={index} className="relative min-w-[70px] sm:min-w-[90px]">
                <button
                  onClick={() => onDaySelect?.(index)}
                  className={`
                    group flex flex-col items-center w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 transform relative
                    sm:hover:scale-105
                    ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-500/20 to-blue-600/20 border-2 border-blue-500/50 shadow-xl sm:shadow-2xl shadow-blue-500/20'
                        : 'bg-gradient-to-b from-slate-700/50 to-slate-800/50 border border-slate-600/30 sm:hover:border-slate-500/50 sm:hover:shadow-xl'
                    }
                    cursor-pointer
                  `}
                >
                  {/* Today Badge */}
                  {isToday && (
                    <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-lg">
                      {isToday}
                    </div>
                  )}

                  {/* Day Name */}
                  <div
                    className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 ${
                      isSelected ? 'text-blue-300' : 'text-white sm:group-hover:text-blue-200'
                    } transition-colors`}
                  >
                    {dayName}
                  </div>

                  {/* Date */}
                  <div
                    className={`text-[10px] sm:text-xs mb-2 sm:mb-3 ${
                      isSelected ? 'text-blue-200' : 'text-slate-400 sm:group-hover:text-slate-300'
                    } transition-colors`}
                  >
                    {month} {dayDate}
                  </div>

                  {/* Score Circle with Weather Emoji */}
                  <div className="relative mb-2 sm:mb-3">
                    <div
                      className={`
                    w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-xl relative
                    bg-gradient-to-br ${getScoreColor(dayScore)} shadow-lg ${getScoreGlow(dayScore)}
                    ${
                      isSelected
                        ? 'ring-2 sm:ring-4 ring-blue-400/50 shadow-xl sm:shadow-2xl'
                        : 'sm:group-hover:shadow-xl sm:group-hover:scale-110'
                    }
                    transition-all duration-300
                  `}
                    >
                      <span className="relative">{dayScore.toFixed(1)}</span>

                      {/* Shimmer effect */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Weather emoji */}
                    <div className="absolute -bottom-1 -right-1 text-lg">{getWeatherEmoji(dayScore)}</div>
                  </div>

                  {/* Score Label */}
                  <div
                    className={`text-xs font-medium ${
                      isSelected
                        ? 'text-blue-200'
                        : dayScore >= 8
                        ? 'text-green-300'
                        : dayScore >= 6
                        ? 'text-yellow-300'
                        : dayScore >= 4
                        ? 'text-orange-300'
                        : 'text-red-300'
                    } group-hover:text-white transition-colors`}
                  >
                    {getScoreLabel(dayScore)}
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  )}
                </button>
              </div>
            )
          })}

        </div>
      </div>

      {/* Mobile Legend */}
      <div className="flex md:hidden justify-center gap-4 text-xs mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-lg shadow-green-500/30"></div>
          <span className="text-slate-300">Best</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full shadow-lg shadow-yellow-400/30"></div>
          <span className="text-slate-300">Good</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full shadow-lg shadow-orange-400/30"></div>
          <span className="text-slate-300">Fair</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gradient-to-r from-red-400 to-red-500 rounded-full shadow-lg shadow-red-400/30"></div>
          <span className="text-slate-300">Poor</span>
        </div>
      </div>
    </div>
  )
}
