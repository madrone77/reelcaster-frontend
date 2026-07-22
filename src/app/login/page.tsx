'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthForm } from '../components/auth/auth-form'
import { Fish, BarChart3, Bell, MapPin } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const features = [
  { icon: BarChart3, label: '14-Day Fishing Forecasts' },
  { icon: MapPin, label: 'Tide & Marine Conditions' },
  { icon: Bell, label: 'Custom Alerts' },
  { icon: Fish, label: 'Catch Logging' },
]

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  // Track if user was already signed in when page loaded (not from form submit)
  const wasAlreadyAuthed = useRef(false)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (!loading && !initialLoadDone.current) {
      initialLoadDone.current = true
      if (user) {
        wasAlreadyAuthed.current = true
      }
    }
  }, [loading, user])

  useEffect(() => {
    // Only redirect if user was already authenticated before page rendered
    // (e.g. navigated to /login while logged in). If they just signed in
    // via the form, the onSuccess callback handles navigation.
    if (!loading && user && wasAlreadyAuthed.current) {
      router.replace('/explore')
    }
  }, [user, loading, router])

  if (loading || (user && wasAlreadyAuthed.current)) {
    return (
      <div className="fixed inset-0 bg-rc-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-rc-brand animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-rc-brand/70 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-rc-brand/40 animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-rc-ink-mute">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-rc-page flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12">
        {/* Branding */}
        <div className="text-center mb-8">
          <Link href="/" aria-label="ReelCaster home" className="inline-flex mb-3">
            <Image src="/reelcaster-mark.svg" alt="ReelCaster" width={130} height={60} priority />
          </Link>
          <p className="text-sm text-rc-ink-mute">
            The fishing intelligence platform
          </p>
        </div>

        {/* Auth form card */}
        <div className="bg-rc-panel border border-rc-rule rounded-2xl shadow-rc-panel p-6">
          <AuthForm
            defaultMode="signin"
            source="login-page"
            onSuccess={() => router.push('/explore')}
          />
        </div>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rc-panel border border-rc-rule"
            >
              <Icon className="w-4 h-4 text-rc-brand flex-shrink-0" />
              <span className="text-xs text-rc-ink-mute">{label}</span>
            </div>
          ))}
        </div>

        {/* Link to signup */}
        <p className="text-center mt-6 text-sm text-rc-ink-mute">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-rc-brand hover:text-rc-brand-hover transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
