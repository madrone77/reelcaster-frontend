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
 * At desktop the section is one 3x2 grid. The heading and label take the
 * first two columns of the top row; the photo card takes the third column
 * across both rows, bottom-aligned, so its photo rises into the space
 * beside the heading and all three cards share a bottom edge. Before this
 * an equal-height row left Bob's and Nick's cards two-thirds empty below
 * their words, and a non-stretching row left the bottoms ragged; Casey
 * sketched this balance (2026-09-18). The photo is a wide 5:2 band, not
 * 16:9. On a phone the figures are plain flex children of the snap scroller
 * until `lg:contents` hands them to the grid; there the photo card runs
 * wider than the word cards and its photo is a taller 16:10, so the catch
 * is the thing you see when you swipe to it (Casey, 2026-09-18).
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
      <div className="-mx-1 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:contents">
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
                sizes="(min-width: 1024px) 33vw, 82vw"
                className="aspect-[16/10] w-full object-cover lg:aspect-[5/2]"
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
