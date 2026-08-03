'use client'

import { X } from 'lucide-react'
import UnlockWithProCard from './unlock-with-pro-card'

interface Props {
  open: boolean
  onClose: () => void
  /** Feature id used for analytics + the signed-out ?feature= query on /pricing. */
  feature: string
  headline?: string
  bullets?: string[]
  /**
   * Optional override that turns the CTA back into a plain link. Unset means
   * the CTA starts Stripe checkout.
   */
  ctaHref?: string
}

/**
 * Modal that wraps `<UnlockWithProCard>` for places where an action triggered
 * an `upgrade_required` response (e.g. trying to add a 2nd alert as a free
 * user). Caller controls open state.
 */
export default function UpgradeRequiredModal({
  open,
  onClose,
  feature,
  headline,
  bullets,
  ctaHref,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      data-testid="upgrade-required-modal"
      data-feature={feature}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 p-1.5 rounded-full bg-white border border-rc-rule text-rc-ink-mute hover:text-rc-ink"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {/* No ctaHref by default: the card's CTA opens Stripe directly rather
            than routing through /pricing for a second click. */}
        <UnlockWithProCard
          headline={headline}
          bullets={bullets}
          feature={feature}
          ctaHref={ctaHref}
          theme="light"
        />
      </div>
    </div>
  )
}
