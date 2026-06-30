import { NextResponse, type NextRequest } from 'next/server'

// Coming-soon wall. Every public-facing route is rewritten to /coming-soon.
// These prefixes stay reachable so the team can still operate the system:
// the coming-soon page itself, the API, admin, and the auth/login flow.
// `/explore` is publicly live (soft-launched) while the rest stays walled.
// `/log-catch` + `/notifications` ship with the explore soft-launch.
const ALLOW_PREFIXES = ['/coming-soon', '/api', '/admin', '/auth', '/login', '/signup', '/explore', '/pricing', '/log-catch', '/notifications']

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
