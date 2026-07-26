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
    <Card className="border-rc-rule shadow-none">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
            <Crown className="h-5 w-5 text-rc-brand" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-rc-ink text-xl">Subscription</CardTitle>
            <CardDescription className="text-rc-ink-mute mt-1">
              Manage your ReelCaster plan and billing
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={
              isPaid
                ? 'bg-rc-good-bg text-rc-good-ink border-rc-good-border'
                : 'bg-rc-surface text-rc-ink-mute border-rc-rule'
            }
          >
            {loading ? '…' : TIER_LABELS[tier] ?? tier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-rc-surface rounded-lg p-3">
            <p className="text-xs text-rc-ink-mute">Status</p>
            <p className="text-rc-ink font-semibold mt-1">
              {loading ? '—' : STATUS_LABELS[status] ?? status}
            </p>
          </div>
          <div className="bg-rc-surface rounded-lg p-3">
            <p className="text-xs text-rc-ink-mute">
              {status === 'canceled' ? 'Access until' : 'Next renewal'}
            </p>
            <p className="text-rc-ink font-semibold mt-1">
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
          <div className="bg-rc-poor-bg border border-rc-poor/40 rounded-md p-3 text-sm text-rc-poor-ink">
            {error}
          </div>
        )}

        {isPaid ? (
          <Button
            onClick={handleManage}
            disabled={opening || !stripeCustomerId}
            variant="outline"
            className="w-full border-rc-rule text-rc-ink hover:bg-rc-surface"
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
            className="w-full bg-rc-brand hover:bg-rc-brand-hover text-white"
          >
            <Link href="/plans?from=profile">
              Upgrade to Pro
            </Link>
          </Button>
        )}

        <p className="text-xs text-rc-ink-mute">
          {isPaid
            ? 'Use the Stripe portal to update your card, change plan, or cancel anytime.'
            : 'Pro unlocks the full 14-day forecast, custom spots in covered waters, up to 10 alerts, and SMS delivery (coming soon).'}
        </p>
      </CardContent>
    </Card>
  )
}
