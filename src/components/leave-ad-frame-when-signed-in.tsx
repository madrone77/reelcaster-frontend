'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { hasStoredSession } from '@/lib/stored-session'

/**
 * A signed-in angler never sees the ad frame.
 *
 * The frame (`?ad=<wall>` on Explore or a spot page) is a landing page for
 * bought clicks: no navigation, one Start free trial button, the trial modal
 * behind it. All of that is aimed at somebody who has not signed up. When the
 * click comes from somebody who already has an account — a retargeting ad, a
 * link they saved, a shared one — the frame takes their app away and shows
 * them a URL full of campaign plumbing: `?ad=day2&a=today&fbclid=...`.
 *
 * So this sends them to the same page in its ordinary dress, at a clean URL.
 * Mounted by both ad surfaces, and only when the frame is on, so every other
 * render of those shells pays nothing for it.
 *
 * WHY CLIENT-SIDE. supabase-js keeps the session in localStorage, so the edge
 * and the server render cannot know (see src/lib/stored-session.ts). The same
 * reason the homepage's signed-in redirect lives in the browser.
 *
 * WHAT IS STRIPPED. Every parameter that exists for the ad rather than the
 * page: the frame itself (`ad`), the pitch (`a`), the landing-page stamp
 * (`via`), and the click ids and UTM fields the network appended. Attribution
 * is not lost by dropping them: the edge already wrote the touch cookies off
 * the request that carried them, before any of this ran.
 *
 * WHAT IS KEPT. Anything that says where on the page to be: `loc`, `spot`,
 * `z`, `d`, and so on. `city` is the ad link's alias for `loc` (accepted only
 * under `ad`, see explore-route.tsx), so it is carried over as `loc` rather
 * than dropped, or the frame's exit would also lose the city the ad chose.
 *
 * TWO PASSES, like the homepage redirect. The stored-session peek is
 * synchronous and fires on mount; a stale token that fails to refresh lands
 * the visitor on the public page, which is a perfectly good place to be
 * signed out. The authoritative `useAuth` pass catches a session the peek
 * could not see (storage blocked, or a token still being written).
 */

const AD_PARAMS = new Set(['ad', 'a', 'via', 'city'])
const CLICK_IDS = new Set(['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid'])

/** The page's own URL, minus everything that was on it for the ad. */
export function cleanAdUrl(pathname: string, search: string): string {
  const incoming = new URLSearchParams(search)
  const kept = new URLSearchParams()
  for (const [key, value] of incoming) {
    const k = key.toLowerCase()
    if (AD_PARAMS.has(k) || CLICK_IDS.has(k) || k.startsWith('utm_')) continue
    kept.append(key, value)
  }
  const city = incoming.get('city')
  if (city && !kept.has('loc')) kept.set('loc', city)
  const query = kept.toString()
  return query ? `${pathname}?${query}` : pathname
}

export default function LeaveAdFrameWhenSignedIn() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const left = useRef(false)

  const leave = () => {
    if (left.current) return
    left.current = true
    // Read off the browser, not `usePathname`: on the spot page the ad frame
    // is reached by a middleware rewrite, and the address bar holds the public
    // path we want to land on, not the rewritten one.
    router.replace(cleanAdUrl(window.location.pathname, window.location.search))
  }

  // Optimistic pass: no network, fires as soon as we are in the browser.
  useEffect(() => {
    if (hasStoredSession()) leave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Authoritative pass: a confirmed session leaves; a confirmed no-session
  // stays and gets the frame the ad paid for.
  useEffect(() => {
    if (!loading && user) leave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user])

  return null
}
