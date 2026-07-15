'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthForm } from '../components/auth/auth-form'
import { Fish, BarChart3, Bell, MapPin } from 'lucide-react'
import Link from 'next/link'

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
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading || (user && wasAlreadyAuthed.current)) {
    return (
      <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-rc-text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-blue-600/20">
              <Fish className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-logo text-rc-text">ReelCaster</h1>
          </div>
          <p className="text-sm text-rc-text-muted">
            BC&apos;s most accurate fishing forecast platform
          </p>
        </div>

        {/* Auth form card */}
        <div className="bg-rc-bg-dark border border-rc-bg-light rounded-2xl p-6">
          <AuthForm
            defaultMode="signin"
            source="login-page"
            onSuccess={() => router.push('/dashboard')}
          />
        </div>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rc-bg-dark/50 border border-rc-bg-light/50"
            >
              <Icon className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-rc-text-muted">{label}</span>
            </div>
          ))}
        </div>

        {/* Link to signup */}
        <p className="text-center mt-6 text-sm text-rc-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
