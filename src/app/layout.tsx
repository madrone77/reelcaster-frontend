import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { MixpanelProvider } from '@/contexts/mixpanel-context'
import { UnitPreferencesProvider } from '@/contexts/unit-preferences-context'
import AuthGate from '@/app/components/auth/auth-gate'
import MobileBottomNav from '@/app/components/mobile-bottom-nav'
import WelcomeGate from '@/app/components/welcome/welcome-gate'
import AttributionCapture from '@/app/components/attribution/attribution-capture'
import { GoogleAnalytics } from '@next/third-parties/google'
import { ADSENSE_CLIENT } from '@/lib/adsense'
import AdSenseLoader from '@/app/components/ads/adsense-loader'
import MetaPixel from '@/app/components/analytics/meta-pixel'
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
          {/* Renders null. Outside AuthGate so first-touch capture runs on the
              public marketing and city pages, which is where acquisition
              actually lands. */}
          <AttributionCapture />
          <MixpanelProvider>
            <UnitPreferencesProvider>
              <AuthGate>
                {children}
                <MobileBottomNav />
                {/* Mounted at the root because there is no single post-login
                    landing page: a new account can arrive on any route. Picks
                    between the three-step new-user tour and the Pro setup
                    wizard, and renders null for everyone owed neither. */}
                <WelcomeGate />
              </AuthGate>
            </UnitPreferencesProvider>
          </MixpanelProvider>
        </AuthProvider>
        {/* AdSense loader — mounted only on the routes that carry an ad unit.
            See src/app/components/ads/adsense-loader.tsx for why, and for the
            hydration and Auto-ads constraints it still has to honour. */}
        <AdSenseLoader />
        <GoogleAnalytics gaId="G-HLHG768MWJ" />
        {/* Meta pixel. Renders null unless NEXT_PUBLIC_META_PIXEL_ID is set, so
            an unconfigured environment ships no tag at all. The conversion it
            exists for is fired separately on /billing/success. */}
        <MetaPixel />
      </body>
    </html>
  )
}
