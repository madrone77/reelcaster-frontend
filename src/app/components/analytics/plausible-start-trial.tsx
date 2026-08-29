'use client'

import { useEffect } from 'react'
import { PLAUSIBLE_TRIAL_EVENT, plausibleTrack } from '@/lib/plausible'
import type { TrialConversion } from './use-trial-conversion'

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
 * The answer arrives as a prop rather than from a request of its own. The
 * three tags used to ask separately, which was three requests racing the
 * two-second bounce to /explore, and this one lost often enough that the goal
 * looked broken while the /billing/success pageview goal kept counting. They
 * are still three separate components firing separately, so one network's
 * config or failure cannot take another's reporting down; only the question is
 * shared. See use-trial-conversion.ts.
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
export default function PlausibleStartTrial({
  conversion,
}: {
  conversion: TrialConversion
}) {
  const { event, eventId } = conversion

  useEffect(() => {
    if (event !== 'StartTrial' || !eventId) return

    const key = `rc_plausible_fired:${eventId}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // Storage unavailable. Fire rather than go quiet; see above.
    }

    plausibleTrack(PLAUSIBLE_TRIAL_EVENT)
  }, [event, eventId])

  return null
}
