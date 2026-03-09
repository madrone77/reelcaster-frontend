'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OpenMeteoDailyForecast } from '@/app/utils/fishingCalculations'
import { getScoreBgClass, getScoreLabel } from '@/app/utils/score-utils'

interface DayOutlookOverlayProps {
  forecasts: OpenMeteoDailyForecast[]
  selectedDay: number
  onDaySelect: (dayIndex: number) => void
  compact?: boolean
}

export default function DayOutlookOverlay({
  forecasts,
  selectedDay,
  onDaySelect,
  compact = false,
}: DayOutlookOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const displayForecasts = forecasts.slice(0, 14)

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
    return () => ref?.removeEventListener('scroll', updateScrollButtons)
  }, [])

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth',
      })
    }
  }, [])

  if (!displayForecasts.length) return null

  return (
    <div className="pointer-events-auto px-3 pb-1">
      <div className="relative flex items-center">
        {/* Left arrow */}
        {!compact && (
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`flex-shrink-0 w-7 h-7 hidden sm:flex items-center justify-center rounded-full mr-1 transition-colors ${
              canScrollLeft
                ? 'bg-rc-bg-dark hover:bg-rc-bg-light text-rc-text border border-rc-bg-light'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable day cards */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {displayForecasts.map((forecast, index) => {
              const bestScore =
                forecast.twoHourForecasts.length > 0
                  ? Math.max(...forecast.twoHourForecasts.map(f => f.score.total))
                  : 0

              const date = new Date(forecast.date * 1000)
              const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
              const dayDate = date.getDate()

              const isSelected = selectedDay === index

              return (
                <button
                  key={index}
                  onClick={() => onDaySelect(index)}
                  className={`flex-shrink-0 transition-all duration-200 rounded-lg border
                    ${compact ? 'px-3 py-1.5 min-w-[80px]' : 'px-4 py-2 min-w-[100px]'}
                    ${isSelected
                      ? 'bg-blue-600 border-blue-500/50'
                      : 'bg-rc-bg-dark border-rc-bg-light hover:bg-rc-bg-light'
                    }
                  `}
                >
                  <div className={`text-center ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
                    <div className={`font-medium text-rc-text ${compact ? 'text-[10px]' : 'text-xs'}`}>
                      {dayName}
                    </div>
                    <div className={`text-rc-text-muted ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                      {date.toLocaleDateString('en-US', { month: 'short' })} {dayDate}
                    </div>
                    <div className={`font-bold text-rc-text ${compact ? 'text-base' : 'text-lg'}`}>
                      {bestScore.toFixed(1)}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${getScoreBgClass(bestScore)}`} />
                      <span className={`font-medium text-rc-text-light ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                        {getScoreLabel(bestScore)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right arrow */}
        {!compact && (
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`flex-shrink-0 w-7 h-7 hidden sm:flex items-center justify-center rounded-full ml-1 transition-colors ${
              canScrollRight
                ? 'bg-rc-bg-dark hover:bg-rc-bg-light text-rc-text border border-rc-bg-light'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
