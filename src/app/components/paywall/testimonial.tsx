"use client";

import { Star } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  PRO_TESTIMONIALS_ROW_LABEL,
  PROOF,
  modalTestimonialsFor,
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
 * reaches every surface at once. `ad-trial-cta.tsx` renders this same
 * component now.
 *
 * Washington readers get Nick's quote instead (`proofQuoteFor`), picked from
 * the region cookie middleware writes. Every caller is a modal opened after
 * hydration, so the cookie is read at mount and there is no swap to see.
 *
 * testimonial_swipe_v1 (2026-09-17) tried a swipe row of both quotes with no
 * stars against this single quote and concluded for the single quote. On
 * 2026-09-18 Casey asked for three five-star cards in a horizontal scroller
 * instead, in the same place: Bob, Nick's form quote and Kevin's, every one
 * with the stars its author gave. `modalTestimonialsFor` orders them by
 * region, the Washington angler first for Washington readers. Later that day
 * the "ReelCaster Pro Testimonial" label came out of the cards and sits once
 * above the row as its heading.
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

/** One card. Callers used to style the single figure; now the row is theirs
 *  to place (its margin) and every card wears this. */
const CARD_CLASS =
  "w-[84%] shrink-0 snap-start rounded-xl border border-rc-rule-soft bg-rc-surface p-4 sm:w-[72%]";

function Quote({ quote }: { quote: ProofQuote }) {
  const showStars = quote.rating != null;
  return (
    <>
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
 * A heading, then three cards in a row the reader scrolls sideways, snapping
 * card to card. The next card peeks in from the right edge, which is the
 * whole cue that there is more; no dots, no arrows. `className` is the
 * block's placement (its top margin); the cards style themselves.
 */
export default function Testimonial({ className }: { className?: string }) {
  const region = useSyncExternalStore(noSubscribe, readReaderRegion, () => null);
  if (!PROOF.showProof) return null;
  const quotes = modalTestimonialsFor(region);
  return (
    <section className={className ?? "mt-5"} aria-label={PRO_TESTIMONIALS_ROW_LABEL}>
      <div className="mb-2 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-brand">
        {PRO_TESTIMONIALS_ROW_LABEL}
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {quotes.map((q) => (
          <figure key={q.attr} className={CARD_CLASS}>
            <Quote quote={q} />
          </figure>
        ))}
      </div>
    </section>
  );
}
