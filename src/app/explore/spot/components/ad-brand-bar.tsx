import Link from "next/link";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";

/**
 * The chrome an ad-framed spot page wears instead of the app's.
 *
 * ExploreTopBar and MarketingFooter are navigation: map, pricing, login,
 * sitemap. All of it is useful to someone already in the product and all of it
 * is an exit for someone who arrived on a paid click, thirty seconds in,
 * looking at the one spot the ad named. So the bar keeps the brand and nothing
 * else, and the footer keeps only what has to be reachable.
 *
 * The mark is not a link. A logo that goes to the homepage is the single most
 * pressed way out of a landing page, and the homepage sells the same thing
 * less specifically than the page it would be leaving.
 */

export function AdBrandBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-16 flex items-center border-b border-rc-rule bg-rc-panel/95 backdrop-blur">
      {/* The app's one content gridline, same as the body below. The bar used
          to be padded off the viewport edge, so on a wide window the mark sat
          far to the left of the spot name it belongs to and the two read as
          separate pages stacked on each other. */}
      <div className={`w-full ${PAGE_MEASURE} flex items-center gap-2`}>
        <span className="rc-title-lg text-lg tracking-tight text-rc-ink">
          ReelCaster
        </span>
        <span className="hidden sm:inline font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute">
          · fishing forecast
        </span>
      </div>
    </header>
  );
}

/**
 * Legal only. Terms and privacy have to be reachable from any page that takes
 * a card, and the trial disclosure sits with the form rather than down here,
 * where "clear and conspicuous" would not describe it.
 */
export function AdFooter() {
  return (
    <footer className="border-t border-rc-rule mt-12">
      <div className={`${PAGE_MEASURE} py-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-rc-mono text-[11px] text-rc-ink-mute`}>
        <span>© {new Date().getFullYear()} ReelCaster</span>
        <Link href="/terms" className="hover:text-rc-ink-soft">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-rc-ink-soft">
          Privacy
        </Link>
        <Link href="/support" className="hover:text-rc-ink-soft">
          Support
        </Link>
      </div>
    </footer>
  );
}

export default AdBrandBar;
