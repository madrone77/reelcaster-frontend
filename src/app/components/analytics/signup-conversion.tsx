'use client'

import { useEffect } from 'react'
import { PLAUSIBLE_SIGNUP_EVENT, plausibleTrack } from '@/lib/plausible'
import { metaTrack } from '@/lib/meta-pixel'
import { trackEvent } from '@/lib/analytics'
import {
  META_SIGNUP_EVENT,
  SIGNUP_MODELED_VALUE_CENTS,
  SIGNUP_VALUE_CURRENCY,
  signupEventId,
} from '@/lib/signup-conversion'

/**
 * The browser half of the signup conversion.
 *
 * Rendered by <AttributionCapture> once the server has confirmed that the
 * account being looked at is genuinely new. That confirmation is the whole
 * design: this cannot fire from the signup form, because with email
 * confirmation on `signUp()` returns no session and the account arrives minutes
 * later on a page that never saw the form, and because Google sign-in never
 * touches the form at all. The one moment every signup passes through is the
 * first time a browser holds a session for the account, and the only thing that
 * can tell a first signup from an old customer on a new laptop is the account's
 * age, which lives on the server.
 *
 * The Meta event is deliberately fired here as well as from the server drain.
 * `uploadToMeta` can only report a signup that arrived on an fbclid, which is
 * the small minority, and the payload it can build carries the click id alone.
 * The browser carries `_fbp`, `_fbc`, a real user agent and a real address, so
 * match quality is not close. The two are reconciled by `signupEventId`.
 *
 * ⚠ Plausible does NOT deduplicate. What keeps it to one fire per account is
 * the server: this only mounts for the one post that inserted the account's
 * conversion row (`conversion_recorded`). The localStorage key below is a
 * leftover second guard against a remount in the same browser; on its own it
 * only ever covered one browser, which is how a new account signing in on a
 * second device used to count twice.
 */
export default function SignupConversion({
  userId,
  path,
}: {
  userId: string
  path: 'free' | 'checkout'
}) {
  useEffect(() => {
    const key = `rc_signup_fired:${userId}`
    try {
      if (window.localStorage.getItem(key)) return
      window.localStorage.setItem(key, '1')
    } catch {
      // Storage unavailable, which on iOS with cookies blocked THROWS rather
      // than returning null. Fire anyway, matching <PlausibleStartTrial>: that
      // failure is permanent for the browser it happens in, so going quiet
      // would lose every signup those visitors make, where firing costs a
      // double count only if one of them also reloads inside the window.
    }

    plausibleTrack(PLAUSIBLE_SIGNUP_EVENT, { path })
    trackEvent('Signup Completed', { path })

    // Value on a registration event is unusual and deliberate. See
    // SIGNUP_MODELED_VALUE_CENTS: it is what a free account is modeled to be
    // worth, not a charge, and the server sends the identical figure.
    metaTrack(META_SIGNUP_EVENT, {
      eventId: signupEventId(userId),
      customData: {
        value: SIGNUP_MODELED_VALUE_CENTS / 100,
        currency: SIGNUP_VALUE_CURRENCY.toUpperCase(),
      },
    })
  }, [userId, path])

  return null
}
