import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { MixpanelProvider } from '@/contexts/mixpanel-context'
import { UnitPreferencesProvider } from '@/contexts/unit-preferences-context'
import AuthGate from '@/app/components/auth/auth-gate'
import MobileBottomNav from '@/app/components/mobile-bottom-nav'
import { GoogleAnalytics } from '@next/third-parties/google'

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
  title: 'BC Fishing Forecast - British Columbia Fishing Conditions',
  description:
    'Get accurate fishing forecasts for Victoria, Sidney, Tofino, Vancouver, Squamish, Sooke, and Port Renfrew. Find the best fishing spots and conditions.',
  keywords:
    'fishing forecast, BC fishing, British Columbia, Victoria, Tofino, Vancouver, Sooke, fishing conditions, fishing spots',
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
        <AuthProvider>
          <MixpanelProvider>
            <UnitPreferencesProvider>
              <AuthGate>
                {children}
                <MobileBottomNav />
              </AuthGate>
            </UnitPreferencesProvider>
          </MixpanelProvider>
        </AuthProvider>
        <GoogleAnalytics gaId="G-HLHG768MWJ" />
      </body>
    </html>
  )
}
