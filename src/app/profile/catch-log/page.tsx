'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Fish,
  Anchor,
  MapPin,
  Clock,
  ChevronRight,
  Filter,
  RefreshCw,
  WifiOff,
  Loader2,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AppShell } from '@/app/components/layout'
import DashboardHeader from '@/app/components/forecast/dashboard-header'
import {
  getCatchesByUser,
  getPendingSyncCount,
  isOnline,
  onConnectivityChange,
  type OfflineCatch,
} from '@/lib/offline-catch-store'
import { startSyncManager, triggerSync } from '@/lib/catch-sync-manager'

// Centralized species config
import { SPECIES_OPTIONS } from '@/app/config/species'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-CA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CatchLogPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [catches, setCatches] = useState<OfflineCatch[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [filterSpecies, setFilterSpecies] = useState<string>('')
  const [filterOutcome, setFilterOutcome] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Load catches
  const loadCatches = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const data = await getCatchesByUser(user.id, {
        syncStatus: undefined, // Get all
      })
      setCatches(data)

      const pending = await getPendingSyncCount()
      setPendingCount(pending)
    } catch (error) {
      console.error('Error loading catches:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initialize
  useEffect(() => {
    if (user) {
      loadCatches()
      startSyncManager()
    }

    setOnline(isOnline())
    const cleanup = onConnectivityChange((isOnlineNow) => {
      setOnline(isOnlineNow)
    })

    return cleanup
  }, [user, loadCatches])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // Handle manual sync
  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerSync()
      await loadCatches()
    } finally {
      setSyncing(false)
    }
  }

  // Filter catches
  const filteredCatches = catches.filter((c) => {
    if (filterSpecies && c.speciesId !== filterSpecies) return false
    if (filterOutcome && c.outcome !== filterOutcome) return false
    return true
  })

  // Calculate stats
  const stats = {
    total: catches.length,
    landed: catches.filter((c) => c.outcome === 'landed').length,
    bites: catches.filter((c) => c.outcome === 'bite').length,
    thisMonth: catches.filter((c) => {
      const catchDate = new Date(c.caughtAt)
      const now = new Date()
      return catchDate.getMonth() === now.getMonth() && catchDate.getFullYear() === now.getFullYear()
    }).length,
  }

  if (authLoading) {
    return (
      <AppShell showLocationPanel={false}>
        <div className="flex-1 min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!user) {
    return null
  }

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Catch Log"
          showTimeframe={false}
          showSetLocation={false}
        />

        <div className="max-w-4xl mx-auto">
          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 mb-6">
            <div className="flex items-center gap-3">
              {/* Sync status */}
              {!online && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 rounded-full text-xs text-yellow-300">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}

              {pendingCount > 0 && (
                <button
                  onClick={handleSync}
                  disabled={syncing || !online}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 rounded-lg text-sm text-white transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Sync ({pendingCount})</span>
                </button>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  showFilters
                    ? 'bg-blue-600 text-white'
                    : 'bg-rc-bg-light text-rc-text-muted hover:bg-rc-bg-dark'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
              <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
                <Fish className="w-4 h-4" />
                <span>Total Catches</span>
              </div>
              <p className="text-2xl font-bold text-rc-text">{stats.total}</p>
            </div>
            <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
                <Anchor className="w-4 h-4" />
                <span>Landed</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{stats.landed}</p>
            </div>
            <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
                <TrendingUp className="w-4 h-4" />
                <span>Bites</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{stats.bites}</p>
            </div>
            <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-400 text-xs mb-1">
                <Calendar className="w-4 h-4" />
                <span>This Month</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{stats.thisMonth}</p>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-rc-text-muted mb-2">Species</label>
                  <select
                    value={filterSpecies}
                    onChange={(e) => setFilterSpecies(e.target.value)}
                    className="w-full bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Species</option>
                    {SPECIES_OPTIONS.map((species) => (
                      <option key={species.id} value={species.id}>
                        {species.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-rc-text-muted mb-2">Outcome</label>
                  <select
                    value={filterOutcome}
                    onChange={(e) => setFilterOutcome(e.target.value)}
                    className="w-full bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Outcomes</option>
                    <option value="landed">Landed</option>
                    <option value="bite">Bite (Lost)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Catches List */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : filteredCatches.length === 0 ? (
              <div className="text-center py-12">
                <Fish className="w-12 h-12 text-rc-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-rc-text mb-2">
                  {catches.length === 0 ? 'No catches yet' : 'No matches found'}
                </h3>
                <p className="text-sm text-rc-text-muted">
                  {catches.length === 0
                    ? 'Use the Fish On button to log your first catch!'
                    : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              filteredCatches.map((catchItem) => (
                <div
                  key={catchItem.id}
                  className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4 hover:border-blue-500/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {/* Outcome Icon */}
                      <div
                        className={`p-3 rounded-xl ${
                          catchItem.outcome === 'landed'
                            ? 'bg-emerald-500/20'
                            : 'bg-amber-500/20'
                        }`}
                      >
                        {catchItem.outcome === 'landed' ? (
                          <Anchor
                            className={`w-6 h-6 ${
                              catchItem.outcome === 'landed' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          />
                        ) : (
                          <Fish className="w-6 h-6 text-amber-400" />
                        )}
                      </div>

                      <div>
                        {/* Species or Outcome */}
                        <h3 className="text-rc-text font-semibold">
                          {catchItem.speciesName || (catchItem.outcome === 'landed' ? 'Landed' : 'Bite')}
                        </h3>

                        {/* Date & Time */}
                        <div className="flex items-center gap-2 text-sm text-rc-text-muted mt-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {formatDate(catchItem.caughtAt)} at {formatTime(catchItem.caughtAt)}
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-2 text-sm text-rc-text-muted mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {catchItem.locationName ||
                              `${catchItem.locationLat.toFixed(4)}, ${catchItem.locationLng.toFixed(4)}`}
                          </span>
                        </div>

                        {/* Additional Details */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {catchItem.retentionStatus && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                catchItem.retentionStatus === 'kept'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-green-500/20 text-green-300'
                              }`}
                            >
                              {catchItem.retentionStatus === 'kept' ? 'Kept' : 'Released'}
                            </span>
                          )}
                          {catchItem.lengthCm && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-rc-bg-light text-rc-text-muted">
                              {catchItem.lengthCm} cm
                            </span>
                          )}
                          {catchItem.depthM && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-rc-bg-light text-rc-text-muted">
                              {catchItem.depthM}m deep
                            </span>
                          )}
                          {catchItem.lureName && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-rc-bg-light text-rc-text-muted">
                              {catchItem.lureName}
                            </span>
                          )}
                          {/* Sync Status */}
                          {catchItem.syncStatus !== 'synced' && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                catchItem.syncStatus === 'pending'
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : catchItem.syncStatus === 'conflict'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {catchItem.syncStatus === 'pending'
                                ? 'Pending sync'
                                : catchItem.syncStatus === 'conflict'
                                  ? 'Sync conflict'
                                  : 'Syncing...'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-rc-text-muted" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
