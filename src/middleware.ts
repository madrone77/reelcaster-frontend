import { NextResponse, type NextRequest } from 'next/server'
import {
  ENTRY_COOKIE,
  ENTRY_MAX_AGE,
  PAID_COOKIE,
  PAID_MAX_AGE,
  buildEntry,
  buildPaid,
} from '@/lib/attribution'

// Legacy coming-soon wall, now scoped to nothing.
//
// This used to rewrite every non-allow-listed path to /coming-soon. As surfaces
// launched, the allow list grew to cover EVERY route the app actually has
// (`/`, /explore, /fishing, /pricing, /login, /signup, /auth, /billing,
// /profile, /alerts, /favorites, /dashboard, /catches, /log-catch,
// /notifications, and the marketing + legal pages). The wall therefore stopped
// gating anything real — its only surviving effect was to answer nonexistent
// URLs with a rewritten /coming-soon body at HTTP **200**.
//
// That is a soft 404: every typo, stale inbound link, and scraped bad URL told
// crawlers "this page exists and is fine" while showing them a holding page.
// Unmatched paths now fall through to Next's own routing, which pairs
// src/app/not-found.tsx with a real 404 status.
//
// To wall a future surface, add its prefix to WALLED_PREFIXES — an explicit
// opt-in list, so it can never silently swallow 404s again.
const WALLED_PREFIXES: string[] = []

/**
 * Is this request a person arriving at a page?
 *
 * Attribution is written here, on the edge, and the edge sees far more than
 * navigations: RSC payload fetches, router prefetches, and the odd
 * same-origin data request all pass through this matcher. Writing first touch
 * from any of those is worse than writing nothing, because rc_entry is
 * write-once: a link the visitor never followed, prefetched while they read
 * the page they are actually on, would claim the credit for ninety days and
 * lock the real landing page out.
 *
 * `sec-fetch-dest` answers this directly and is present on every browser we
 * care about. The accept-header fallback is for the few that are not, and for
 * local curl during development.
 */
function isPageView(req: NextRequest): boolean {
  if (req.headers.get('rsc')) return false
  if (req.headers.get('next-router-prefetch')) return false
  const purpose = req.headers.get('sec-purpose') ?? req.headers.get('purpose') ?? ''
  if (purpose.includes('prefetch')) return false
  const dest = req.headers.get('sec-fetch-dest')
  if (dest) return dest === 'document'
  return (req.headers.get('accept') ?? '').includes('text/html')
}

/**
 * Write first touch and paid touch from the request itself, before any of our
 * JavaScript has reached the browser.
 *
 * This used to be client-only, in a useEffect (src/lib/attribution.ts), and
 * the cost of that showed up in the numbers: half the trials we have taken
 * arrived with no campaign on them at all. Every reason for that is a browser
 * that never ran the effect with the ad's query string still in front of it —
 * storage blocked, an in-app webview, a bounce before hydration, a script
 * error somewhere else on the page. The request, by contrast, always carries
 * the URL the ad was pointed at and the referrer that sent it, and it carries
 * them on the very first byte.
 *
 * The client code stays as the backstop rather than being removed. It sees one
 * case this cannot: a visitor whose first page is a client-side navigation off
 * a link someone else's page prefetched.
 *
 * Both halves write the SAME cookie shape, so nothing downstream has to know
 * or care which one got there first. `NextResponse.cookies.set` URL-encodes
 * the value exactly as `document.cookie` does in src/lib/cookies.ts.
 */
function stampAttribution(req: NextRequest, res: NextResponse): NextResponse {
  if (!isPageView(req)) return res

  const { pathname, search } = req.nextUrl
  const options = {
    path: '/',
    sameSite: 'lax' as const,
    secure: req.nextUrl.protocol === 'https:',
  }

  // First touch is write-once, so an existing cookie always wins. Note this
  // reads the REQUEST jar: a cookie set on an earlier response is already
  // here, and a second write in the same visit is impossible.
  if (!req.cookies.has(ENTRY_COOKIE)) {
    const entry = buildEntry({
      pathname,
      search,
      referrer: req.headers.get('referer') ?? '',
      host: req.nextUrl.host,
    })
    if (entry) {
      res.cookies.set(ENTRY_COOKIE, JSON.stringify(entry), {
        ...options,
        maxAge: ENTRY_MAX_AGE,
      })
    }
  }

  // Paid touch overwrites, because the newest bought click is the one that
  // closed the sale. It writes only on a URL that carries a marker, so the
  // organic pages in between leave the record alone.
  const paid = buildPaid({ pathname, search })
  if (paid) {
    res.cookies.set(PAID_COOKIE, JSON.stringify(paid), {
      ...options,
      maxAge: PAID_MAX_AGE,
    })
  }

  return res
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fold mixed-case paths onto their lowercase form.
  //
  // Vercel compiles Next's DYNAMIC routes to case-insensitive regexes, so every
  // dynamic page answered 200 at any casing of its static segments —
  // /Fishing/BC/victoria-bc, /EXPLORE/spot/constance-bank-7615cc, and so on for
  // each of the 80 spot/city/province URLs. Static routes are matched off the
  // filesystem and stayed case-sensitive (/About 404s), so the site served two
  // different duplicate-URL policies depending on the route type.
  //
  // Each variant carried a self-referencing lowercase canonical, which is a
  // hint rather than a directive — a crawler still has to fetch every casing it
  // finds before it can honour one. A 308 settles it at the edge and gives the
  // odd-cased inbound link somewhere permanent to point.
  //
  // Safe to apply to every matched path: all route segments and all spot slugs
  // are lowercase, and the matcher below already skips anything with a dot in
  // it (the only uppercase assets are the /fonts/Open Sans Semibold/*.pbf glyph
  // ranges the Explore map fetches).
  if (pathname !== pathname.toLowerCase()) {
    const url = req.nextUrl.clone()
    url.pathname = pathname.toLowerCase()
    return NextResponse.redirect(url, 308)
  }

  // Paid traffic on a spot page renders the ad frame at ./ad — same payload,
  // same components, no navigation out and the trial ask inline. See
  // src/app/explore/spot/[slug]/ad-mode.ts.
  //
  // A rewrite rather than a branch inside the page, because reading
  // `searchParams` in /explore/spot/[slug]/page.tsx would opt that route out of
  // static generation for every visitor, organic ones included, and the
  // prerender is what puts its <title> and canonical in <head> rather than
  // streaming them into the body.
  //
  // The URL the visitor sees is unchanged, which is the point: the ad points at
  // the real spot page, and the frame is our business rather than something the
  // reader is made to look at in their address bar.
  if (
    pathname.startsWith('/explore/spot/') &&
    !pathname.endsWith('/ad') &&
    req.nextUrl.searchParams.has('ad')
  ) {
    const url = req.nextUrl.clone()
    url.pathname = `${pathname.replace(/\/$/, '')}/ad`
    // Stamped, not skipped: this IS the ad landing, and its query string is
    // the only place the click id will ever appear.
    return stampAttribution(req, NextResponse.rewrite(url))
  }

  const walled = WALLED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  if (!walled) return stampAttribution(req, NextResponse.next())

  const url = req.nextUrl.clone()
  url.pathname = '/coming-soon'
  return stampAttribution(req, NextResponse.rewrite(url))
}

export const config = {
  // Skip Next internals and static assets (any path containing a dot).
  matcher: ['/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
}
