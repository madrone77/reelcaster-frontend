'use client'

import { useEffect } from 'react'
import { PLAUSIBLE_TRIAL_EVENT, plausibleTrack } from '@/lib/plausible'

interface ConversionEventResponse {
  event: 'StartTrial' | null
  event_id: string | null
}

/**
 * Reports the trial start to Plausible on the checkout return page.
 *
 * The third leg beside <MetaStartTrial> and <GoogleStartTrial>, built on the
 * same gate for the same reason: the trial begins when Stripe confirms the card
 * on Stripe's domain, so a tag on the checkout button would also fire for
 * declined cards and abandoned sessions. `/api/stripe/conversion-event` turns
 * the session id into an honest answer, and a plain monthly purchase answers
 * `event: null` and reports nothing.
 *
 * Its own request rather than a value shared with the other two. They are kept
 * apart on purpose (see google-start-trial.tsx): one network's config or
 * failure must not be able to take another network's reporting down with it.
 * The cost is a third call to that endpoint on this page.
 *
 * ⚠ Plausible does NOT deduplicate. Meta and Google both discard a repeat with
 * a known event id, which makes their sessionStorage guards belt and braces;
 * here the guard is the only thing standing between a refresh and a second
 * trial in the numbers. It still fires when storage throws (iOS with cookies
 * blocked THROWS rather than returning null), because that failure is per
 * browser and permanent: skipping there would lose every trial those visitors
 * start, where firing costs a double count only if one of them also reloads
 * this page inside the 30-minute session window.
 *
 * Best-effort, like its two siblings. The page bounces to /explore about two
 * seconds after the subscription goes active. The tracker posts with
 * `keepalive`, so an in-flight event survives that navigation, but a request
 * that has not started yet is simply lost, and that is survivable: this is a
 * pageview counter, not the conversion feed a bidder learns from.
 */
export default function PlausibleStartTrial({ sessionId }: { sessionId: string | null }) {
  useEffect(() => {
    if (!sessionId) return

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
        // Never let analytics break the page a customer just paid on.
        return
      }

      if (cancelled || body.event !== 'StartTrial' || !body.event_id) return

      const key = `rc_plausible_fired:${body.event_id}`
      try {
        if (window.sessionStorage.getItem(key)) return
        window.sessionStorage.setItem(key, '1')
      } catch {
        // Storage unavailable. Fire rather than go quiet; see above.
      }

      plausibleTrack(PLAUSIBLE_TRIAL_EVENT)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return null
}
