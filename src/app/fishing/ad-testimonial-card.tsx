"use client";

import { useSubscription } from "@/hooks/use-subscription";
import {
  PRO_TESTIMONIALS_ROW_LABEL,
  PRO_TESTIMONIALS_ROW_TITLE,
  pageTestimonials,
} from "@/app/lp/_shared/lp-content";
import { Byline, TileStars } from "@/app/components/testimonial-parts";

/**
 * Three anglers' word for it, under the 24-hour chart on every page that
 * sells with the hero copy: `?ad=` spot pages and the Washington and
 * California landing heroes on spot and city pages.
 *
 * The chart above it is the promise; these are people who acted on that
 * promise and what came of it. Casey placed it under the chart, not in the
 * hero (2026-09-17): the hero is the pitch, the chart is the proof, and the
 * catch belongs with the proof. On 2026-09-18 the single photo box became
 * this row of three, the same three cards the paywall modals scroll through.
 *
 * Words only. Kevin's card carried his coho photo through 2026-09-18 and
 * the row was laid out around it: a 3x2 grid with the photo card rising
 * beside the heading, then a sideways portrait crop, then a taller card
 * with the photo across its top. Every version read badly against two
 * word-only cards ("looks like shit", Casey, three times) and the photo
 * came out the same day. The heading sits above three equal cards that
 * share a top edge and a bottom edge.
 *
 * On a phone the three cards snap sideways, the next peeking in from the
 * right. No links inside: the ad frame's rule is that nothing on the page
 * is a visible link except the trial button.
 *
 * Each card opens with the rating, five yellow stars and the score beside
 * them, then the words, then the angler's name with the place under it.
 * The card carried a circle of initials and led with the byline through
 * 2026-09-18; Casey took the circle out and moved the name under the quote
 * the same day. The "ReelCaster Pro Testimonial" label heads the row once,
 * under a real heading in words, the same as the paywall modals.
 *
 * Never on a Pro account (Casey, 2026-09-24): a Pro viewer already bought,
 * so the row is selling them something they have. Held until the tier
 * settles (`isPaid` starts `false`) so Pro never gets a flash of it.
 */
export default function AdTestimonialCard() {
  const { isPaid, loading: tierLoading } = useSubscription();
  if (tierLoading || isPaid) return null;
  const cards = pageTestimonials();
  return (
    <section aria-label={PRO_TESTIMONIALS_ROW_LABEL}>
      <h2 className="text-[22px] font-semibold leading-tight text-rc-ink lg:text-[26px]">
        {PRO_TESTIMONIALS_ROW_TITLE}
      </h2>
      <div className="mt-2 mb-4 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-brand">
        {PRO_TESTIMONIALS_ROW_LABEL}
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible">
        {cards.map((q) => (
          <figure
            key={q.attr}
            className="flex w-[82%] shrink-0 snap-start flex-col rounded-xl border border-rc-rule bg-rc-panel p-4 shadow-sm sm:w-[60%] md:p-5 lg:w-auto"
          >
            {q.rating != null && <TileStars rating={q.rating} />}
            <blockquote className="rc-body mt-3 flex-1 text-[14px] leading-relaxed text-rc-ink-soft">
              {q.text}
            </blockquote>
            <figcaption className="mt-4">
              <Byline attr={q.attr} />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
