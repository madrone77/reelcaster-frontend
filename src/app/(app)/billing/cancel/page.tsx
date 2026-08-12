'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X as CancelIcon } from 'lucide-react'
import { btn } from '@/app/components/ui/button'
import PlanMatrix from '@/app/components/paywall/plan-matrix'
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/hooks/use-subscription'
import type { PlanTierId } from '@/lib/plan-features'

export default function BillingCancelPage() {
  const { openCheckout, loading, error } = useUpgradeFlow()
  const { user } = useAuth()
  const { isPaid } = useSubscription()
  const [retrying, setRetrying] = useState(false)

  // Same derivation as ProTrialModal, so the "You" column marks the same
  // tier whether they abandoned checkout or hit a wall inside the app.
  const viewerTier: PlanTierId = isPaid ? 'pro' : user ? 'free' : 'anon'

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await openCheckout({ from: 'billing-cancel' })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-12 md:py-16">
      <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
        ReelCaster Pro
      </p>

      {/* The matrix carries its own rules and gutters, so the card drops its
          padding and each block owns its own — otherwise the table would sit
          inset with its full-bleed row borders stopping short of the edge. */}
      <div
        className="mt-6 overflow-hidden rounded-xl border border-rc-rule bg-rc-panel shadow-rc-panel"
        data-testid="billing-cancel"
      >
        <div className="p-6 md:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rc-rule bg-rc-surface">
            <CancelIcon className="h-7 w-7 text-rc-ink-mute" />
          </div>
          <h1 className="mt-4 text-center text-2xl font-black tracking-[-0.02em] text-rc-ink md:text-3xl">
            Checkout canceled
          </h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-rc-ink-soft">
            No worries, nothing was charged. Here&rsquo;s what Pro unlocks when
            you&rsquo;re ready.
          </p>
        </div>

        {/* Not sticky: this page is scrolled by the window, and sticky heads
            would park themselves under the site's own sticky top bar. */}
        <PlanMatrix viewerTier={viewerTier} stickyHeader={false} />

        <div className="border-t border-rc-rule p-6 md:p-8">
          {error && (
            <p className="mb-4 text-center text-sm text-rc-poor">{error.message}</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading || retrying}
              className={`${btn.primary} gap-1.5 sm:flex-1`}
              data-testid="billing-cancel-retry"
            >
              {retrying || loading ? 'Opening checkout…' : 'Try again'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link href="/explore" className={`${btn.secondary} sm:flex-1`}>
              Back to Explore
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
