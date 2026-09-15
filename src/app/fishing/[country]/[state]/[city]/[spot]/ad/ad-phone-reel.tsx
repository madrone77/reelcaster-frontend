"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * The ad hero's phone, cycling four screens of the product on one spot.
 *
 * The homepage's PhoneCarousel with its copy column taken out: on the ad page
 * the headline beside it is the searched keyword and its answer, so each
 * screen carries one caption under the device instead of a headline of its
 * own. The mechanism is the homepage's and so are its reasons (see
 * phone-carousel.tsx): every phone stacked in one grid cell so nothing
 * bounces, hidden layers `visibility:hidden` so the maps keep a size, and a
 * timer that stops off screen, under a pointer, with focus inside, for good
 * once the reader picks a screen, and never starts under reduced motion.
 */

export interface ReelSlide {
  id: string;
  /** The pill label. */
  tab: string;
  /** Caption headline, about the spot. */
  title: string;
  /** One sentence under it. */
  body: string;
  phone: ReactNode;
  /** Mount the phone on first show. For a slide that draws a second map. */
  lazy?: boolean;
}

const HOLD_MS = 6000;
const LAYER = "[grid-area:1/1] transition-opacity duration-500 ease-out";

export default function AdPhoneReel({ slides }: { slides: ReelSlide[] }) {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [taken, setTaken] = useState(false);
  const [running, setRunning] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setRunning(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(host);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (taken || hovered || focused || !running || slides.length < 2) return;
    const id = setInterval(() => setActive((i) => (i + 1) % slides.length), HOLD_MS);
    return () => clearInterval(id);
  }, [taken, hovered, focused, running, slides.length]);

  useEffect(() => {
    setSeen((prev) => (prev.has(active) ? prev : new Set(prev).add(active)));
  }, [active]);

  const pick = useCallback(
    (i: number) => {
      setTaken(true);
      setActive(i);
      trackEvent("Spot Ad Reel Screen Picked", { screen: slides[i]?.id });
    },
    [slides],
  );

  const layer = (i: number) => ({
    "aria-hidden": i !== active,
    inert: i !== active,
    className: `${LAYER} ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`,
    style: { visibility: i === active ? ("visible" as const) : ("hidden" as const) },
  });

  return (
    <div
      ref={hostRef}
      role="group"
      aria-roledescription="carousel"
      aria-label="ReelCaster on a phone"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      className="flex flex-col items-center"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => pick(i)}
            aria-current={i === active ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand ${
              i === active
                ? "bg-rc-brand text-white"
                : "bg-rc-surface text-rc-ink-mute hover:bg-rc-brand-soft hover:text-rc-brand"
            }`}
          >
            {slide.tab}
          </button>
        ))}
      </div>

      <div className="mt-5 grid">
        {slides.map((slide, i) => {
          const l = layer(i);
          return (
            <div key={slide.id} {...l}>
              <div className="rcpbox">
                <div className="rcpslot">{slide.lazy && !seen.has(i) ? null : slide.phone}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid w-full max-w-sm text-center">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${slide.tab}`}
            {...layer(i)}
          >
            <div className="text-[17px] font-bold leading-snug text-rc-ink">{slide.title}</div>
            <p className="mt-1 text-[14px] leading-snug text-rc-ink-soft">{slide.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
