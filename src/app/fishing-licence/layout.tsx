import MarketingHeader from "@/app/components/marketing/marketing-header";
import MarketingFooter from "@/app/components/marketing/marketing-footer";

// /fishing-licence/* — public, indexable reference pages, one per jurisdiction
// (BC today; Washington/WDFW is the same shape when it lands). Marketing chrome
// on the light rc-* system, same as (marketing) and /fishing.
//
// Its own segment rather than a child of /fishing because the two answer
// different questions: /fishing/[province]/[city] is the spot directory, this
// is the paperwork. Nesting it would also have collided with the [city]
// dynamic route.
export default function FishingLicenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-theme="rc-light"
      className="min-h-dvh bg-rc-page text-rc-ink font-rc-sans antialiased flex flex-col"
    >
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
