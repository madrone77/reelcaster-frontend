'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

/**
 * A signed-in angler never stays in the ad frame.
 *
 * The frame (`?ad=<wall>` on Explore, a spot page or a city page) is a landing
 * page for bought clicks: no navigation, one Start free trial button, the
 * trial modal behind it. All of that is aimed at somebody who has not signed
 * up. When the click comes from somebody who already has an account (a
 * retargeting ad, a saved link, a shared one) the frame takes their app away,
 * sells a Pro member the plan they already have, and shows them a URL full of
 * campaign plumbing: `?ad=today&a=...&fbclid=...`.
 *
 * So this sends them to the same page in its ordinary dress, at a clean URL.
 * Mounted by every ad surface, and only when the frame is on, so every other
 * render of those shells pays nothing for it.
 *
 * WHY CLIENT-SIDE. supabase-js keeps the session in localStorage, so the edge
 * and the server render cannot know. On the spot and city pages the frame is a
 * middleware rewrite on `?ad=`; replacing the URL without it lands on the
 * public page because the rewrite no longer matches.
 *
 * CONFIRMED SESSIONS ONLY. An earlier cut (FE #559, never merged) also left on
 * a synchronous localStorage peek. That is faster for a member but wrong for
 * paid traffic: a stale token that supabase-js is about to wipe would send a
 * cold click off the page the ad paid for. A member sees the frame for the
 * moment auth takes to settle, and Explore's spot-open allowance already lets
 * a signed-in reader through in that window (FE #805).
 *
 * WHAT IS STRIPPED. Every parameter that exists for the ad rather than the
 * page: the frame itself (`ad`), the pitch (`a`), the landing-page stamp
 * (`via`), and the click ids and UTM fields the network appended. Attribution
 * is not lost by dropping them: the edge already wrote the touch cookies off
 * the request that carried them, before any of this ran.
 *
 * WHAT IS KEPT. Anything that says where on the page to be: `loc`, `spot`,
 * `keep`, `day`, and so on. `city` is the ad link's alias for `loc` (accepted
 * only under `ad`, see explore-route.tsx), so it is carried over as `loc`
 * rather than dropped, or the exit would also lose the city the ad chose.
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

  useEffect(() => {
    if (loading || !user || left.current) return
    left.current = true
    // Read off the browser, not `usePathname`: on the spot and city pages the
    // frame is reached by a middleware rewrite, and the address bar holds the
    // public path we want to land on, not the rewritten `/ad` one.
    router.replace(cleanAdUrl(window.location.pathname, window.location.search))
  }, [loading, user, router])

  return null
}
