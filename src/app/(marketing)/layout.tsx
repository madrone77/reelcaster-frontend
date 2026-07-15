import MarketingHeader from '@/app/components/marketing/marketing-header'
import MarketingFooter from '@/app/components/marketing/marketing-footer'

// (marketing) route group — public surface on the light editorial rc-*
// design system (src/styles/rc-tokens.css), matching the Explore/spot
// product UI. NO `AppShell` chrome.
export default function MarketingGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-rc-page text-rc-ink font-rc-sans antialiased flex flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
