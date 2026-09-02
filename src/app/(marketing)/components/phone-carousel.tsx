'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The homepage's product carousel: one screen of the app at a time, with the
 * words that go with it, advancing on a timer.
 *
 * This slot used to hold the Explore map and nothing else, under a headline
 * about mapped structure. That was one true thing about the product out of
 * four, and the other three were already drawn — the landing pages have been
 * showing the spot page, the day chart and the alert text for months. They are
 * the same components and the same copy here, so a reader arriving from an ad
 * meets the screens they were shown, and nobody has to keep two descriptions
 * of one product in step.
 *
 * ── Two stacks, not four slides ──────────────────────────────────────────
 *
 * The phones are stacked in one grid cell and the copy in another, rather than
 * each slide being a two-column block stacked on the next. It reads as a
 * roundabout way to build a carousel and it is the whole reason this one does
 * not bounce.
 *
 * Built the obvious way, each slide is as tall as its own contents, and a
 * shorter slide centred in the shared box puts its phone somewhere else: the
 * device slid up and down by tens of pixels every time the timer fired, and
 * the headline moved with it, because the copy is a different length on every
 * slide. Split in two, each stack is as tall as its own tallest member and
 * that height never changes. The phone hangs from the top of its stack, so
 * every device's top edge is at the same pixel; the copy hangs from the top of
 * its own, so the kicker and the headline are too. What moves between slides
 * is the screen and the words, which is the only thing that should.
 *
 * The devices are drawn at true size and shown at 65%: the app inside still
 * lays itself out at the 375px a real phone gives it. See SLOT_CSS.
 *
 * ── Every slide is in the HTML ───────────────────────────────────────────
 *
 * Slides are stacked rather than mounted on demand. Three reasons, in order of
 * how much they cost to get wrong:
 *
 * 1. The copy of all four is in the server-rendered HTML, so a crawler reads
 *    the whole product story rather than a quarter of it.
 * 2. The live screens — the map, and the phones drawing a real day — keep
 *    their own state and their own WebGL context instead of being torn down
 *    and rebuilt every time the timer comes round.
 * 3. The stacks are as tall as their tallest member and stay that height, so
 *    advancing never moves the page under a reader's thumb.
 *
 * Hidden layers go `visibility:hidden`, which keeps their layout box (the maps
 * need a real size to stay sized) while taking them out of the accessibility
 * tree and out of tab order.
 *
 * ── The timer ────────────────────────────────────────────────────────────
 *
 * It stops when the section is off screen, when a pointer is over it, when
 * focus is inside it, and for good once a reader picks a slide themselves —
 * a carousel that keeps moving under somebody who has just chosen where to
 * look is the reason carousels have the reputation they do. It never starts
 * at all under prefers-reduced-motion.
 */

export interface PhoneSlide {
  /** Stable key, and what the dot's label says. */
  id: string;
  /** Short label for the dot, e.g. "Alerts". */
  tab: string;
  /** Mono kicker over the headline. */
  kicker: string;
  /** Headline, in two parts: the ink line, then the brand-blue one. */
  title: [string, string];
  /** One or two paragraphs under the headline. */
  body: string[];
  /** Optional three-beat list, as the landing pages set it. */
  points?: { term: string; detail: string }[];
  /** The call to action. Already styled by the caller. */
  cta: ReactNode;
  /** The phone. Whatever it is, it draws its own device. */
  phone: ReactNode;
  /**
   * Hold this phone back until its slide is first shown.
   *
   * For the one slide that draws a second MapLibre map. The homepage already
   * pays for one WebGL context and one set of relief tiles in the opening
   * slide; a second one mounted at load would be bytes and a GPU context spent
   * on a picture nobody has scrolled to yet. Once shown it stays mounted, like
   * every other slide, so returning to it is instant.
   *
   * The COPY is never deferred — it is in the server-rendered HTML either way,
   * which is the half a crawler reads.
   */
  lazy?: boolean;
}

/** How long a slide holds before the next one. Long enough to read the copy. */
const HOLD_MS = 7000;

