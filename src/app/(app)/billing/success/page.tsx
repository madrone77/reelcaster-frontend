'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { useSubscription } from '@/hooks/use-subscription'
import { useAuth } from '@/contexts/auth-context'
import MetaStartTrial from '@/app/components/analytics/meta-start-trial'

interface CheckoutStatus {
  tier: string
  status: string
  is_active: boolean
  period_end: string | null
}

function BillingSuccessInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const subscription = useSubscription()
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<CheckoutStatus | null>(null)
  const [polling, setPolling] = useState(true)
  // Pay-first purchases land here with no session at all: the account was
  // created from the email Stripe billed, and this is where it gets claimed.
  const [claimState, setClaimState] = useState<'idle' | 'working' | 'emailed'>(
    'idle',
  )

  useEffect(() => {
    if (authLoading || user || !sessionId) return

    let cancelled = false
    let attempts = 0
    setClaimState('working')

    const claim = async () => {
      try {
        const res = await fetch('/api/stripe/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const body = await res.json().catch(() => ({}))

        if (cancelled) return

        // 202 = the webhook hasn't provisioned the account yet. Keep waiting.
        if (res.status === 202) {
          attempts += 1
          if (attempts < 15) setTimeout(claim, 2000)
          else setClaimState('emailed')
          return
        }

        if (body?.status === 'signed_in' && body.url) {
          // The magic link signs them in and returns to /explore.
          window.location.href = body.url
          return
        }
        setClaimState('emailed')
      } catch {
        if (!cancelled) setClaimState('emailed')
      }
    }

    claim()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, sessionId])

  // Poll the checkout status endpoint until the webhook flips
  // user_settings.subscription_status to active. Bail out after ~30s.
  useEffect(() => {
    // Signed-out buyer: nothing to poll with. The claim effect above owns
    // that path until the magic link lands them back here signed in.
    if (!sessionId || (!authLoading && !user)) {
      setPolling(false)
      return
    }
    let cancelled = false
    let attempts = 0
    const poll = async () => {
      try {
        const data = await apiFetch<CheckoutStatus>(
          `/api/stripe/checkout?session_id=${encodeURIComponent(sessionId)}`,
        )
        if (cancelled) return
        setStatus(data)
        if (data.is_active) {
          setPolling(false)
          subscription.refresh()
          // Give the user a moment to read the success state, then bounce.
          setTimeout(() => router.replace('/explore'), 2000)
          return
        }
      } catch {
        // Soft-fail; we'll retry until the timeout below.
      }
      attempts += 1
      if (attempts < 15) {
        setTimeout(poll, 2000)
      } else if (!cancelled) {
        setPolling(false)
      }
    }
    poll()
    return () => {
      cancelled = true
    }
    // subscription.refresh / router are stable refs; we want this to fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div className="mx-auto flex max-w-lg flex-col px-6 py-12 md:py-16">
      {/* Renders null. Mounted first so the conversion request is in flight
          before the two-second bounce to /explore, and before a signed-out
          buyer is redirected out through their magic link. */}
      <MetaStartTrial sessionId={sessionId} />
      <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
        ReelCaster Pro
      </p>

      <div
        className="mt-6 rounded-xl border border-rc-rule bg-rc-panel p-6 text-center shadow-rc-panel md:p-8"
        data-testid="billing-success"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rc-good-border bg-rc-good-bg">
          <CheckCircle2 className="h-7 w-7 text-rc-good" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-[-0.02em] text-rc-ink md:text-3xl">
          Welcome to ReelCaster Pro
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
          Your 14-day forecast, multi-species scoring, bathymetry layer, and expanded alerts are
          unlocking now.
        </p>

        {claimState === 'working' ? (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-rc-ink-mute">
            <Loader2 className="h-4 w-4 animate-spin" />
            Setting up your account…
          </div>
        ) : claimState === 'emailed' ? (
          // Either the email already had an account (paying isn't proof of
          // owning an inbox) or the one-time handoff was already used.
          <div className="mt-6 text-sm leading-relaxed text-rc-ink-soft">
            Your subscription is active. We&apos;ve emailed you a sign-in
            link. Open it and you&apos;re in. No password needed.
          </div>
        ) : polling ? (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-rc-ink-mute">
            <Loader2 className="h-4 w-4 animate-spin" />
            Activating your account…
          </div>
        ) : status?.is_active ? (
          <div className="mt-6 text-sm font-semibold text-rc-good-ink">
            All set. Taking you to Explore.
          </div>
        ) : (
          <div className="mt-6 text-sm leading-relaxed text-rc-ink-soft">
            Stripe is still finalizing your subscription. You can{' '}
            <Link
              href="/explore"
              className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              head to Explore
            </Link>
            . Pro features unlock as soon as the webhook lands.
          </div>
        )}
      </div>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessInner />
    </Suspense>
  )
}
