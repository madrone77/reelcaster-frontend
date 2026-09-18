import { getImageProps } from "next/image";
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
 * At desktop the section is one 3x2 grid. The heading and label take the
 * first two columns of the top row; Kevin's photo card takes the third
 * column across both rows, bottom-aligned, so its photo rises into the
 * space beside the heading and all three cards share a bottom edge. Casey
 * sketched this balance (2026-09-18) after an equal-height row left the
 * two word-only cards two-thirds blank under the photo card.
 *
 * On a phone the three cards snap sideways, the next peeking in from the
 * right, and Kevin's card turns: photo down the left, words on the right,
 * a little wider than the other two. A scroller is as tall as its tallest
 * card, so a photo across the top padded the word-only cards blank
 * whatever we did with alignment; side by side, the photo costs the row no
 * height (Casey, 2026-09-18). The fish lies along the photo, so a tall
 * crop of the landscape frame showed a sliver of scales; the phone gets
 * the same photo turned a quarter turn, fish head at the top, through a
 * `<picture>` so only one file loads. His quote is the longest and sits in
 * the narrower column, so his card still sets the row's height; the two
 * word-only cards centre their quote in it rather than leave the slack at
 * one end. No links inside: the ad frame's rule is that nothing on the
 * page is a visible link except the trial button.
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
            className={`flex shrink-0 snap-start overflow-hidden rounded-xl border border-rc-rule bg-rc-panel shadow-sm lg:w-auto lg:flex-col ${
              q.photo
                ? "w-full flex-row sm:w-[80%] lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:self-end"
                : "w-[82%] flex-col sm:w-[60%]"
            }`}
          >
            {q.photo && <CatchPhoto photo={q.photo} />}
            <div
              className={`flex min-w-0 flex-1 flex-col p-4 md:p-5 ${q.photo ? "" : "justify-center lg:justify-start"}`}
            >
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

/**
 * Kevin's catch, art-directed: the landscape frame across the top of the
 * card at desktop, the portrait turn down its left side on a phone. The
 * browser picks one source by the same 1024px breakpoint Tailwind's `lg`
 * uses, so the phone never downloads the desktop file or vice versa.
 */
function CatchPhoto({ photo }: { photo: NonNullable<ReturnType<typeof pageTestimonials>[number]["photo"]> }) {
  const common = { alt: photo.alt, sizes: "(min-width: 1024px) 33vw, 40vw" };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: photo.src, width: photo.width, height: photo.height });
  const {
    props: { srcSet: phone, ...rest },
  } = getImageProps({
    ...common,
    src: photo.portrait.src,
    width: photo.portrait.width,
    height: photo.portrait.height,
  });
  return (
    <picture className="contents">
      <source media="(min-width: 1024px)" srcSet={desktop} sizes={rest.sizes} />
      <source srcSet={phone} sizes={rest.sizes} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes through `rest` */}
      <img
        {...rest}
        className="h-auto w-[36%] shrink-0 self-stretch object-cover lg:aspect-[5/2] lg:w-full lg:self-auto"
      />
    </picture>
  );
}
