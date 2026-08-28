import FishingHeader from "./fishing-header";
import MarketingFooter from "@/app/components/marketing/marketing-footer";

// /fishing/* — public, indexable directory pages (province index + city
// explorer). Marketing chrome on the light rc-* system, same as (marketing);
// kept as its own group because the city page manages its own full-height
// map split under the sticky header.
export default function FishingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-theme="rc-light"
      className="min-h-dvh bg-rc-page text-rc-ink font-rc-sans antialiased flex flex-col"
    >
      <FishingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
