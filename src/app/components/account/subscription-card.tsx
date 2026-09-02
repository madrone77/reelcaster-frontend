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
  free: 'Member',
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

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SubscriptionCard() {
  const {
    tier,
    status,
    isPaid,
    paymentFailed,
    inGrace,
    graceUntil,
    loading,
    periodEnd,
    stripeCustomerId,
  } = useSubscription()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Comped Pro has no Stripe customer, so there is no card and no portal.
  const isComped = isPaid && !stripeCustomerId

  const openPortal = async (flow?: 'payment_method_update') => {
    setOpening(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(flow ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(flow ? { body: JSON.stringify({ flow }) } : {}),
      })
      const body = await res.json()
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Could not open portal')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open portal')
      setOpening(false)
    }
  }

  // A declined card changes what the date cell means. In grace, the date that
  // matters is when Pro switches off. After grace, it is when it did.
  const dateLabel = paymentFailed
    ? inGrace
      ? 'Pro stays on until'
      : 'Pro off since'
    : status === 'canceled' || isComped
      ? 'Access until'
      : 'Next renewal'
  const dateValue = paymentFailed && graceUntil ? graceUntil : periodEnd

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
        {paymentFailed && !loading && (
          <div
            role="status"
            className="bg-rc-poor-bg border border-rc-poor/40 rounded-md p-3 text-sm text-rc-poor-ink leading-relaxed"
          >
            {inGrace ? (
              <>
                Your card was declined. Pro stays on until{' '}
                <strong>{formatDate(graceUntil)}</strong>. Update your card before
                then and nothing changes.
              </>
            ) : (
              <>
                Your card was declined and Pro is off. Update your card and it
                comes back as soon as the payment goes through.
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-rc-surface rounded-lg p-3">
            <p className="text-xs text-rc-ink-mute">Status</p>
            <p className="text-rc-ink font-semibold mt-1">
              {loading ? '—' : STATUS_LABELS[status] ?? status}
            </p>
          </div>
          <div className="bg-rc-surface rounded-lg p-3">
            <p className="text-xs text-rc-ink-mute">{dateLabel}</p>
            <p className="text-rc-ink font-semibold mt-1">{formatDate(dateValue)}</p>
          </div>
        </div>

        {error && (
          <div className="bg-rc-poor-bg border border-rc-poor/40 rounded-md p-3 text-sm text-rc-poor-ink">
            {error}
          </div>
        )}

        {isComped ? (
          // Pro with no Stripe customer means the account was comped. The
          // portal button would be permanently disabled with no explanation,
          // so say what's actually going on instead.
          <div className="bg-rc-good-bg border border-rc-good-border rounded-md p-3 text-sm text-rc-good-ink">
            Pro is complimentary on this account, so there&rsquo;s no billing to
            manage and no card on file.
          </div>
        ) : paymentFailed ? (
          // The one thing a declined customer needs is the card form. Land
          // them on it, not on the portal home. This shows whether or not the
          // grace window is still open: past grace, isPaid is false, and the
          // old branch here offered "Upgrade to Pro" to someone who already
          // has a subscription, with no way to reach the card that broke it.
          <Button
            onClick={() => openPortal('payment_method_update')}
            disabled={opening}
            className="w-full bg-rc-brand hover:bg-rc-brand-hover text-white"
          >
            {opening ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening Stripe…
              </>
            ) : (
              <>
                Update payment method <ExternalLink className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        ) : isPaid ? (
          <Button
            onClick={() => openPortal()}
            disabled={opening}
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
          {isComped
            ? 'You keep full Pro access until the date above. Nothing renews and nothing is charged.'
            : paymentFailed
            ? 'Stripe retries the charge on its own once a new card is on file. You can also change plan or cancel from the same page.'
            : isPaid
            ? 'Use the Stripe portal to update your card, change plan, or cancel anytime.'
            : 'Pro unlocks the full 14-day forecast, custom spots in covered waters, up to 10 alerts, and SMS delivery.'}
        </p>
      </CardContent>
    </Card>
  )
}
