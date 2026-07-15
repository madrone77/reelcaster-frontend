'use client'

import { useEffect } from 'react'
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

export default function SignupPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/explore')
    }
  }, [user, loading, router])

  if (loading || user) {
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
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-rc-brand-soft">
              <Fish className="h-6 w-6 text-rc-brand" />
            </div>
            <h1 className="text-2xl font-bold text-rc-ink">ReelCaster</h1>
          </div>
          <p className="text-sm text-rc-ink-mute">
            BC&apos;s most accurate fishing forecast platform
          </p>
        </div>

        {/* Auth form card */}
        <div className="bg-rc-panel border border-rc-rule rounded-2xl shadow-rc-panel p-6">
          <AuthForm defaultMode="signup" source="signup-page" />
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

        {/* Link to login */}
        <p className="text-center mt-6 text-sm text-rc-ink-mute">
          Already have an account?{' '}
          <Link href="/login" className="text-rc-brand hover:text-rc-brand-hover transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
