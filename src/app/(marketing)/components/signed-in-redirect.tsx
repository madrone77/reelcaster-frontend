'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

// Signed-in anglers have no use for the pitch — reelcaster.com sends them
// straight to their dashboard.
//
// This has to be client-side: supabase-js keeps the session in localStorage,
// not a cookie, so neither middleware nor the server render can tell a signed-in
// visitor from a crawler. Redirecting here also keeps the homepage's static HTML
// intact for search engines, which is the whole point of the marketing page.
const DESTINATION = '/dashboard'

// supabase-js stores the session under `sb-<project-ref>-auth-token`.
const SUPABASE_SESSION_KEY = /^sb-.+-auth-token$/

function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && SUPABASE_SESSION_KEY.test(key)) return true
    }
  } catch {
    // Storage blocked (private mode, embedded webview) — fall back to the
    // authoritative pass below.
  }
  return false
}

// `useLayoutEffect` warns when React renders this on the server; the layout
// timing only matters in the browser anyway.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

export default function SignedInRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  // Optimistic pass: peek at the stored session before the browser paints the
  // hydrated page. `getSession()` is async (and may refresh the token over the
  // network), so waiting for it would flash the hero at every signed-in user.
  useBeforePaint(() => {
    if (hasStoredSession()) {
      setLeaving(true)
      router.prefetch(DESTINATION)
    }
  }, [router])

  // Authoritative pass: only a confirmed session navigates. A stale token that
  // can't be refreshed drops the cover and leaves the visitor on the homepage
  // rather than bouncing them through /dashboard into /login.
  useEffect(() => {
    if (loading) return
    if (user) {
      setLeaving(true)
      router.replace(DESTINATION)
    } else {
      setLeaving(false)
    }
  }, [loading, user, router])

  if (!leaving) return null

  // Opaque cover over the marketing page for the handful of frames between
  // hydration and the dashboard render.
  return (
    <div
      className="fixed inset-0 z-[9999] bg-rc-panel flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-rc-ink-soft">Opening your dashboard…</span>
    </div>
  )
}
