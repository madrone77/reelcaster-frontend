'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, MapPin, Beaker, Bell } from 'lucide-react'
import { type AlgorithmVersion } from './algorithm-version-toggle'
import { ReportIcon } from '@/app/components/common/report-icon'
import SetDefaultLocationModal from '@/app/components/location/set-default-location-modal'

interface DashboardHeaderProps {
  title?: string
  showTimeframe?: boolean
  showSetLocation?: boolean
  showAlgorithm?: boolean
  showCustomNotifications?: boolean
  onAlgorithmChange?: (version: AlgorithmVersion) => void
}

const TIMEFRAME_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '3-day', label: '3 Days' },
  { value: '7-day', label: '7 Days' },
  { value: '14-day', label: '14 Days' },
]

const ALGORITHM_OPTIONS = [
  { value: 'v2' as AlgorithmVersion, label: 'V2 (Physics-Based)' },
  { value: 'v1' as AlgorithmVersion, label: 'V1 (Legacy)' },
]

export default function DashboardHeader({
  title = 'Reports',
  showTimeframe = false,
  showSetLocation = true,
  showAlgorithm = false,
  showCustomNotifications = true,
  onAlgorithmChange,
}: DashboardHeaderProps) {
  const router = useRouter()
  const [timeframe, setTimeframe] = useState<string>('')
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)

  // Algorithm dropdown state
  const [algorithmVersion, setAlgorithmVersion] = useState<AlgorithmVersion>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('algorithm-version')
      if (saved === 'v1' || saved === 'v2') return saved
    }
    return 'v2'
  })
  const [isAlgorithmOpen, setIsAlgorithmOpen] = useState(false)

  // Sync algorithm version on mount
  useEffect(() => {
    if (onAlgorithmChange) {
      const saved = localStorage.getItem('algorithm-version')
      if (saved === 'v1' || saved === 'v2') {
        onAlgorithmChange(saved)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAlgorithmChange = (version: AlgorithmVersion) => {
    setAlgorithmVersion(version)
    localStorage.setItem('algorithm-version', version)
    onAlgorithmChange?.(version)
    setIsAlgorithmOpen(false)
  }

  const selectedTimeframeLabel = TIMEFRAME_OPTIONS.find(t => t.value === timeframe)?.label || 'Not selected'
  const selectedAlgorithmLabel = ALGORITHM_OPTIONS.find(a => a.value === algorithmVersion)?.label || 'V2'

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rc-bg-light rounded-lg">
          <ReportIcon className="w-5 h-5 text-rc-text-light" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-rc-text">{title}</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Algorithm Version Dropdown - Pill Shape */}
        {showAlgorithm && (
          <div className="relative">
            <button
              onClick={() => setIsAlgorithmOpen(!isAlgorithmOpen)}
              className="flex items-center bg-rc-bg-dark hover:bg-rc-bg-light border border-rc-bg-light rounded-full text-sm transition-colors"
            >
              <span className="flex items-center gap-2 px-4 py-2 text-rc-text-muted border-r border-rc-bg-light">
                <Beaker className="w-4 h-4" />
                <span className="hidden sm:inline">Algorithm</span>
              </span>
              <span className="flex items-center gap-2 px-4 py-2 text-rc-text">
                {selectedAlgorithmLabel}
                <ChevronDown className={`w-4 h-4 text-rc-text-muted transition-transform ${isAlgorithmOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {isAlgorithmOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsAlgorithmOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-rc-bg-light border border-rc-bg-dark rounded-lg shadow-xl z-20 overflow-hidden">
                  {ALGORITHM_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleAlgorithmChange(option.value)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        algorithmVersion === option.value
                          ? 'bg-blue-600 text-rc-text'
                          : 'text-rc-text-light hover:bg-rc-bg-dark'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Timeframe Dropdown - Pill Shape */}
        {showTimeframe && (
          <div className="relative">
            <button
              onClick={() => setIsTimeframeOpen(!isTimeframeOpen)}
              className="flex items-center bg-rc-bg-dark hover:bg-rc-bg-light border border-rc-bg-light rounded-full text-sm transition-colors"
            >
              <span className="px-4 py-2 text-rc-text-muted border-r border-rc-bg-light">Timeframe</span>
              <span className="flex items-center gap-2 px-4 py-2 text-rc-text">
                {selectedTimeframeLabel}
                <ChevronDown className={`w-4 h-4 text-rc-text-muted transition-transform ${isTimeframeOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {isTimeframeOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsTimeframeOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-40 bg-rc-bg-light border border-rc-bg-dark rounded-lg shadow-xl z-20 overflow-hidden">
                  {TIMEFRAME_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTimeframe(option.value)
                        setIsTimeframeOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        timeframe === option.value
                          ? 'bg-blue-600 text-rc-text'
                          : 'text-rc-text-light hover:bg-rc-bg-dark'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Set Location Button - Pill Shape */}
        {showSetLocation && (
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center bg-rc-bg-dark hover:bg-rc-bg-light border border-rc-bg-light rounded-full text-sm transition-colors"
          >
            <span className="flex items-center gap-2 px-4 py-2 text-rc-text">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Set Location</span>
            </span>
          </button>
        )}

        {/* Custom Notifications Button - Pill Shape */}
        {showCustomNotifications && (
          <button
            onClick={() => router.push('/profile/custom-alerts')}
            className="flex items-center bg-rc-bg-dark hover:bg-rc-bg-light border border-rc-bg-light rounded-full text-sm transition-colors"
          >
            <span className="flex items-center gap-2 px-4 py-2 text-rc-text">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Custom Alerts</span>
            </span>
          </button>
        )}

      </div>

      {/* Set Default Location Modal */}
      <Suspense fallback={null}>
        <SetDefaultLocationModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
        />
      </Suspense>
    </header>
  )
}
