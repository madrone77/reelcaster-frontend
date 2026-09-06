'use client'

/**
 * Give a month, get a month, on the account page.
 *
 * One link, two buttons. Share opens the phone's share sheet where there is
 * one, because that is where a text to a fishing buddy actually starts; Copy
 * is the desktop path and the fallback. The card also says what the link has
 * earned so far, because a counter that moves is what gets a link sent twice.
 *
 * Copy for a paying member says "a month off your next year" rather than
 * "a free month": the plan bills by the year, so their month arrives as one
 * twelfth of the price credited to the renewal. See referrals-server.ts.
 */

import { useCallback, useState } from 'react'
import { Gift, Check, Copy, Share2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@/hooks/use-subscription'
import { useReferralSummary } from '@/hooks/use-referral-summary'
import { trackEvent } from '@/lib/analytics'
import { referralShareText } from '@/lib/referrals'

export default function ReferralCard() {
  const { isPaid, stripeCustomerId } = useSubscription()
  const { summary, failed } = useReferralSummary()
  const [copied, setCopied] = useState(false)

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = useCallback(async () => {
    if (!summary) return
    trackEvent('Referral Link Copied', { friends: summary.friends })
    try {
      await navigator.clipboard.writeText(summary.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (some in-app browsers). The link is visible below;
      // long press still works.
    }
  }, [summary])

  const share = useCallback(async () => {
    if (!summary) return
    trackEvent('Referral Link Shared', { friends: summary.friends })
    try {
      await navigator.share({
        title: 'A month of ReelCaster Pro',
        text: referralShareText(summary.url),
      })
    } catch {
      // Dismissed. Nothing to report.
    }
  }, [summary])

  // Paying members are told the truth about the shape their month takes.
  const yours = isPaid && stripeCustomerId
    ? 'a month off your next year'
    : 'a month of Pro'

  const earned = summary
    ? summary.friends === 0
      ? 'Nobody has used your link yet.'
      : `${summary.friends} ${summary.friends === 1 ? 'friend has' : 'friends have'} joined through your link. ` +
        `${summary.monthsThisYear} of ${summary.cap} months earned this year.`
    : null

  return (
    <Card className="border-rc-rule shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-rc-brand-soft rounded-full flex items-center justify-center">
            <Gift className="h-5 w-5 text-rc-brand" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-rc-ink text-xl">Give a month, get a month</CardTitle>
            <CardDescription className="text-rc-ink-mute mt-1">
              A friend who joins through your link gets {summary?.days ?? 30} days of Pro, no card.
              You get {yours}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed ? (
          <p className="text-sm text-rc-ink-mute">Your link is not available right now. Try again in a minute.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-rc-surface p-3">
              <p className="min-w-0 flex-1 truncate font-rc-mono text-[13px] text-rc-ink">
                {summary ? summary.url.replace(/^https?:\/\//, '') : ' '}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={copy}
                disabled={!summary}
                className="shrink-0 border-rc-rule text-rc-ink hover:bg-rc-panel"
              >
                {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              {canShare && (
                <Button
                  size="sm"
                  onClick={share}
                  disabled={!summary}
                  className="shrink-0 bg-rc-brand hover:bg-rc-brand-hover text-white"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Share
                </Button>
              )}
            </div>
            <p className="text-xs text-rc-ink-mute">{earned ?? ' '}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
