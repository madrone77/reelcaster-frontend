'use client'

import { useEffect } from 'react'
import { META_PIXEL_ID, metaTrack } from '@/lib/meta-pixel'
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
 */
export default function MetaStartTrial({ conversion }: { conversion: TrialConversion }) {
  const { event, eventId } = conversion

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

    metaTrack('StartTrial', { eventId })
  }, [event, eventId])

  return null
}
