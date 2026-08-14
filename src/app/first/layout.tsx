import MarketingHeader from '@/app/components/marketing/marketing-header'
import MarketingFooter from '@/app/components/marketing/marketing-footer'

export default function FirstYearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-rc-page text-rc-ink font-rc-sans antialiased flex flex-col">
      {/*
        No "Start free trial" in the bar. This page's whole offer is a free
        year with no card, and the marketing CTA next to it sells the same Pro
        for $33 — an invited angler clicking the wrong one would pay for what
        they were just given. The page body carries its own sign-in link.
      */}
      <MarketingHeader signedOutActions="none" />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
