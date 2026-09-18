import Image from "next/image";
import { Stars } from "@/app/components/paywall/testimonial";
import {
  PRO_TESTIMONIALS_ROW_LABEL,
  PRO_TESTIMONIALS_ROW_TITLE,
  pageTestimonials,
} from "@/app/lp/_shared/lp-content";

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
 * Three equal cards. Kevin's carries his photo across the top, which is what
 * anchors the row; Bob's and Nick's are words alone with the same frame, so
 * the row reads as one set rather than a picture with two footnotes. At
 * desktop all three sit side by side; on a phone they snap sideways with the
 * next card peeking in from the right, which is the whole cue that there is
 * more. No links inside: the ad frame's rule is that nothing on the page is
 * a visible link except the trial button.
 *
 * The grid does not stretch the cards to one height (`lg:items-start`):
 * with the photo card in the row an equal-height grid left Bob's and
 * Nick's cards two-thirds empty below their words (Casey, 2026-09-18). Each
 * card ends at its own attribution, and the photo is a wide 5:2 band, not
 * 16:9, so Kevin's card is only a little taller than the other two rather
 * than twice their height.
 *
 * The "ReelCaster Pro Testimonial" label came out of the cards on
 * 2026-09-18 and heads the row once, the same as the paywall modals. Later
 * that day Casey asked for it cleaner: a real heading in words above the
 * label, like the sections around it, and Kevin's photo card last so the
 * two word-only cards read first and the picture closes the row.
 */
export default function AdTestimonialCard() {
  const cards = pageTestimonials();
  return (
    <section aria-label={PRO_TESTIMONIALS_ROW_LABEL}>
      <h2 className="text-[22px] font-semibold leading-tight text-rc-ink lg:text-[26px]">
        {PRO_TESTIMONIALS_ROW_TITLE}
      </h2>
      <div className="mt-2 mb-4 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-brand">
        {PRO_TESTIMONIALS_ROW_LABEL}
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-3 lg:items-start lg:overflow-visible lg:px-0 lg:pb-0">
        {cards.map((q) => (
          <figure
            key={q.attr}
            className="flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-rc-rule bg-rc-panel shadow-sm sm:w-[60%] lg:w-auto"
          >
            {q.photo && (
              <Image
                src={q.photo.src}
                alt={q.photo.alt}
                width={q.photo.width}
                height={q.photo.height}
                sizes="(min-width: 1024px) 33vw, 82vw"
                className="aspect-[5/2] w-full object-cover"
              />
            )}
            <div className="flex flex-1 flex-col p-4 md:p-5">
              {q.rating != null && <Stars rating={q.rating} />}
              <blockquote className="rc-body mt-2 text-[14px] leading-relaxed text-rc-ink-soft">
                {q.text}
              </blockquote>
              <figcaption className="mt-auto pt-3 font-rc-mono text-[11px] text-rc-ink-mute">
                {q.attr}
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
