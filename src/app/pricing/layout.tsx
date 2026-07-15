import MarketingHeader from '@/app/components/marketing/marketing-header'
import MarketingFooter from '@/app/components/marketing/marketing-footer'

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-rc-page text-rc-ink font-rc-sans antialiased flex flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
