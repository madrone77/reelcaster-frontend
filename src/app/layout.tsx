import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { MixpanelProvider } from '@/contexts/mixpanel-context'
import { UnitPreferencesProvider } from '@/contexts/unit-preferences-context'
// Fish On button hidden for now
// import FishOnButtonWrapper from '@/app/components/catch-log/fish-on-button-wrapper'
import AuthGate from '@/app/components/auth/auth-gate'
import { GoogleAnalytics } from '@next/third-parties/google'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <MixpanelProvider>
            <UnitPreferencesProvider>
              <AuthGate>
                {children}
              </AuthGate>
              {/* <FishOnButtonWrapper /> */}
            </UnitPreferencesProvider>
          </MixpanelProvider>
        </AuthProvider>
        <GoogleAnalytics gaId="G-HLHG768MWJ" />
      </body>
    </html>
  )
}
