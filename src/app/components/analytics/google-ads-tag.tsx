'use client'

import Script from 'next/script'
import { GOOGLE_ADS_ID } from '@/lib/google-ads'

/**
 * Configures the Google Ads tag on the shared gtag queue.
 *
 * Deliberately does NOT load gtag.js. The root layout already loads it for
 * GA4 via <GoogleAnalytics gaId="G-..." />, and gtag is built for exactly this
 * shape: one library load, one `config` call per destination id. A second
 * loader for the AW- id would fetch the same library twice for no gain.
 *
 * ⚠ That makes this a dependency on <GoogleAnalytics> staying in the layout.
 * If GA is ever removed, this component has to grow its own
 * `<Script src="https://www.googletagmanager.com/gtag/js?id=AW-..." />` or
 * conversions go quiet without an error anywhere.
 *
 * `afterInteractive`, matching <MetaPixel>, and for the same reason: this is a
 * plain inline stub with no document-splicing, but /billing/success bounces to
 * /explore about two seconds after the subscription goes active, and
 * `lazyOnload` waits for window.load plus an idle callback. That loses the race
 * on the one page where the conversion actually fires.
 */
export default function GoogleAdsTag() {
  return (
    <Script id="google-ads-tag" strategy="afterInteractive">
      {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
window.gtag('config', '${GOOGLE_ADS_ID}');`}
    </Script>
  )
}
