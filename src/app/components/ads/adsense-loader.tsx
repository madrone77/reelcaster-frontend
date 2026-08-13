'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { ADSENSE_CLIENT } from '@/lib/adsense';

/**
 * The AdSense loader, mounted only on routes that can actually serve an ad.
 *
 * It used to sit unconditionally in the root layout, "site-wide so any page can
 * serve". But no other page ever does: the only `<AdSlot>`s in the app are in
 * the Explore rail, the Explore mobile sheet, and the spot page — all under
 * /explore. Everywhere else the loader was pure cost, and it is not small:
 * `adsbygoogle.js` plus the `show_ads_impl.js` it pulls in is ~250 KB, and on a
 * 4x-throttled CPU it was the single largest main-thread block on the
 * dashboard — a 645 ms task, more than half of that page's total blocking time,
 * on a route with no ad on it, for a Pro account that can never see one.
 *
 * Route-gated rather than tier-gated on purpose: the tier lives behind
 * `useSubscription`, and making the loader wait on it would delay real ads for
 * the free and anonymous viewers who are the entire point. `<AdSlot>` still
 * owns the tier gate, so a Pro viewer on /explore renders no unit; they simply
 * also load the script, as before.
 *
 * ⚠ Auto ads must stay OFF in the console. They key off this loader alone, and
 * would paste ads onto any route where it is present.
 *
 * Injecting after hydration is load-bearing, not a default. As a plain <script>
 * in <head> this broke hydration: the loader prepends `show_ads_impl.js` into
 * <head> before React hydrates, React's walk found Google's script where it
 * expected our own, and reported a mismatch it explicitly would not patch up —
 * on prerendered spot pages, the same failure shape that has blanked them
 * before. Injecting after hydration removes the race entirely. Ownership
 * verification does not depend on this script; it rides the
 * `google-adsense-account` meta tag in the layout.
 *
 * `lazyOnload` rather than `afterInteractive`, because "after hydration" and
 * "out of the way" are not the same thing. `afterInteractive` injects as soon
 * as hydration finishes — the exact moment the Explore shell's effects fire the
 * 14-day forecast request — so ~250 KB of Google script was parsing on the main
 * thread while the strip was trying to arrive and render. Measured on prod at
 * 10 Mbps / 4x CPU: the strip painted at 5.16 s with the loader here, 4.26 s
 * with it blocked outright. `lazyOnload` waits for `window.load` and then an
 * idle callback (see next/dist/client/script.js), so the ad request queues
 * behind first paint instead of racing it. The cost is a later first
 * impression, not a lost one.
 */
export default function AdSenseLoader() {
  const pathname = usePathname();
  if (!pathname?.startsWith('/explore')) return null;

  return (
    <Script
      id="adsbygoogle-loader"
      async
      strategy="lazyOnload"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}
