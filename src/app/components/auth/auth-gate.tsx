'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

// Routes whose path EXACTLY equals one of these are public (used for the root
// marketing homepage, where prefix-matching '/' would match everything).
const PUBLIC_EXACT = ['/', '/coming-soon']

// Routes whose path starts with one of these are public.
const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/auth/',
  // The checkout funnel renders its own signed-out state with a sign-in link
  // that preserves next=/plans/checkout. Bouncing to a bare /login here would
  // drop the return path and lose the sale.
  '/plans',
  // Where Stripe returns a pay-first buyer. They have no account yet — the
  // page's job is to claim the one the webhook just created for them, so
  // gating it would strand someone who has already paid.
  '/billing/success',
  '/billing/cancel',
  '/explore',
  '/favorites',
  '/fishing',
  // Cold-traffic ad landing pages (/lp/1/{city}). Visitors arrive straight from
  // a Meta ad with no account — gating them to /login would bounce every one of
  // them before they saw the page they were sent to.
  '/lp',
  // The free-first-year invite link. It renders its own signed-out pitch and
  // sends people to /signup?next=/first, so bouncing them to a bare /login
  // would drop them out of the offer they were invited into.
  '/first',
  '/privacy',
  '/terms',
  '/contact',
  '/about',
  '/faq',
]

// Private routes that render their OWN pending state — a skeleton of the page
// they are about to be — instead of this file's full-screen spinner.
//
// `loading` starts true and can only settle in the browser, so for a private
// route the server always rendered the spinner: the initial HTML of
// /dashboard was three pulsing dots and the word "Loading...", and the real
// page could not begin to exist until ~750 KB of JavaScript had downloaded,
// parsed, and read the session. Nothing on these pages' skeletons is
// account-specific — headings, section frames, empty cards — so there is
// nothing to protect during that window, and showing the shape of the page
// beats showing a spinner.
//
// This is the pending window ONLY. Once `loading` settles, a signed-out
// visitor still gets the redirect and the "Redirecting..." spinner below,
// so account chrome is never shown to someone who isn't signed in.
const SELF_PENDING_PREFIXES = ['/dashboard']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

function rendersOwnPendingState(pathname: string): boolean {
  return SELF_PENDING_PREFIXES.some(p => pathname.startsWith(p))
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 bg-rc-bg-darkest flex items-center justify-center z-[9998]">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse [animation-delay:300ms]" />
        </div>
        <p className="text-sm text-rc-text-muted">{label}</p>
      </div>
    </div>
  )
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublicRoute = isPublicPath(pathname)

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace('/login')
    }
  }, [loading, user, isPublicRoute, router])

  // Public routes render their children immediately — BEFORE the `loading`
  // check. `loading` starts `true` and only settles once the browser has read
  // the Supabase session, which the server never can; gating on it here meant
  // every server render of every public page emitted this spinner instead of
  // the page. Crawlers (and the LCP measurement) saw ~50 characters of
  // "Loading..." and no headings, links, or copy on the marketing pages, the
  // /fishing directory, and every spot page.
  //
  // Public pages have nothing to protect, so there is nothing to wait for.
  // Auth-dependent chrome inside them (nav avatar, favourite stars) reads
  // `useAuth()` itself and can show its own pending state.
  if (isPublicRoute) {
    return <>{children}</>
  }

  // Private routes still wait: rendering account content before the session
  // resolves would flash it to a signed-out visitor. Except the ones that
  // render a skeleton of themselves instead — see SELF_PENDING_PREFIXES.
  if (loading) {
    if (rendersOwnPendingState(pathname)) return <>{children}</>
    return <FullScreenSpinner label="Loading..." />
  }

  if (!user) {
    // Redirecting to /login — show spinner
    return <FullScreenSpinner label="Redirecting..." />
  }

  return <>{children}</>
}
