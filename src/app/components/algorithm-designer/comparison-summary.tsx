'use client'

import { BarChart3, Settings2, ArrowUpDown } from 'lucide-react'

interface ComparisonSummaryProps {
  originalAvg: number
  customAvg: number
  originalBestWindow: string
  customBestWindow: string
  originalBestScore: number
  customBestScore: number
}

export default function ComparisonSummary({
  originalAvg,
  customAvg,
  originalBestWindow,
  customBestWindow,
  originalBestScore,
  customBestScore,
}: ComparisonSummaryProps) {
  const delta = customAvg - originalAvg
  const windowChanged = originalBestWindow !== customBestWindow

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Original Score */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
          <BarChart3 className="w-4 h-4" />
          <span>Original Average</span>
        </div>
        <p className="text-2xl font-bold text-rc-text">
          {originalAvg.toFixed(1)}{' '}
          <span className="text-sm font-normal text-rc-text-muted">/ 10</span>
        </p>
        <p className="text-xs text-rc-text-muted mt-1">
          Best: {originalBestWindow} ({originalBestScore.toFixed(1)})
        </p>
      </div>

      {/* Custom Score */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-400 text-xs mb-1">
          <Settings2 className="w-4 h-4" />
          <span>Custom Average</span>
        </div>
        <p className="text-2xl font-bold text-blue-400">
          {customAvg.toFixed(1)}{' '}
          <span className="text-sm font-normal text-rc-text-muted">/ 10</span>
        </p>
        <p className="text-xs text-rc-text-muted mt-1">
          Best: {customBestWindow} ({customBestScore.toFixed(1)})
        </p>
      </div>

      {/* Delta */}
      <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
        <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
          <ArrowUpDown className="w-4 h-4" />
          <span>Change</span>
        </div>
        <p
          className={`text-2xl font-bold ${
            delta > 0
              ? 'text-emerald-400'
              : delta < 0
                ? 'text-red-400'
                : 'text-rc-text'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}
        </p>
        <p className="text-xs text-rc-text-muted mt-1">
          {windowChanged
            ? `Best window shifted to ${customBestWindow}`
            : 'Best window unchanged'}
        </p>
      </div>
    </div>
  )
}
