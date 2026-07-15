import MarketingHeader from '@/app/components/marketing/marketing-header'
import MarketingFooter from '@/app/components/marketing/marketing-footer'

// (marketing) route group — public surface, on the same light `rc-*` design
// system as the product (rc-panel/rc-ink/rc-brand) so it previews the actual
// brand the user gets after sign-up, not a separate dark template. NO
// `AppShell` chrome.
export default function MarketingGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-rc-panel text-rc-ink antialiased flex flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
