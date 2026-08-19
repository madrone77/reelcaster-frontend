'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { META_PIXEL_ID, metaPixelSnippet, metaTrack } from '@/lib/meta-pixel'

/**
 * Loads the Meta pixel and keeps PageView honest across client navigations.
 *
 * `afterInteractive`, not a raw <script> in <head>. The base snippet ends in
 * `s.parentNode.insertBefore(t, s)` — it splices a script tag in ahead of the
 * first one in the document. Done during head parse that is the exact shape
 * that broke hydration with AdSense: React's walk finds a foreign script where
 * it expects ours and reports a mismatch it will not patch up, which on
 * prerendered spot pages means a blank page. After hydration there is no race.
 *
 * Not `lazyOnload` (which AdSense uses for its own reasons): that waits for
 * window.load plus an idle callback, and /billing/success redirects to /explore
 * two seconds after the subscription goes active. The queueing stub makes early
 * calls safe, but only once the stub itself exists.
 *
 * Renders nothing at all when NEXT_PUBLIC_META_PIXEL_ID is unset, so an
 * unconfigured environment ships no tag and no network call.
 */
export default function MetaPixel() {
  const pathname = usePathname()
  // The snippet fires the first PageView itself. Firing another one here on
  // mount would double-count every landing.
  const seenFirstPath = useRef(false)

  useEffect(() => {
    if (!META_PIXEL_ID) return
    if (!seenFirstPath.current) {
      seenFirstPath.current = true
      return
    }
    metaTrack('PageView')
  }, [pathname])

  if (!META_PIXEL_ID) return null

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: metaPixelSnippet(META_PIXEL_ID) }}
    />
  )
}
