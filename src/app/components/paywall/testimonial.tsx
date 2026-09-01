"use client";

import { Star } from "lucide-react";
import { PROOF } from "@/app/lp/_shared/lp-content";

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

export default function Testimonial({ className }: { className?: string }) {
  if (!PROOF.showProof) return null;
  return (
    <figure
      className={
        className ?? "mt-5 rounded border border-rc-rule bg-rc-panel/70 p-4"
      }
    >
      <Stars rating={PROOF.quote.rating} />
      <blockquote className="rc-body mt-2 text-[13px] leading-relaxed text-rc-ink-soft">
        {PROOF.quote.text}
      </blockquote>
      <figcaption className="mt-2 font-rc-mono text-[11px] text-rc-ink-mute">
        {PROOF.quote.attr}
      </figcaption>
    </figure>
  );
}
