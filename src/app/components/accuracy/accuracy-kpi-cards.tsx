'use client'

import { Target, TrendingUp, TrendingDown, Minus, Fish, BarChart3 } from 'lucide-react'

interface AccuracyKPICardsProps {
  meanAbsError: number | null
  hitRate1pt: number | null
  hitRate2pt: number | null
  totalBlocks: number
  totalDays: number
  trendDirection: 'improving' | 'degrading' | 'stable'
  totalCatches: number
  totalLanded: number
  loading: boolean
}

export default function AccuracyKPICards({
  meanAbsError,
  hitRate1pt,
  hitRate2pt,
  totalBlocks,
  totalDays,
  trendDirection,
  totalCatches,
  totalLanded,
  loading,
}: AccuracyKPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4 animate-pulse">
            <div className="h-3 w-20 bg-rc-bg-light rounded mb-3" />
            <div className="h-8 w-16 bg-rc-bg-light rounded" />
          </div>
        ))}
      </div>
    )
  }

  const TrendIcon = trendDirection === 'improving' ? TrendingDown
    : trendDirection === 'degrading' ? TrendingUp
    : Minus

  const trendColor = trendDirection === 'improving' ? 'text-emerald-400'
    : trendDirection === 'degrading' ? 'text-red-400'
    : 'text-rc-text-muted'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Mean Absolute Error */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
          <Target className="w-4 h-4" />
          <span>Mean Abs. Error</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-rc-text">
            {meanAbsError !== null ? meanAbsError.toFixed(1) : '—'}
          </p>
          <span className="text-xs text-rc-text-muted">pts</span>
          <TrendIcon className={`w-4 h-4 ml-auto ${trendColor}`} />
        </div>
        <p className="text-xs text-rc-text-muted mt-1">{totalDays} days, {totalBlocks} blocks</p>
      </div>

      {/* Hit Rate (within 1pt) */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
          <BarChart3 className="w-4 h-4" />
          <span>Hit Rate (±1pt)</span>
        </div>
        <p className={`text-2xl font-bold ${
          hitRate1pt !== null && hitRate1pt >= 70 ? 'text-emerald-400' :
          hitRate1pt !== null && hitRate1pt >= 50 ? 'text-amber-400' :
          hitRate1pt !== null ? 'text-red-400' : 'text-rc-text'
        }`}>
          {hitRate1pt !== null ? `${hitRate1pt}%` : '—'}
        </p>
        <p className="text-xs text-rc-text-muted mt-1">Blocks within 1 point</p>
      </div>

      {/* Hit Rate (within 2pts) */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
          <BarChart3 className="w-4 h-4" />
          <span>Hit Rate (±2pts)</span>
        </div>
        <p className={`text-2xl font-bold ${
          hitRate2pt !== null && hitRate2pt >= 85 ? 'text-emerald-400' :
          hitRate2pt !== null && hitRate2pt >= 65 ? 'text-amber-400' :
          hitRate2pt !== null ? 'text-red-400' : 'text-rc-text'
        }`}>
          {hitRate2pt !== null ? `${hitRate2pt}%` : '—'}
        </p>
        <p className="text-xs text-rc-text-muted mt-1">Blocks within 2 points</p>
      </div>

      {/* Catch Correlation */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
          <Fish className="w-4 h-4" />
          <span>Catch Data</span>
        </div>
        <p className="text-2xl font-bold text-rc-text">
          {totalCatches > 0 ? totalCatches : '—'}
        </p>
        <p className="text-xs text-rc-text-muted mt-1">
          {totalCatches > 0 ? `${totalLanded} landed` : 'No catches logged yet'}
        </p>
      </div>
    </div>
  )
}
