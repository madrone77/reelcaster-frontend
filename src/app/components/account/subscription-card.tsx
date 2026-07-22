'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Crown, ExternalLink, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSubscription } from '@/hooks/use-subscription'
import { supabase } from '@/lib/supabase'

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro_monthly: 'Pro · Monthly',
  pro_annual: 'Pro · Annual',
}

const STATUS_LABELS: Record<string, string> = {
  none: 'No subscription',
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  unpaid: 'Unpaid',
}

export default function SubscriptionCard() {
  const { tier, status, isPaid, loading, periodEnd, stripeCustomerId } = useSubscription()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleManage = async () => {
    setOpening(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json()
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Could not open portal')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open portal')
      setOpening(false)
    }
  }

  return (
    <Card className="bg-rc-bg-dark border-rc-bg-light">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
            <Crown className="h-6 w-6 text-rc-text" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-rc-text text-xl">Subscription</CardTitle>
            <CardDescription className="text-rc-text-muted mt-1">
              Manage your ReelCaster plan and billing
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={
              isPaid
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rc-bg-light text-rc-text-muted border-rc-bg-light'
            }
          >
            {loading ? '…' : TIER_LABELS[tier] ?? tier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-rc-bg-light/30 rounded-lg p-3">
            <p className="text-xs text-rc-text-muted">Status</p>
            <p className="text-rc-text font-semibold mt-1">
              {loading ? '—' : STATUS_LABELS[status] ?? status}
            </p>
          </div>
          <div className="bg-rc-bg-light/30 rounded-lg p-3">
            <p className="text-xs text-rc-text-muted">
              {status === 'canceled' ? 'Access until' : 'Next renewal'}
            </p>
            <p className="text-rc-text font-semibold mt-1">
              {periodEnd
                ? new Date(periodEnd).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-md p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {isPaid ? (
          <Button
            onClick={handleManage}
            disabled={opening || !stripeCustomerId}
            variant="outline"
            className="w-full bg-rc-bg-light/30 border-rc-bg-light text-rc-text hover:bg-rc-bg-light"
          >
            {opening ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening portal…
              </>
            ) : (
              <>
                Manage subscription <ExternalLink className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            asChild
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            <Link href="/pricing?from=profile">
              Upgrade to Pro
            </Link>
          </Button>
        )}

        <p className="text-xs text-rc-text-muted">
          {isPaid
            ? 'Use the Stripe portal to update your card, change plan, or cancel anytime.'
            : 'Pro unlocks the full 14-day forecast, custom spots in covered waters, up to 10 alerts, and SMS delivery (coming soon).'}
        </p>
      </CardContent>
    </Card>
  )
}
