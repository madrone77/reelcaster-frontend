import FishingHeader from "./fishing-header";
import FishingFooter from "./fishing-footer";
import { FishingPlaceProvider } from "./fishing-place";

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
      {/* The bar's trial CTA names the city the page is about, and only a
          page knows which city that is. See ./fishing-place. */}
      <FishingPlaceProvider>
        <FishingHeader />
        <main className="flex-1">{children}</main>
      </FishingPlaceProvider>
      <FishingFooter />
    </div>
  );
}
