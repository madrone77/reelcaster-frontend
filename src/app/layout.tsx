import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { MixpanelProvider } from '@/contexts/mixpanel-context'
import { UnitPreferencesProvider } from '@/contexts/unit-preferences-context'
import AuthGate from '@/app/components/auth/auth-gate'
import MobileBottomNav from '@/app/components/mobile-bottom-nav'
import ProWelcomeModal from '@/app/components/pro/pro-welcome-modal'
import { GoogleAnalytics } from '@next/third-parties/google'
import { ORGANIZATION_JSONLD, SITE_NAME, SITE_URL } from '@/lib/site'

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
    'Tides, weather, water conditions, and regulations combined into one fishing score for the BC, Washington, and Oregon coasts. Find the best spot and the best window before you go.',
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
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
        <GoogleAnalytics gaId="G-HLHG768MWJ" />
      </body>
    </html>
  )
}
