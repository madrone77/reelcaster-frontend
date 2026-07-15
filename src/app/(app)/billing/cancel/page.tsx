'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X as CancelIcon } from 'lucide-react'
import { AppShell } from '@/app/components/layout'
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow'

export default function BillingCancelPage() {
  const { openCheckout, loading, error } = useUpgradeFlow()
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await openCheckout({ plan: 'annual', from: 'billing-cancel' })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 flex items-center justify-center">
        <div
          className="bg-rc-bg-dark border border-rc-bg-light rounded-2xl p-8 max-w-lg w-full"
          data-testid="billing-cancel"
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-rc-bg-light flex items-center justify-center">
            <CancelIcon className="w-7 h-7 text-rc-text-muted" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-rc-text text-center">
            Checkout canceled
          </h1>
          <p className="mt-2 text-sm text-rc-text-muted text-center">
            No worries — nothing was charged. Here&rsquo;s what Pro unlocks when you&rsquo;re ready.
          </p>

          <ul className="mt-5 space-y-2 text-sm text-rc-text">
            <li>· 14-day forecast with hourly detail</li>
            <li>· Multi-species comparative scoring (up to 5 species)</li>
            <li>· Bathymetry layer (NOAA + CHS)</li>
            <li>· Unlimited alerts and favorite spots</li>
            <li>· Forecast emails tuned to your home water</li>
          </ul>

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error.message}</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading || retrying}
              className="inline-flex flex-1 items-center justify-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              data-testid="billing-cancel-retry"
            >
              {retrying || loading ? 'Opening checkout…' : 'Try again'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/explore"
              className="inline-flex flex-1 items-center justify-center gap-1 px-4 py-2 bg-rc-bg-light hover:bg-rc-bg-darkest text-rc-text rounded-lg text-sm font-medium border border-rc-bg-light"
            >
              Back to Explore
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
