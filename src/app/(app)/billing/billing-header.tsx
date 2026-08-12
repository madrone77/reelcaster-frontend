'use client'

import { usePathname } from 'next/navigation'
import MarketingHeader from '@/app/components/marketing/marketing-header'

/**
 * The billing chrome's header: the blue bar with the white mark, differing by
 * route in what it offers.
 *
 * /billing/cancel keeps the "Start free trial" CTA — re-pitching an abandoned
 * checkout is that page's entire job. /billing/success offers nothing at all:
 * the visitor has already paid, and a signed-out buyer sits on that page for
 * the whole claim window, so the bar would only be selling them what they just
 * bought or a sign-in the magic link is about to hand them.
 *
 * The split lives here rather than in the layout because a server layout can't
 * read the pathname, and rather than inside MarketingHeader because a shared
 * component shouldn't carry a list of routes it behaves differently on.
 */
export default function BillingHeader() {
  const pathname = usePathname()
  const onSuccess = pathname.startsWith('/billing/success')

  return (
    <MarketingHeader
      variant="brand"
      signedOutActions={onSuccess ? 'none' : 'cta'}
    />
  )
}
