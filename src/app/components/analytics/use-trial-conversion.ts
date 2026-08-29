'use client'

import { useEffect, useState } from 'react'

export interface TrialConversion {
  /** `StartTrial` when this checkout really began a trial, null when it did not. */
  event: 'StartTrial' | null
  /** `<subscription>:trial_start`, the id every network dedupes on. */
  eventId: string | null
  /**
   * Whether the question has been answered, one way or another. The page holds
   * its redirect on this, so it MUST become true even when everything fails.
   */
  settled: boolean
}

/**
 * Resolve, once, whether the checkout being returned from started a trial.
 *
 * Previously each of the three tags asked this for itself, which meant three
 * identical requests, each carrying two Stripe round trips, all racing the
 * two-second bounce to /explore that begins the moment the subscription goes
 * active. A tag whose answer arrives after the navigation reports nothing, and
 * the failure is invisible: the `/billing/success` pageview goal fires
 * instantly on load and keeps counting, so Plausible shows trials arriving
 * while the custom event that is supposed to describe them stays empty.
 *
 * One request now, and the page waits for it. The tags keep their own firing
 * and their own dedupe keys, so a change to one network still cannot break
 * another; only the question they all asked separately is shared.
 *
 * `HARD_CAP_MS` is what makes waiting safe. A customer who has just paid must
 * never be stranded on this page because Stripe is slow or an ad blocker ate
 * the request, so the answer is declared settled regardless once the cap
 * passes, and the page carries on to /explore. Losing the browser leg is
 * survivable: the webhook has already queued the same conversion server-side.
 */
const HARD_CAP_MS = 6000

export function useTrialConversion(sessionId: string | null): TrialConversion {
  const [state, setState] = useState<TrialConversion>({
    event: null,
    eventId: null,
    settled: false,
  })

  useEffect(() => {
    if (!sessionId) {
      setState({ event: null, eventId: null, settled: true })
      return
    }

    let cancelled = false
    const cap = setTimeout(() => {
      if (!cancelled) setState((s) => (s.settled ? s : { ...s, settled: true }))
    }, HARD_CAP_MS)

    const run = async () => {
      try {
        const res = await fetch(
          `/api/stripe/conversion-event?session_id=${encodeURIComponent(sessionId)}`,
        )
        if (cancelled) return
        if (!res.ok) {
          setState({ event: null, eventId: null, settled: true })
          return
        }
        const body = (await res.json()) as { event: 'StartTrial' | null; event_id: string | null }
        if (cancelled) return
        setState({ event: body.event, eventId: body.event_id, settled: true })
      } catch {
        // Never let conversion reporting break the page a customer just paid
        // on. Settled with no event: nothing fires, and the page moves on.
        if (!cancelled) setState({ event: null, eventId: null, settled: true })
      }
    }

    run()
    return () => {
      cancelled = true
      clearTimeout(cap)
    }
  }, [sessionId])

  return state
}
