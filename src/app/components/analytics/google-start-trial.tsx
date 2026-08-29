'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { googleTrackTrialStart } from '@/lib/google-ads'
import type { TrialConversion } from './use-trial-conversion'

/**
 * Fires the Google Ads trial-start conversion on the checkout return page.
 *
 * The twin of <MetaStartTrial>, and deliberately built on the same gate: the
 * trial begins when Stripe confirms the card on Stripe's domain, not when
 * anyone clicks anything here, and `/api/stripe/conversion-event` is what
 * turns a session id into an honest answer about whether this was a trial at
 * all. A plain monthly purchase answers `event: null` and reports nothing.
 *
 * Two of them rather than one component firing both networks: the two have
 * different failure modes and different config, and the Meta leg has a working
 * server-side backstop where this one has none (see src/lib/google-ads.ts).
 * Coupling them would mean a change for one network can break reporting for
 * the other. The conversion answer itself IS shared, as a prop, because asking
 * three times was three requests racing the redirect off this page; see
 * use-trial-conversion.ts.
 *
 * The email is for enhanced conversions and is genuinely optional. In the
 * pay-first flow the account is still being claimed when this page first
 * renders, so `user` is null for a second or two. Putting `email` in the
 * effect deps would have looked like the fix and was not: the first run fires
 * without an email and claims the dedupe key, so the re-run with the email
 * arrives to find the conversion already reported. Instead the conversion is
 * resolved for us, then we give the claim a bounded moment to produce an email
 * before firing once. If it never does, the conversion fires anyway. Worse
 * match quality beats a missing conversion.
 */

/** How long to wait for the account claim before firing without an email. */
const EMAIL_GRACE_MS = 2000
const EMAIL_POLL_MS = 250
export default function GoogleStartTrial({ conversion }: { conversion: TrialConversion }) {
  const { user } = useAuth()
  const { event, eventId } = conversion
  // Read through a ref so the effect can wait on the email without listing it
  // as a dependency and re-running the whole conversion.
  const emailRef = useRef<string | null>(null)
  emailRef.current = user?.email ?? null

  useEffect(() => {
    if (event !== 'StartTrial' || !eventId) return

    let cancelled = false

    const waitForEmail = async (): Promise<string | null> => {
      const deadline = Date.now() + EMAIL_GRACE_MS
      while (!emailRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, EMAIL_POLL_MS))
        if (cancelled) return null
      }
      return emailRef.current
    }

    // Google dedupes on transaction_id, so this guard is belt and braces,
    // which is why a browser that refuses storage (iOS with cookies blocked
    // makes this THROW, not return null) falls through and fires anyway
    // rather than going silent.
    const key = `rc_google_fired:${eventId}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // Storage unavailable. Fire and let Google deduplicate.
    }

    void waitForEmail().then((email) => {
      if (!cancelled) googleTrackTrialStart(eventId, email)
    })

    return () => {
      cancelled = true
    }
  }, [event, eventId])

  return null
}
