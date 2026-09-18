import Image from "next/image";
import { Stars } from "@/app/components/paywall/testimonial";
import { SPOT_AD_TESTIMONIAL } from "@/app/lp/_shared/lp-content";

/**
 * Kevin's coho, under the 24-hour chart on every page that sells with the
 * hero copy: `?ad=` spot pages and the Washington and California landing
 * heroes on spot and city pages.
 *
 * The chart above it is the promise; this is somebody who acted on that
 * promise and what came of it. Casey placed it under the chart, not in the
 * hero (2026-09-17): the hero is the pitch, the chart is the proof, and the
 * catch belongs with the proof. Words and picture are read from the
 * one record in lp-content.ts, same as every other quote, so a correction
 * there reaches this box too. No link out: the ad frame's rule is that nothing
 * on the page is a visible link except the trial button.
 */
export default function AdTestimonialCard() {
  const q = SPOT_AD_TESTIMONIAL;
  return (
    <figure className="overflow-hidden rounded-xl border border-rc-rule bg-rc-panel shadow-sm">
      <div className="grid md:grid-cols-[1.25fr_1fr]">
        <Image
          src={q.photo.src}
          alt={q.photo.alt}
          width={q.photo.width}
          height={q.photo.height}
          sizes="(min-width: 768px) 56vw, 100vw"
          className="h-56 w-full object-cover md:h-full md:min-h-[260px]"
        />
        <div className="flex flex-col justify-center p-5 md:p-6">
          <div className="font-rc-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-rc-ink-mute">
            From a ReelCaster angler
          </div>
          {q.rating != null && (
            <div className="mt-2">
              <Stars rating={q.rating} />
            </div>
          )}
          <blockquote className="rc-body mt-3 text-[14px] leading-relaxed text-rc-ink-soft">
            {q.text}
          </blockquote>
          <figcaption className="mt-3 font-rc-mono text-[11px] text-rc-ink-mute">
            {q.attr}
          </figcaption>
        </div>
      </div>
    </figure>
  );
}
