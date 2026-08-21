'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { googleTrackTrialStart } from '@/lib/google-ads'

interface ConversionEventResponse {
  event: 'StartTrial' | null
  event_id: string | null
}

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
 * the other.
 *
 * The email is for enhanced conversions and is genuinely optional. In the
 * pay-first flow the account is still being claimed when this page first
 * renders, so `user` is null for a second or two. Putting `email` in the
 * effect deps would have looked like the fix and was not: the first run fires
 * without an email and claims the dedupe key, so the re-run with the email
 * arrives to find the conversion already reported. Instead the fetch starts
 * immediately, then we give the claim a bounded moment to produce an email
 * before firing once. If it never does, the conversion fires anyway. Worse
 * match quality beats a missing conversion.
 */

/** How long to wait for the account claim before firing without an email. */
const EMAIL_GRACE_MS = 2000
const EMAIL_POLL_MS = 250
export default function GoogleStartTrial({ sessionId }: { sessionId: string | null }) {
  const { user } = useAuth()
  // Read through a ref so the effect can wait on the email without listing it
  // as a dependency and re-running the whole conversion.
  const emailRef = useRef<string | null>(null)
  emailRef.current = user?.email ?? null

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    const waitForEmail = async (): Promise<string | null> => {
      const deadline = Date.now() + EMAIL_GRACE_MS
      while (!emailRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, EMAIL_POLL_MS))
        if (cancelled) return null
      }
      return emailRef.current
    }

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

      // Google dedupes on transaction_id, so this guard is belt and braces —
      // which is why a browser that refuses storage (iOS with cookies blocked
      // makes this THROW, not return null) falls through and fires anyway
      // rather than going silent.
      const key = `rc_google_fired:${body.event_id}`
      try {
        if (window.sessionStorage.getItem(key)) return
        window.sessionStorage.setItem(key, '1')
      } catch {
        // Storage unavailable. Fire and let Google deduplicate.
      }

      googleTrackTrialStart(body.event_id, await waitForEmail())
    }

    run()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return null
}
