'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OpenMeteoDailyForecast } from '../../utils/fishingCalculations'
import { getScoreBgClass, getScoreGradient, getScoreLabel } from '@/app/utils/score-utils'

interface DayOutlookNewProps {
  forecasts: OpenMeteoDailyForecast[]
  selectedDay?: number
  onDaySelect?: (dayIndex: number) => void
}

export default function DayOutlookNew({
  forecasts,
  selectedDay = 0,
  onDaySelect,
}: DayOutlookNewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const displayForecasts = forecasts.slice(0, 14)

  // Check scroll position
  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    updateScrollButtons()
    const ref = scrollRef.current
    ref?.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)
    return () => {
      ref?.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [])

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }, [])

  return (
    <div className="bg-rc-bg-darkest rounded-xl border border-rc-bg-light p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-rc-text">14-Day Outlook</h2>
        <p className="text-sm text-rc-text-muted mt-1">
          Best fishing periods and outlook for the next two weeks.
        </p>
      </div>

      {/* Cards Container with Navigation */}
      <div className="relative flex items-center">
        {/* Left Arrow - hidden on mobile, swipe to scroll instead */}
        <button
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className={`flex-shrink-0 w-10 h-24 hidden sm:flex items-center justify-center rounded-xl mr-2 transition-colors ${
            canScrollLeft
              ? 'bg-rc-bg-light hover:bg-rc-bg-dark text-rc-text'
              : 'bg-rc-bg-light/50 text-rc-text-muted cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scrollable Cards */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {displayForecasts.map((forecast, index) => {
              const bestScore =
                forecast.twoHourForecasts.length > 0
                  ? Math.max(...forecast.twoHourForecasts.map(f => f.score.total))
                  : 0
              const dayScore = bestScore

              const date = new Date(forecast.date * 1000)
              const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })
              const month = date.toLocaleDateString('en-US', { month: 'short' })
              const dayDate = date.getDate()

              const isSelected = selectedDay === index

              return (
                <button
                  key={index}
                  onClick={() => onDaySelect?.(index)}
                  className={`
                    flex-shrink-0 w-[160px] p-3 rounded-lg transition-all duration-200 relative
                    border border-white/5
                    ${isSelected ? 'ring-2 ring-blue-500/50' : ''}
                    cursor-pointer hover:border-white/10
                  `}
                  style={{
                    backgroundColor: '#242424',
                    backgroundImage: getScoreGradient(dayScore),
                  }}
                >
                  {/* Top row: Day name and date */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-rc-text">{dayName}</span>
                    <span className="text-sm text-rc-text-muted">{month} {dayDate}</span>
                  </div>

                  {/* Bottom row: Score and badge */}
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-bold text-rc-text">
                      {dayScore.toFixed(1)}
                    </span>
                    {/* Badge with dark background */}
                    <div className="flex items-center gap-1.5 bg-[#121212] px-2.5 py-1.5 rounded-md">
                      <div className={`w-1 h-4 rounded-full ${getScoreBgClass(dayScore)}`} />
                      <span className="text-sm font-medium text-rc-text">{getScoreLabel(dayScore)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

        </div>

        {/* Right Arrow - hidden on mobile, swipe to scroll instead */}
        <button
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className={`flex-shrink-0 w-10 h-24 hidden sm:flex items-center justify-center rounded-xl ml-2 transition-colors ${
            canScrollRight
              ? 'bg-rc-bg-light hover:bg-rc-bg-dark text-rc-text'
              : 'bg-rc-bg-light/50 text-rc-text-muted cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
