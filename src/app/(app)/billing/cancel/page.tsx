'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, X as CancelIcon } from 'lucide-react'
import { btn } from '@/app/components/ui/button'
import PlanMatrix from '@/app/components/paywall/plan-matrix'
import { AuthForm } from '@/app/components/auth/auth-form'
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow'
import { useAuth } from '@/contexts/auth-context'
import { useSubscription } from '@/hooks/use-subscription'
import type { PlanTierId } from '@/lib/plan-features'
import { trackEvent } from '@/lib/analytics'
import { reportCheckoutHop } from '@/lib/paywall-counter'

/**
 * Where Stripe's Back arrow lands.
 *
 * The reader here tapped a pay button, reached Stripe's page and came back
 * without a card. Two of the three things on this page ask for the card again
 * (the header CTA and Try again). The third, for a signed-out reader, is a free
 * account: it keeps the email that the no-email checkout arm never collected,
 * gives them a login, and puts them on the free-tier nag path instead of losing
 * them cold. Try again stays primary; the free form sits under the matrix that
 * already shows the free rows, so the offer matches what the table says.
 *
 * Signed-in readers already have an account, so they get the page as before.
 *
 * On mount the page writes a `checkout_cancel` paywall event, feature and
 * surface from the rc_wall cookie server-side, the same way checkout_start
 * and checkout_redirect are stamped. That is the count of abandoners who came
 * back through our door at all; a closed tab never does. A free signup from
 * here is attributed to that same wall by /api/attribution/signup, which reads
 * the cookie the checkout left behind.
 */
export default function BillingCancelPage() {
  const { openCheckout, loading, error } = useUpgradeFlow()
  const { user, loading: authLoading } = useAuth()
  const { isPaid } = useSubscription()
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  // Same derivation as ProTrialModal, so the "You" column marks the same
  // tier whether they abandoned checkout or hit a wall inside the app.
  const viewerTier: PlanTierId = isPaid ? 'pro' : user ? 'free' : 'anon'

  useEffect(() => {
    trackEvent('Cancel Page Viewed', { tier: viewerTier })
    reportCheckoutHop('checkout_cancel', { viewerTier })
    // Once on mount; the tier is whatever had settled at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await openCheckout({ from: 'billing-cancel' })
    } finally {
      setRetrying(false)
    }
  }

  // Not rendered until auth has settled: a signed-in reader must never see a
  // form offering them the account they already have, and a flash of it on
  // first paint reads as exactly that.
  const offerFreeAccount = !authLoading && !user

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
            {/* Same framed Explore an ad lands on (`day2` wall, @/lib/ad-mode):
                they came from a checkout, not the signed-in app, so keep them
                in the walkthrough that sells Pro rather than the open map. */}
            <Link href="/explore?ad=day2" className={`${btn.secondary} sm:flex-1`}>
              Back to Explore
            </Link>
          </div>
        </div>

        {offerFreeAccount && (
          <div
            className="border-t border-rc-rule bg-rc-surface p-6 md:p-8"
            data-testid="billing-cancel-free-signup"
          >
            <h2 className="text-center text-lg font-black tracking-[-0.02em] text-rc-ink">
              Not ready to pay? Keep a free account
            </h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-rc-ink-soft">
              No card. The rows the free tier gets are yours to keep:
              today&rsquo;s bite score, the regs, a week ahead, and a catch log.
            </p>
            <div className="mx-auto mt-6 max-w-md">
              <AuthForm
                defaultMode="signup"
                source="billing-cancel"
                onSuccess={() => router.replace('/explore')}
              />
              <p className="mt-4 text-center text-sm text-rc-ink-mute">
                Already have an account?{' '}
                <Link
                  href="/login?next=/explore"
                  className="font-semibold text-rc-brand transition-colors hover:text-rc-brand-hover"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