/** Shared by both stacks so a layer and its phone fade together. */
const LAYER = '[grid-area:1/1] transition-opacity duration-500 ease-out';

export default function PhoneCarousel({ slides }: { slides: PhoneSlide[] }) {
  const [active, setActive] = useState(0);
  /** Slides that have been shown at least once. See PhoneSlide.lazy. */
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  /** Set once a reader uses the dots. The timer does not come back. */
  const [taken, setTaken] = useState(false);
  /** On screen, and nobody is hovering or tabbing through it. */
  const [running, setRunning] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
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
    const id = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      HOLD_MS,
    );
    return () => clearInterval(id);
  }, [taken, hovered, focused, running, slides.length]);

  useEffect(() => {
    setSeen((prev) => (prev.has(active) ? prev : new Set(prev).add(active)));
  }, [active]);

  const pick = useCallback((i: number) => {
    setTaken(true);
    setActive(i);
  }, []);

  /** What every layer of a given slide shares: whether it is the one showing. */
  const layer = (i: number) => ({
    'aria-hidden': i !== active,
    inert: i !== active,
    className: `${LAYER} ${
      i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
    }`,
    style: {
      visibility: i === active ? ('visible' as const) : ('hidden' as const),
    },
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
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-14">
        {/* THE PHONES. One cell, four devices in it, each at the same stated
            size, so their edges land on the same pixels.

            No gutter reclaim any more: the device is drawn at true size and
            scaled, so the box is a fixed 258 and fits the narrowest phone
            with room either side. It used to be 397 and had to eat the
            section's padding on a small screen, or the conditions phone
            dropped under SpotTerminal's 300px measuring floor. */}
        <div className="order-2 grid lg:order-1">
          {slides.map((slide, i) => {
            const l = layer(i);
            return (
            <div key={slide.id} {...l} className={`flex flex-col ${l.className}`}>
              {/* The device box states the scaled size; the slot inside it
                  draws the phone at true size and scales it, out of flow so
                  the untransformed height does not reserve space. See
                  SLOT_CSS in product-carousel.tsx. */}
              <div className="rcpbox">
                <div className="rcpslot">
                  {slide.lazy && !seen.has(i) ? null : slide.phone}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* THE COPY. Its own stack, so the kicker starts at the same height on
            every slide however long the paragraph under it runs. */}
        <div className="order-1 grid lg:order-2">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}: ${slide.tab}`}
              {...layer(i)}
            >
              <span className="block font-mono text-[11px] font-semibold tracking-[0.1em] text-rc-ink-soft uppercase">
                {slide.kicker}
              </span>
              <h2 className="mt-4 text-balance text-3xl leading-[1.15] font-black tracking-[-0.02em] md:text-4xl">
                <span className="block text-rc-ink">{slide.title[0]}</span>
                <span className="block text-rc-brand">{slide.title[1]}</span>
              </h2>
              {slide.body.map((p) => (
                <p
                  key={p}
                  className="mt-5 max-w-lg text-pretty text-sm leading-relaxed text-rc-ink-soft md:text-base"
                >
                  {p}
                </p>
              ))}
              {slide.points ? (
                <ul className="mt-7 max-w-lg">
                  {slide.points.map(({ term, detail }) => (
                    <li
                      key={term}
                      className="grid grid-cols-[92px_1fr] items-baseline gap-4 border-b border-rc-rule/70 py-3.5 last:border-b-0"
                    >
                      <b className="text-[17px] font-bold tracking-[-0.02em] text-rc-ink">
                        {term}
                      </b>
                      <span className="text-sm leading-relaxed text-rc-ink-soft">
                        {detail}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-9">{slide.cta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* The dots. Labelled with the screen they go to rather than a number,
          because "2" is not a reason to click and "Alerts" is. */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => pick(i)}
            aria-current={i === active ? 'true' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 focus-visible:outline-none ${
              i === active
                ? 'bg-rc-brand text-white'
                : 'bg-rc-surface text-rc-ink-mute hover:bg-rc-brand-soft hover:text-rc-brand'
            }`}
          >
            {slide.tab}
          </button>
        ))}
      </div>
    </div>
  );
}
