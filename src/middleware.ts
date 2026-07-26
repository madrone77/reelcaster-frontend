import { NextResponse, type NextRequest } from 'next/server'

// Coming-soon wall. Every public-facing route is rewritten to /coming-soon.
// These prefixes stay reachable so the team can still operate the system:
// the coming-soon page itself, the API, and the auth/login flow.
// `/explore` is publicly live (soft-launched) while the rest stays walled.
// `/log-catch` + `/notifications` ship with the explore soft-launch.
// `/` (exact match only — `startsWith('//')` can't hit a real path) is the
// public landing page. Info/legal pages are public (linked from the footer).
// `/billing` (Stripe checkout success/cancel + portal return), `/profile`,
// and `/alerts` are account surfaces the paid funnel + nav depend on.
// `/fishing` is the public province/city SEO directory.
// `/dashboard` is the logged-in landing (post-login redirect target).
const ALLOW_PREFIXES = ['/', '/coming-soon', '/api', '/auth', '/login', '/signup', '/explore', '/fishing', '/pricing', '/log-catch', '/catches', '/notifications', '/privacy', '/terms', '/contact', '/about', '/faq', '/billing', '/profile', '/alerts', '/favorites', '/dashboard']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const allowed = ALLOW_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  if (allowed) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/coming-soon'
  return NextResponse.rewrite(url)
}

export const config = {
  // Skip Next internals and static assets (any path containing a dot).
  matcher: ['/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
}
