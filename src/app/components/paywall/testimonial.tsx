"use client";

import { Star } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Byline, TileStars } from "@/app/components/testimonial-parts";
import { useTestimonialByline } from "@/app/components/split-test/use-testimonial-byline";
import {
  PRO_TESTIMONIAL_LABEL,
  PRO_TESTIMONIALS_ROW_LABEL,
  PROOF,
  modalControlQuoteFor,
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
 * Washington readers get Nick's quote instead (`modalControlQuoteFor`), picked from
 * the region cookie middleware writes. Every caller is a modal opened after
 * hydration, so the cookie is read at mount and there is no swap to see.
 *
 * testimonial_swipe_v1 (2026-09-17) tried a swipe row of both quotes with no
 * stars against this single quote and concluded for the single quote. On
 * 2026-09-18 Casey asked for three five-star cards in a horizontal scroller,
 * then for the cards to open with the angler (initials circle, name, place)
 * and Trustpilot-style tile stars, the shape the row under the chart wears,
 * and then pulled back: "go back to 1 testimonial with the yellow 5 stars as
 * the base... we are testing too much too quick". So testimonial_byline_v1
 * puts the whole change on one arm. Arm a is the single quote as it was
 * after the swipe test concluded: the Pro label, five small gold stars, the
 * words, the name in mono, with one change Casey asked for: a Washington
 * reader gets Nick's five-star form quote, not his unrated Facebook comment,
 * so the control wears gold stars everywhere (`modalControlQuoteFor`). Arm b
 * is the row of three review cards
 * (`testimonial-parts.tsx`, `modalTestimonialsFor` orders them by region,
 * the Washington angler first for Washington readers). See
 * use-testimonial-byline.ts. Either way the rating is read from the
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

/** Arm a: the one quote, in the frame every caller used to pass in. */
const SINGLE_CLASS = "rounded-xl border border-rc-rule-soft bg-rc-surface p-4";

/** Arm b: one card of the row. */
const CARD_CLASS =
  "w-[84%] shrink-0 snap-start rounded-xl border border-rc-rule-soft bg-rc-surface p-4 sm:w-[72%]";

/** Arm a's card, unchanged from the single-quote days. */
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

/** Arm b: the review-card shape, angler first. */
function BylineQuote({ quote }: { quote: ProofQuote }) {
  return (
    <>
      <figcaption>
        <Byline attr={quote.attr} />
      </figcaption>
      {quote.rating != null && <TileStars rating={quote.rating} className="mt-3" />}
      <blockquote className="rc-body mt-3 text-[13px] leading-relaxed text-rc-ink-soft">
        {quote.text}
      </blockquote>
    </>
  );
}

/**
 * Arm a: one figure, the reader's region's quote. Arm b: a heading, then
 * three review cards in a row the reader scrolls sideways, snapping card to
 * card, the next peeking in from the right edge as the cue that there is
 * more. `className` is the block's placement (its top margin); the cards
 * style themselves.
 */
export default function Testimonial({ className }: { className?: string }) {
  const region = useSyncExternalStore(noSubscribe, readReaderRegion, () => null);
  const byline = useTestimonialByline();
  if (!PROOF.showProof) return null;
  const margin = className ?? "mt-5";
  if (!byline) {
    return (
      <figure className={`${margin} ${SINGLE_CLASS}`} data-testimonial-arm="a">
        <Quote quote={modalControlQuoteFor(region)} />
      </figure>
    );
  }
  const quotes = modalTestimonialsFor(region);
  return (
    <section className={margin} aria-label={PRO_TESTIMONIALS_ROW_LABEL} data-testimonial-arm="b">
      <div className="mb-2 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-brand">
        {PRO_TESTIMONIALS_ROW_LABEL}
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {quotes.map((q) => (
          <figure key={q.attr} className={CARD_CLASS}>
            <BylineQuote quote={q} />
          </figure>
        ))}
      </div>
    </section>
  );
}
