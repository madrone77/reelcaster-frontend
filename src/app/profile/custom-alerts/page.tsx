'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { AppShell } from '@/app/components/layout'
import DashboardHeader from '@/app/components/forecast/dashboard-header'
import { CustomAlertsList } from '@/app/components/alerts/custom-alerts-list'
import { CustomAlertForm } from '@/app/components/alerts/custom-alert-form'
import type { AlertProfile } from '@/lib/custom-alert-engine'

export default function CustomAlertsPage() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profiles, setProfiles] = useState<AlertProfile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<AlertProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not logged in (wait for auth to resolve first)
  useEffect(() => {
    if (!user && !authLoading) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // Load profiles
  useEffect(() => {
    const loadProfiles = async () => {
      if (!session?.access_token) {
        setProfilesLoading(false)
        return
      }

      try {
        const response = await fetch('/api/alerts?include_history=true', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to load profiles')
        }

        const data = await response.json()
        setProfiles(data.profiles || [])
      } catch (err) {
        console.error('Error loading profiles:', err)
        setError('Failed to load alert profiles')
      } finally {
        setProfilesLoading(false)
      }
    }

    if (user && session) {
      loadProfiles()
    } else if (!user) {
      setProfilesLoading(false)
    }
  }, [user, session])

  const handleCreateProfile = async (profileData: Partial<AlertProfile>) => {
    if (!session?.access_token) return

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(profileData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create profile')
      }

      const { profile } = await response.json()
      setProfiles([profile, ...profiles])
      setShowForm(false)
    } catch (err) {
      throw err
    }
  }

  const handleUpdateProfile = async (profileData: Partial<AlertProfile> & { id?: string }) => {
    if (!session?.access_token || !profileData.id) return

    try {
      const response = await fetch('/api/alerts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(profileData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }

      const { profile } = await response.json()
      setProfiles(profiles.map((p) => (p.id === profile.id ? profile : p)))
      setEditingProfile(null)
    } catch (err) {
      throw err
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    if (!session?.access_token) return

    try {
      const response = await fetch(`/api/alerts?id=${profileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete profile')
      }

      setProfiles(profiles.filter((p) => p.id !== profileId))
    } catch (err) {
      console.error('Error deleting profile:', err)
      setError('Failed to delete profile')
    }
  }

  const handleToggleActive = async (profileId: string, isActive: boolean) => {
    if (!session?.access_token) return

    try {
      const response = await fetch('/api/alerts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: profileId, is_active: isActive }),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      const { profile } = await response.json()
      setProfiles(profiles.map((p) => (p.id === profile.id ? profile : p)))
    } catch (err) {
      console.error('Error toggling profile:', err)
      setError('Failed to update profile')
    }
  }

  if (!user) {
    return null
  }

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Custom Alerts"
          showTimeframe={false}
          showSetLocation={false}
        />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-end">
            {!showForm && !editingProfile && (
              <Button
                onClick={() => setShowForm(true)}
                disabled={profiles.length >= 10}
                className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <Plus className="h-4 w-4" />
                New Alert
              </Button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Card className="border-red-500 bg-red-500/10">
              <CardContent className="py-4">
                <p className="text-red-400 text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Form or List */}
          {showForm || editingProfile ? (
            <CustomAlertForm
              profile={editingProfile}
              onSubmit={editingProfile ? handleUpdateProfile : handleCreateProfile}
              onCancel={() => {
                setShowForm(false)
                setEditingProfile(null)
              }}
            />
          ) : profilesLoading ? (
            <Card className="bg-rc-bg-dark border-rc-bg-light">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-rc-text-muted">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
                  <p>Loading alerts...</p>
                </div>
              </CardContent>
            </Card>
          ) : profiles.length === 0 ? (
            <Card className="bg-rc-bg-dark border-rc-bg-light">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-rc-bg-light rounded-full flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-rc-text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold text-rc-text mb-2">No Custom Alerts Yet</h3>
                  <p className="text-rc-text-muted mb-6 max-w-md">
                    Create custom alerts to get notified when specific fishing conditions
                    are detected at your favorite spots.
                  </p>
                  <Button onClick={() => setShowForm(true)} className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    <Plus className="h-4 w-4" />
                    Create Your First Alert
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <CustomAlertsList
              profiles={profiles}
              onEdit={(profile) => setEditingProfile(profile)}
              onDelete={handleDeleteProfile}
              onToggleActive={handleToggleActive}
            />
          )}

          {/* Info card */}
          <Card className="bg-rc-bg-dark border-rc-bg-light">
            <CardHeader>
              <CardTitle className="text-rc-text text-base">How Custom Alerts Work</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-rc-text-muted space-y-2">
              <p>
                <strong className="text-rc-text">Triggers:</strong> Set conditions for wind, tide, pressure, water temperature,
                solunar periods, and fishing score.
              </p>
              <p>
                <strong className="text-rc-text">Logic Mode:</strong> Choose AND (all conditions must match) or OR (any condition can match).
              </p>
              <p>
                <strong className="text-rc-text">Cooldown:</strong> Prevents duplicate alerts. Set 1-168 hours between notifications.
              </p>
              <p>
                <strong className="text-rc-text">Active Hours:</strong> Only check conditions during specific times of day.
              </p>
              <p>
                <strong className="text-rc-text">Evaluation:</strong> Conditions are checked every 30 minutes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
