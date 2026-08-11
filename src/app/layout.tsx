import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { MixpanelProvider } from '@/contexts/mixpanel-context'
import { UnitPreferencesProvider } from '@/contexts/unit-preferences-context'
import AuthGate from '@/app/components/auth/auth-gate'
import MobileBottomNav from '@/app/components/mobile-bottom-nav'
import ProWelcomeModal from '@/app/components/pro/pro-welcome-modal'
import Script from 'next/script'
import { GoogleAnalytics } from '@next/third-parties/google'
import { ADSENSE_CLIENT } from '@/lib/adsense'
import { ORGANIZATION_JSONLD, SITE_NAME, SITE_URL } from '@/lib/site'
import { clientDiagSnippet } from '@/lib/client-diag'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// rc light design system fonts (font-rc-sans / font-rc-mono). Loaded at the
// root so marketing chrome + landing render correctly everywhere; the
// explore layout keeps its own (identical) loaders.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  // Resolves every relative `openGraph.images` / `alternates.canonical` in the
  // tree against the canonical www host. Without it Next emits relative OG
  // image paths, which no scraper can fetch.
  metadataBase: new URL(SITE_URL),
  title: {
    // `default` is what a page inherits when it declares no title of its own —
    // it must still read as a real page title, since it leaks onto any route
    // whose own metadata fails to resolve.
    default: 'BC Fishing Forecast & Tide Conditions | ReelCaster',
    // Pages set a bare title ('Pricing'); the brand suffix is appended here so
    // it can never drift or be forgotten.
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Tides, weather, water conditions, and regulations combined into one fishing score for the BC and Washington coasts. Find the best spot and the best window before you go.',
  applicationName: SITE_NAME,
  // `keywords` has been ignored by Google since 2009 and shipped on every page.
  openGraph: {
    siteName: SITE_NAME,
    locale: 'en_CA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  // AdSense site verification. This is the static half of the integration and
  // the half Google actually crawls for: a meta tag is in the prerendered HTML
  // of every route, so ownership verifies whether or not the crawler executes
  // the loader — which matters because /explore is noindex and the loader is
  // now injected after hydration rather than served in <head>.
  other: {
    'google-adsense-account': ADSENSE_CLIENT,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* No-op unless the URL carries ?diag=1. Registered during head parse
            so the listener is in place before hydration can throw. */}
        <script
          dangerouslySetInnerHTML={{
            __html: clientDiagSnippet(
              // A CLI deploy from a detached worktree carries no git metadata,
              // so VERCEL_GIT_COMMIT_SHA is empty and every report claimed to
              // be from build "local" — the exact ambiguity this exists to
              // remove. BUILD_TIMESTAMP is inlined by next.config at compile
              // time, so it is always present and always distinct per build.
              process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
                process.env.BUILD_TIMESTAMP ||
                'local',
            ),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plexMono.variable} antialiased`}
      >
        {/* Publisher identity, emitted once site-wide. Page-level graphs
            (Product, Place, BreadcrumbList) reference it by @id. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
        />
        <AuthProvider>
          <MixpanelProvider>
            <UnitPreferencesProvider>
              <AuthGate>
                {children}
                <MobileBottomNav />
                {/* Mounted at the root because there is no single post-login
                    landing page — a new Pro user can arrive on any route.
                    Renders null for everyone who isn't owed the welcome. */}
                <ProWelcomeModal />
              </AuthGate>
            </UnitPreferencesProvider>
          </MixpanelProvider>
        </AuthProvider>
        {/* AdSense loader, site-wide so any page can serve — but the only
            places an ad unit is actually mounted are /explore and the spot
            page, and only for anonymous and free viewers (see <AdSlot>).
            ⚠ This is also why Auto ads must stay OFF in the console: Auto ads
            key off this loader alone and would paste ads onto the marketing
            pages, the billing pages, and every Pro account.

            `afterInteractive` is load-bearing, not a default. As a plain
            <script> in <head> this broke hydration: the loader prepends
            `show_ads_impl.js` into <head> before React hydrates, React's walk
            found Google's script where it expected our own, and reported a
            mismatch it explicitly would not patch up — on prerendered spot
            pages, the same failure shape that has blanked them before.
            Injecting after hydration removes the race entirely; ownership
            verification does not depend on it, and rides the
            `google-adsense-account` meta tag above instead. */}
        <Script
          id="adsbygoogle-loader"
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        <GoogleAnalytics gaId="G-HLHG768MWJ" />
      </body>
    </html>
  )
}
