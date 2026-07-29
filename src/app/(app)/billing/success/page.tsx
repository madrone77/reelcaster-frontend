'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { AppShell } from '@/app/components/layout'
import { apiFetch } from '@/lib/api-client'
import { useSubscription } from '@/hooks/use-subscription'

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
  const [status, setStatus] = useState<CheckoutStatus | null>(null)
  const [polling, setPolling] = useState(true)

  // Poll the checkout status endpoint until the webhook flips
  // user_settings.subscription_status to active. Bail out after ~30s.
  useEffect(() => {
    if (!sessionId) {
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
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div
          className="bg-rc-bg-dark border border-rc-bg-light rounded-2xl p-8 max-w-lg w-full text-center"
          data-testid="billing-success"
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-rc-text">
            Welcome to ReelCaster Pro
          </h1>
          <p className="mt-2 text-sm text-rc-text-muted">
            Your 14-day forecast, multi-species scoring, bathymetry layer, and expanded alerts are
            unlocking now.
          </p>

          {polling ? (
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-rc-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Activating your account…
            </div>
          ) : status?.is_active ? (
            <div className="mt-6 text-sm text-green-400">All set — taking you to Explore.</div>
          ) : (
            <div className="mt-6 text-sm text-rc-text-muted">
              Stripe is still finalizing your subscription. You can{' '}
              <Link href="/explore" className="text-blue-400 hover:text-blue-300 underline">
                head to Explore
              </Link>{' '}
              — Pro features unlock as soon as the webhook lands.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <BillingSuccessInner />
    </Suspense>
  )
}
