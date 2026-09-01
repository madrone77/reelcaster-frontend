'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Calendar, LogOut, LifeBuoy } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { storedFirstName } from '@/lib/display-name'
import ExploreTopBar from '@/app/explore/components/explore-top-bar'
import { PAGE_MEASURE, READING_MEASURE } from '@/app/components/layout/page-measure'
import SubscriptionCard from '@/app/components/account/subscription-card'
import HomeCityCard from '@/app/components/account/home-city-card'
import PhoneVerifyCard from '@/app/components/account/phone-verify-card'
import DangerZoneCard from '@/app/components/account/danger-zone-card'

/**
 * Account settings — identity, plan, support, and the destructive actions.
 * One of the three buckets the old monolithic /profile page split into
 * (see /profile landing, plus /settings/units).
 */
export default function AccountSettingsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [firstNameInput, setFirstNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setFirstNameInput(storedFirstName(user) ?? '')
  }, [user])

  // AuthGate already blocks anonymous access to /settings; this only guards the
  // brief window before the session resolves client-side.
  useEffect(() => {
    if (user === null) router.push('/')
  }, [user, router])

  const handleSaveName = async () => {
    setSavingName(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { first_name: firstNameInput.trim() },
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Name saved.' })
    } catch {
      setMessage({ type: 'error', text: 'Could not save your name.' })
    } finally {
      setSavingName(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (!user) return null

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className={`${PAGE_MEASURE} py-8`}>
          <div className={READING_MEASURE}>
            <div className="mb-6">
              <div className="rc-label text-[10px] text-rc-brand">Settings</div>
              <h1 className="text-2xl font-bold text-rc-ink mt-1">Account</h1>
              <p className="text-sm text-rc-ink-soft mt-1.5">Your identity, plan, and account controls.</p>
            </div>

            <div className="space-y-6">
              {message && (
                <Alert
                  className={
                    message.type === 'success'
                      ? 'border-rc-good-border bg-rc-good-bg text-rc-good-ink'
                      : 'border-rc-poor/40 bg-rc-poor-bg text-rc-poor-ink'
                  }
                >
                  {message.text}
                </Alert>
              )}

              {/* Account Information */}
              <Card className="border-rc-rule shadow-none">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-rc-brand" />
                    </div>
                    <div>
                      <CardTitle className="text-rc-ink">Account Information</CardTitle>
                      <CardDescription className="text-rc-ink-mute">Your account details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="account-first-name" className="text-sm font-medium text-rc-ink">
                        First name
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-ink-mute" />
                          <Input
                            id="account-first-name"
                            value={firstNameInput}
                            onChange={(e) => setFirstNameInput(e.target.value)}
                            placeholder="Your first name"
                            autoComplete="given-name"
                            className="pl-10 bg-rc-panel border-rc-rule text-rc-ink placeholder:text-rc-ink-mute focus-visible:border-rc-brand focus-visible:ring-rc-brand/25"
                          />
                        </div>
                        <Button
                          onClick={handleSaveName}
                          disabled={savingName}
                          variant="outline"
                          className="border-rc-rule text-rc-ink-soft hover:bg-rc-surface hover:text-rc-ink"
                        >
                          {savingName ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-rc-surface rounded-lg">
                      <Mail className="h-5 w-5 text-rc-ink-mute" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-rc-ink">Email</p>
                        <p className="text-sm text-rc-ink-mute truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-rc-surface rounded-lg">
                      <Calendar className="h-5 w-5 text-rc-ink-mute" />
                      <div>
                        <p className="text-sm font-medium text-rc-ink">Member Since</p>
                        <p className="text-sm text-rc-ink-mute">{new Date(user.created_at || '').toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-rc-rule">
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      className="w-full border-rc-rule text-rc-ink-soft hover:bg-rc-surface hover:text-rc-ink"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription */}
              <SubscriptionCard />

              {/* Where the dashboard and the map open. Asked once at signup;
                  this is the promised way back to it. */}
              <HomeCityCard />

              {/* Support */}
              <Card className="border-rc-rule shadow-none">
                <CardContent className="py-5 flex items-start gap-4">
                  <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center shrink-0">
                    <LifeBuoy className="h-5 w-5 text-rc-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-rc-ink font-semibold">Need a hand?</p>
                    <p className="text-sm text-rc-ink-mute mt-1">
                      The Port has guides, answers, service status and priority support for Pro members.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/support')}
                      className="w-full mt-4 border-rc-rule text-rc-brand hover:bg-rc-brand-soft hover:text-rc-brand transition-colors"
                    >
                      Open The Port
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Phone verification (SMS alerts) */}
              <PhoneVerifyCard />

              {/* Danger zone */}
              <DangerZoneCard />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
