'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthForm } from '../components/auth/auth-form'
import HeroScoreCard from '@/app/(marketing)/components/hero-score-card'
import { NotebookPen, BarChart3, Bell, MapPin } from 'lucide-react'
import Link from 'next/link'
import { readNextParam } from '@/lib/next-param'
import Image from 'next/image'

const features = [
  { icon: BarChart3, label: '14-Day Fishing Forecasts' },
  { icon: MapPin, label: 'Tide & Marine Conditions' },
  { icon: Bell, label: 'Custom Alerts' },
  { icon: NotebookPen, label: 'Catch Logging' },
]

export default function SignupPage() {
  const { loading } = useAuth()
  const router = useRouter()

  // Note: we intentionally do NOT auto-redirect signed-in visitors away from
  // this page — the signup screen always renders so it can be viewed/shared
  // directly. After a successful signup, AuthForm's onSuccess handles the
  // hand-off to /explore.
  if (loading) {
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
    <div className="fixed inset-0 flex bg-rc-panel">
      {/* LEFT — the form. Every input + button is the existing AuthForm,
          unchanged; only the page around it is redesigned. Full-width below
          the wide breakpoint; left half at wide. */}
      <div className="flex w-full flex-col justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:w-1/2 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center">
            <Link href="/" aria-label="ReelCaster home" className="mx-auto flex w-fit">
              <Image
                src="/reelcaster-mark.svg"
                alt="ReelCaster"
                width={120}
                height={56}
                priority
              />
            </Link>

            <h1 className="mt-10 text-balance text-3xl font-black tracking-[-0.02em] text-rc-ink">
              Create an account
            </h1>
            <p className="mt-2 text-pretty text-sm text-rc-ink-mute">
              Join as a Member. Today&apos;s Reelcaster Score in under a
              minute.
            </p>
          </div>

          <div className="mt-8">
            <AuthForm
              defaultMode="signup"
              source="signup-page"
              onSuccess={() => router.replace(readNextParam('/explore'))}
            />
          </div>

          <p className="mt-6 text-center text-sm text-rc-ink-mute">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT — brand panel (wide only): the product itself on navy, plus the
          pitch and feature highlights. */}
      <div className="relative hidden w-1/2 flex-col justify-center overflow-hidden border-l border-rc-rule bg-rc-band px-12 lg:flex xl:px-16">
        <div className="relative z-10 mx-auto w-full max-w-md">
          <HeroScoreCard />

          <h2 className="mt-10 text-balance text-center text-2xl font-black tracking-[-0.02em] text-rc-ink">
            Know the bite. Before you go.
          </h2>
          <p className="mt-3 text-pretty text-center text-sm leading-relaxed text-rc-ink-soft">
            Reelcaster folds tides, weather, water, and regulations into one
            score, so you plan the day before you leave the dock.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-rc-rule bg-rc-panel px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-rc-brand" />
                <span className="text-xs text-rc-ink-soft">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
