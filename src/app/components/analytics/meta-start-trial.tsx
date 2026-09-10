'use client'

import { useEffect } from 'react'
import { META_PIXEL_ID, metaIdentify, metaTrack } from '@/lib/meta-pixel'
import { useAuth } from '@/contexts/auth-context'
import type { TrialConversion } from './use-trial-conversion'

/**
 * Fires the browser `StartTrial` on the checkout return page.
 *
 * Page load, not an inline click. The trial does not begin on our site — it
 * begins when Stripe confirms the card on Stripe's own domain — so a tag on the
 * checkout button would also fire for declined cards and abandoned sessions.
 * This page is the first moment the trial is a fact.
 *
 * The event id has to match what the webhook will send to the Conversions API,
 * and the browser has no way to know the subscription id: the success_url only
 * carries `session_id`. `/api/stripe/conversion-event` trades one for the
 * other, and answers `event: null` for a plain monthly purchase, which is
 * charged immediately and starts no trial.
 *
 * The answer is resolved once for all three tags and handed down as a prop.
 * The page now holds its redirect until that resolves, so the common case is
 * no longer a race. A signed-out buyer can still be bounced out through their
 * magic link first, and that remains survivable precisely because this is the
 * second reporting leg: the webhook has already queued the same conversion
 * server-side.
 *
 * AND IT TELLS THE SERVER IT FIRED. The pixel's Conversions API Gateway
 * relays this event to Meta as a server copy, so the uploader must not send a
 * third. It used to skip trial_start unconditionally for that reason, which
 * meant a trial whose browser copy never fired — ad blocker, in-app webview,
 * a tab closed on Stripe's receipt — reached Meta not once. The POST below is
 * how the uploader tells those apart. Fire-and-forget, `keepalive` so it
 * survives the bounce to /explore two seconds from now, and silent on
 * failure: a missed report costs a duplicate at worst, and a customer who has
 * just paid must never see a reporting error.
 */
export default function MetaStartTrial({
  conversion,
  sessionId,
}: {
  conversion: TrialConversion
  sessionId: string | null
}) {
  const { event, eventId, emailHash, firstNameHash, lastNameHash } = conversion
  // Usually null here: a signed-out buyer's account is made by the webhook
  // and they are bounced through a magic link later. Sent when it is known.
  const { user } = useAuth()
  const externalId = user?.id ?? null

  useEffect(() => {
    if (!META_PIXEL_ID) return
    if (event !== 'StartTrial' || !eventId) return

    // A refresh must not report a second trial. Meta also dedupes on the
    // event id, so this guard is belt and braces, which is why a browser that
    // refuses storage (iOS with cookies blocked makes this THROW, not return
    // null) falls through and fires anyway rather than going silent.
    const key = `rc_meta_fired:${eventId}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // Storage unavailable. Fire and let Meta deduplicate.
    }

    // Who this is, before the event: advanced matching is what lifts this
    // event's match quality off the floor (src/lib/meta-match.ts).
    metaIdentify({ emailHash, firstNameHash, lastNameHash, externalId })
    metaTrack('StartTrial', { eventId })

    if (!sessionId) return
    try {
      void fetch('/api/stripe/conversion-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // Storage-blocked and privacy-hardened browsers throw from odd places.
    }
  }, [event, eventId, emailHash, firstNameHash, lastNameHash, externalId, sessionId])

  return null
}
