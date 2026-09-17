"use client";

import { Star } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  PRO_TESTIMONIAL_LABEL,
  PROOF,
  proofQuoteFor,
  proofQuotesFor,
  type ProofQuote,
} from "@/app/lp/_shared/lp-content";
import { useTestimonialSwipe } from "@/app/components/split-test/use-testimonial-swipe";
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
 * testimonial_swipe_v1 arm b swaps the single quote for a swipe row of every
 * quote, with no stars. See use-testimonial-swipe.ts.
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

const FIGURE_CLASS = "mt-5 rounded border border-rc-rule bg-rc-panel/70 p-4";

function Quote({ quote, stars }: { quote: ProofQuote; stars: boolean }) {
  const showStars = stars && quote.rating != null;
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
 * Arm b of testimonial_swipe_v1: every quote in a native scroll-snap row, no
 * stars. Each card is a little narrower than the row so the next one peeks in,
 * which is what says "swipe" without a word of copy. The dots follow the
 * scroll and scroll to their card when pressed.
 */
function QuoteSwipe({ quotes, className }: { quotes: ProofQuote[]; className: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const row = rowRef.current;
    const first = row?.firstElementChild as HTMLElement | null;
    if (!row || !first) return;
    // The last card can't snap to the left edge, so the end of the row is it.
    const atEnd = row.scrollLeft >= row.scrollWidth - row.clientWidth - 4;
    setActive(atEnd ? quotes.length - 1 : Math.round(row.scrollLeft / (first.offsetWidth + 8)));
  };

  const goTo = (i: number) => {
    const card = rowRef.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  return (
    <div data-testimonial-arm="b">
      <div
        ref={rowRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="What anglers say"
      >
        {quotes.map((q) => (
          <figure
            key={q.attr}
            className={`${className} flex w-[88%] shrink-0 snap-start flex-col [&>blockquote]:flex-1`}
          >
            <Quote quote={q} stars={false} />
          </figure>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {quotes.map((q, i) => (
          <button
            key={q.attr}
            type="button"
            aria-label={`Quote ${i + 1} of ${quotes.length}`}
            aria-current={i === active}
            onClick={() => goTo(i)}
            className={
              i === active
                ? "h-1.5 w-4 rounded-full bg-rc-ink-mute transition-all"
                : "h-1.5 w-1.5 rounded-full bg-rc-rule transition-all"
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function Testimonial({ className }: { className?: string }) {
  const region = useSyncExternalStore(noSubscribe, readReaderRegion, () => null);
  const swipe = useTestimonialSwipe();
  if (!PROOF.showProof) return null;
  if (swipe) {
    return <QuoteSwipe quotes={proofQuotesFor(region)} className={className ?? FIGURE_CLASS} />;
  }
  return (
    <figure className={className ?? FIGURE_CLASS}>
      <Quote quote={proofQuoteFor(region)} stars />
    </figure>
  );
}
