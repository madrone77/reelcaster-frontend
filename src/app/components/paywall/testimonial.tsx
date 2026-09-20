"use client";

import { Star } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTestimonialHidden } from "@/app/components/split-test/use-testimonial-none";
import {
  PRO_TESTIMONIAL_LABEL,
  PROOF,
  modalControlQuoteFor,
  type ProofQuote,
} from "@/app/lp/_shared/lp-content";
import { readReaderRegion } from "@/lib/reader-region";

/**
 * The customer quote, with its rating.
 *
 * The words are `PROOF.quote`, imported rather than copied so no surface can
 * drift from the one place that records the quote is real, permissioned and
 * verbatim, and so it cannot be edited for length here. `PROOF.showProof` is
 * honoured too: if the band is ever switched off it goes off everywhere.
 *
 * The rating is `PROOF.quote.rating`, which the customer gave, and is read
 * rather than hardcoded so the stars cannot outlive it. Drawing five filled
 * stars in markup would be a second copy of a claim about a real person, free
 * to disagree with the record the moment either changed.
 *
 * This lived inside the ad-framed spot page's CTA until the plan matrix wanted
 * it too. It moved here rather than being reproduced there for exactly the
 * reason the words themselves are imported: a claim about a named customer
 * should exist once, so switching the band off or correcting the attribution
 * reaches every surface at once.
 *
 * Washington readers get Nick's five-star form quote instead
 * (`modalControlQuoteFor`), picked from the region cookie middleware writes.
 * Every caller is a modal opened after hydration, so the cookie is read at
 * mount and there is no swap to see.
 *
 * Two tests have run on this surface and both kept this single quote:
 * testimonial_swipe_v1 (a swipe row of both quotes, no stars, 2026-09-17) and
 * testimonial_byline_v1 (three review cards with initials byline and tile
 * stars, 2026-09-18). testimonial_none_v1 now asks whether the quote earns
 * its place at all: arm a is this figure, arm b renders nothing here. See
 * use-testimonial-none.ts. The exposure fires for both arms because the
 * hook runs before the arm-b early return, and the rating is read from the
 * record, never drawn by hand.
 */
export function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < filled ? "fill-rc-badge text-rc-badge" : "fill-none text-rc-rule"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}
/** Read once per mount. Nothing to subscribe to: modals mount fresh on each open. */
const noSubscribe = () => () => {};

/** The one quote, in the frame every caller used to pass in. */
const SINGLE_CLASS = "rounded-xl border border-rc-rule-soft bg-rc-surface p-4";

function Quote({ quote }: { quote: ProofQuote }) {
  const showStars = quote.rating != null;
  return (
    <>
      {quote.pro && (
        <div className="mb-2 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-brand">
          {PRO_TESTIMONIAL_LABEL}
        </div>
      )}
      {showStars && <Stars rating={quote.rating ?? 0} />}
      <blockquote
        className={
          showStars
            ? "rc-body mt-2 text-[13px] leading-relaxed text-rc-ink-soft"
            : "rc-body text-[13px] leading-relaxed text-rc-ink-soft"
        }
      >
        {quote.text}
      </blockquote>
      <figcaption className="mt-2 font-rc-mono text-[11px] text-rc-ink-mute">
        {quote.attr}
      </figcaption>
    </>
  );
}

/**
 * One figure, the reader's region's quote; or nothing, for a reader in arm b
 * of testimonial_none_v1. `className` is the block's placement (its top
 * margin); the card styles itself.
 */
export default function Testimonial({ className }: { className?: string }) {
  const region = useSyncExternalStore(noSubscribe, readReaderRegion, () => null);
  const hidden = useTestimonialHidden();
  if (!PROOF.showProof || hidden) return null;
  return (
    <figure className={`${className ?? "mt-5"} ${SINGLE_CLASS}`} data-testimonial-arm="a">
      <Quote quote={modalControlQuoteFor(region)} />
    </figure>
  );
}
