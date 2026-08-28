'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { PLAUSIBLE_SRC, plausibleReports } from '@/lib/plausible'

/**
 * Loads the Plausible tracker.
 *
 * `afterInteractive`, matching <MetaPixel> and <GoogleAdsTag>, and for the
 * same reason: a third-party script parsed inside <head> is what broke
 * hydration with AdSense, and a blank spot page costs more than a pageview
 * logged a beat late.
 *
 * No per-route effect. The tracker patches `history.pushState` and listens for
 * `popstate` itself, so App Router navigations are counted without help. An
 * effect firing on `usePathname` would double every client-side page change.
 *
 * The two script tags are order-independent by design. Whichever runs first
 * wins: the inline stub queues calls and records the options for the loader to
 * pick up, and the loader installs the real `init` for the stub to call. The
 * tracker itself refuses a second init, so neither order double-counts.
 */
export default function Plausible() {
  // Read on the client, after mount, because the host is not knowable during a
  // static prerender: the same build output is served on the preview URL and on
  // www.
  const [reports, setReports] = useState(false)
  useEffect(() => {
    setReports(plausibleReports(window.location.hostname))
  }, [])

  if (!reports) return null

  return (
    <>
      <Script src={PLAUSIBLE_SRC} strategy="afterInteractive" />
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init()`}
      </Script>
    </>
  )
}
