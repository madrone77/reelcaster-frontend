"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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
 *
 * Three ways to move between screens, all of which stop the timer for good:
 * the pills above the phone, an arrow either side of it (with a "2 of 4"
 * count between them under the device, so the reader knows where they are
 * in the reel), and a horizontal swipe across the phone on a touch screen.
 * The swipe is read off pointer events on the stack, which is safe because
 * every phone inside is a picture or a non-interactive map: nothing in there
 * wants the drag. Arrow keys work while a pill or an arrow has focus.
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
/** A drag this far across the phone, more across than down, is a swipe. */
const SWIPE_PX = 40;

/**
 * The arrows sit at the column's edges, level with the middle of the phone,
 * out of flow: in flow they would widen the hero column past a 375px screen
 * (44 + 258 + 44 and the gaps) and push the whole column off the right edge.
 * At phone width they just clear the device's bezel; on a desktop column
 * they stand well clear of it.
 */
const ARROW =
  "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-rc-rule bg-white text-rc-ink shadow-sm transition-colors hover:border-rc-brand hover:text-rc-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

export default function AdPhoneReel({ slides }: { slides: ReelSlide[] }) {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [taken, setTaken] = useState(false);
  const [running, setRunning] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

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
    (i: number, how: "pill" | "arrow" | "swipe" | "key") => {
      setTaken(true);
      setActive(i);
      trackEvent("Spot Ad Reel Screen Picked", { screen: slides[i]?.id, how });
    },
    [slides],
  );

  const step = useCallback(
    (by: 1 | -1, how: "arrow" | "swipe" | "key") => {
      pick((active + by + slides.length) % slides.length, how);
    },
    [active, pick, slides.length],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1, "key");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1, "key");
    }
  };

  // Swipe: one pointer down on the stack, a mostly-horizontal move past
  // SWIPE_PX, and the reel steps once on release. Vertical drags are left to
  // the page so a thumb scrolling past the phone still scrolls.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1, "swipe");
  };
  const onPointerCancel = () => {
    drag.current = null;
  };

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
      onKeyDown={onKeyDown}
      className="flex flex-col items-center"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => pick(i, "pill")}
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

      <div className="relative mt-5 w-full">
        <button
          type="button"
          onClick={() => step(-1, "arrow")}
          aria-label={`Previous screen: ${slides[(active - 1 + slides.length) % slides.length].tab}`}
          className={`${ARROW} left-0`}
        >
          <Chevron dir="left" />
        </button>

        <div
          className="grid touch-pan-y select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
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

        <button
          type="button"
          onClick={() => step(1, "arrow")}
          aria-label={`Next screen: ${slides[(active + 1) % slides.length].tab}`}
          className={`${ARROW} right-0`}
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div
        className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-rc-ink-mute"
        aria-live="polite"
      >
        {active + 1} of {slides.length}
      </div>

      <div className="mt-3 grid w-full max-w-sm text-center">
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
