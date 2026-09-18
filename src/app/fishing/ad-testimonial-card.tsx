import Image from "next/image";
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
 * At desktop the section is one 3x2 grid. The heading and label take the
 * first two columns of the top row; Kevin's photo card takes the third
 * column across both rows, bottom-aligned, so its photo rises into the
 * space beside the heading and all three cards share a bottom edge. Casey
 * sketched this balance (2026-09-18) after an equal-height row left the
 * two word-only cards two-thirds blank under the photo card.
 *
 * On a phone the three cards snap sideways, the next peeking in from the
 * right. Kevin's card is a little wider than the other two and carries the
 * photo across its top at 16:10, bigger than the desktop band, so the
 * catch is what you see when you swipe to it. A scroller is as tall as its
 * tallest card, so the two word-only cards centre their quote in that
 * height rather than leave the slack at one end. Tried and rejected the
 * same day: stacking the cards (kills the row) and turning Kevin's card
 * sideways with a portrait crop of the photo beside the quote ("looks like
 * shit"). No links inside: the ad frame's rule is that nothing on the page
 * is a visible link except the trial button.
 *
 * Each card opens with the angler: a circle of initials beside the name,
 * the place under it, then the rating as Trustpilot-style green tiles with
 * the score beside them, then the words (Casey, 2026-09-18, from two
 * review-widget crops). The attribution used to close the card in mono;
 * leading with the person is what those widgets do and it reads as a
 * review rather than a pull quote.
 *
 * The "ReelCaster Pro Testimonial" label came out of the cards on
 * 2026-09-18 and heads the row once, the same as the paywall modals, under
 * a real heading in words; Kevin's photo card is last so the two word-only
 * cards read first and the picture closes the row.
 */
export default function AdTestimonialCard() {
  const cards = pageTestimonials();
  return (
    <section
      aria-label={PRO_TESTIMONIALS_ROW_LABEL}
      className="lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-x-4 lg:gap-y-0"
    >
      <div className="lg:col-span-2 lg:self-end">
        <h2 className="text-[22px] font-semibold leading-tight text-rc-ink lg:text-[26px]">
          {PRO_TESTIMONIALS_ROW_TITLE}
        </h2>
        <div className="mt-2 mb-4 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-brand">
          {PRO_TESTIMONIALS_ROW_LABEL}
        </div>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:contents">
        {cards.map((q) => (
          <figure
            key={q.attr}
            className={`flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-rc-rule bg-rc-panel shadow-sm lg:w-auto ${
              q.photo
                ? "w-[92%] sm:w-[70%] lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:self-end"
                : "w-[82%] sm:w-[60%]"
            }`}
          >
            {q.photo && (
              <Image
                src={q.photo.src}
                alt={q.photo.alt}
                width={q.photo.width}
                height={q.photo.height}
                sizes="(min-width: 1024px) 33vw, 92vw"
                className="aspect-[16/10] w-full object-cover lg:aspect-[5/2]"
              />
            )}
            <div
              className={`flex min-w-0 flex-1 flex-col p-4 md:p-5 ${q.photo ? "" : "justify-center lg:justify-start"}`}
            >
              <figcaption>
                <Byline attr={q.attr} />
              </figcaption>
              {q.rating != null && <TileStars rating={q.rating} className="mt-3" />}
              <blockquote className="rc-body mt-3 text-[14px] leading-relaxed text-rc-ink-soft">
                {q.text}
              </blockquote>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}


