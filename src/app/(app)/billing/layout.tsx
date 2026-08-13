import type { Metadata } from 'next'
import BillingHeader from './billing-header'
import MarketingFooter from '@/app/components/marketing/marketing-footer'

// Both pages are client components and so can't export metadata themselves;
// without this they inherited the marketing default ("BC Fishing Forecast &
// Tide Conditions"). Checkout return pages have nothing to offer search, same
// reasoning as /plans/checkout.
export const metadata: Metadata = {
  title: 'Checkout | ReelCaster Pro',
  robots: { index: false, follow: true },
}

/**
 * The two checkout return surfaces (/billing/success, /billing/cancel) wear the
 * marketing chrome rather than AppShell, for two reasons:
 *
 * 1. They're the far side of /plans/checkout, which is a marketing-layout page.
 *    Bouncing a buyer from a light editorial checkout into the dark app shell
 *    and back out to /explore reads as three different products.
 * 2. Pay-first purchases land here SIGNED OUT — the account is provisioned from
 *    the email Stripe billed and claimed on this page. AppShell's sidebar,
 *    location panel, and tab bar are all signed-in affordances, so wrapping an
 *    anonymous buyer in them offers navigation that isn't theirs yet.
 *
 * Body and footer mirror src/app/plans/layout.tsx — the funnel is one surface.
 * The bar itself is the blue brand variant; see ./billing-header.
 */
export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-rc-page text-rc-ink font-rc-sans antialiased flex flex-col">
      <BillingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
