'use client'

import { useEffect } from 'react'
import { META_PIXEL_ID, metaTrack } from '@/lib/meta-pixel'

interface ConversionEventResponse {
  event: 'StartTrial' | null
  event_id: string | null
}

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
 * Best-effort by design. The page redirects to /explore about two seconds after
 * the subscription goes active, and a signed-out buyer is bounced through a
 * magic link before that, so this request can be cut off mid-flight. That is
 * survivable precisely because it is the second reporting leg: the webhook has
 * already queued the same conversion server-side.
 */
export default function MetaStartTrial({ sessionId }: { sessionId: string | null }) {
  useEffect(() => {
    if (!sessionId || !META_PIXEL_ID) return

    let cancelled = false

    const run = async () => {
      let body: ConversionEventResponse
      try {
        const res = await fetch(
          `/api/stripe/conversion-event?session_id=${encodeURIComponent(sessionId)}`,
        )
        if (!res.ok) return
        body = (await res.json()) as ConversionEventResponse
      } catch {
        // Never let conversion reporting break the page a customer just paid on.
        return
      }

      if (cancelled || body.event !== 'StartTrial' || !body.event_id) return

      // A refresh must not report a second trial. Meta also dedupes on the
      // event id, so this guard is belt and braces — which is why a browser
      // that refuses storage (iOS with cookies blocked makes this THROW, not
      // return null) falls through and fires anyway rather than going silent.
      const key = `rc_meta_fired:${body.event_id}`
      try {
        if (window.sessionStorage.getItem(key)) return
        window.sessionStorage.setItem(key, '1')
      } catch {
        // Storage unavailable. Fire and let Meta deduplicate.
      }

      metaTrack('StartTrial', { eventId: body.event_id })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return null
}
