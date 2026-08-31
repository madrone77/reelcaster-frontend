'use client';

// The product's spot score card, at the top of the homepage.
//
// Mirrors the real src/app/explore/spot/components/score-card.tsx +
// hourly-bars.tsx styling. The bars cascade up once the card scrolls into
// view, and lift on hover — a whisper of life that hints the real thing is
// interactive, without making the hero a toy.
//
// WHAT SHIPS IN THE HTML, AND WHAT ARRIVES AFTER
//
// The static document carries DEMO_CARD below: Constance Bank, hardcoded,
// identical for every visitor and every crawler. It has to. The page is
// statically rendered with `revalidate = 3600` and is the site's strongest
// ranking surface, so personalizing the document would mean a crawler indexing
// whichever city its data centre sits near.
//
// After hydration the card asks /api/hero-card where the visitor is and, if
// the answer is a covered city, swaps in that city's real spot — name, score,
// curve, window, tide phase and catch count. A visitor arriving from Seattle
// reads a Seattle mark; one from Vancouver reads a Vancouver mark; one from
// Calgary, or a crawler, keeps the demo. This is the same pattern, for the
// same reason, as components/nearby-spots.tsx.
//
// The swap must not move the page. Every part of this card is fixed-height by
// construction: the bars have a fixed 56px box, the score sits in its own
// shrink-0 column, and the spot name and the two sub-lines are held to their
// own heights below. Test a longer spot name than "Constance Bank" before
// changing any of that.

import { useEffect, useRef, useState } from 'react';
import { TIER_PILL, TIER_TEXT, type Tier } from '@/app/explore/lib/explore-data';
import type { HeroCard, HeroCardPayload } from '@/lib/hero-card';

/** Solid tier fills for the window bars. The pill and the numeral have shared
 *  maps already (TIER_PILL, TIER_TEXT); the bars are the one channel that
 *  did not, because this is the only surface that paints them by tier. */
const TIER_BAR: Record<Tier, string> = {
  good: 'bg-rc-good',
  fair: 'bg-rc-fair',
  poor: 'bg-rc-poor',
  none: 'bg-rc-rule',
};

/**
 * The card a crawler sees, and the card everyone sees for the moment before
 * geo resolves.
 *
 * Every number here is invented, which is exactly why the card says UPDATED
 * HOURLY and not "Updated 5 min ago": the scoring fan-out is not a
 * five-minute loop, and a static figure under a live badge is the one thing
 * on this card a customer could catch us on. Same wording, and the same
 * reasoning, as the /lp score card — see the note at the top of
 * src/app/lp/_shared/lp-content.ts.
 */
const DEMO_CARD: HeroCard = {
  eyebrow: 'Chinook · Peak Season',
  spotName: 'Constance Bank',
  score: 82,
  tier: 'good',
  tagWord: 'GOOD',
  hours: [
    28, 25, 22, 20, 24, 30, 38, 42, 40, 36, 34, 38, 45, 44, 40, 52, 66, 82, 78,
    74, 58, 44, 36, 30,
  ],
  // 4 PM – 7 PM bars render solid, under "Best window 5:30-7:30 PM".
  bestFrom: 16,
  bestTo: 19,
  windowTime: '5:30-7:30 PM',
  tidePhase: 'Flood tide',
  freshCatches: 9,
  freshWindowDays: 14,
};

/** The two sub-lines under the spot name. Shared with their invisible
 *  placeholders below, so a spacing change can only ever move both. */
const FRESH_LINE = 'mt-2.5 flex items-center gap-2 text-xs font-medium text-rc-ink';
const WINDOW_LINE = 'mt-1.5 font-rc-mono text-[11px] text-rc-ink-mute';

const AXIS_TICKS = [
  { hour: 6, label: '6A' },
  { hour: 12, label: '12P' },
  { hour: 18, label: '6P' },
  { hour: 24, label: '12A' },
];

export default function HeroScoreCard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [card, setCard] = useState<HeroCard>(DEMO_CARD);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Carry a `?geo_lat=&geo_lng=` override on the page URL through to the
    // API, so the swap can be exercised on localhost and on a preview where
    // the platform sets no geo headers. Inert in production: readEdgeGeoPoint
    // reads the override only when VERCEL_ENV is not "production", so these
    // params cannot make the live site claim a visitor is somewhere else.
    const here = new URLSearchParams(window.location.search);
    const url = new URL('/api/hero-card', window.location.origin);
    for (const key of ['geo_lat', 'geo_lng'] as const) {
      const value = here.get(key);
      if (value) url.searchParams.set(key, value);
    }

    fetch(url.toString(), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: HeroCardPayload | null) => {
        if (json?.located && json.card) setCard(json.card);
      })
      // An aborted or failed fetch leaves the demo card in place, which is
      // the whole fallback: there is no error state to render.
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="rounded border border-rc-rule bg-rc-panel shadow-rc-panel p-6 sm:p-8">
      <div className="text-center">
        <p className="font-rc-mono text-[10px] tracking-[0.2em] uppercase text-rc-ink-mute/80">
          Updated hourly
        </p>
        <p className="mt-1 font-rc-mono text-lg sm:text-xl tracking-[0.3em] uppercase text-rc-ink-mute">
          Reelcaster Score
        </p>
      </div>

      <div className="mt-7 flex items-start justify-between gap-6">
        <div className="min-w-0">
          {/* The clip lives on the wrapper, not the chip. `overflow: hidden`
              on an inline-block moves its baseline to the bottom margin edge,
              which grew the whole card by 3px against main; on a block it
              costs nothing. A live eyebrow runs longer than the demo's
              ("CHINOOK SALMON · VANCOUVER"), so something has to hold it to
              one line. */}
          <div className="max-w-full truncate">
            <span className="inline-block rounded bg-rc-brand-soft px-2 py-1 font-rc-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-rc-brand">
              {card.eyebrow}
            </span>
          </div>
          {/* One line, always. A real spot name can run longer than the demo's
              ("Discovery Island Reefs"), and a second line here would push the
              card taller the instant the swap lands. */}
          <h3
            className="mt-2.5 truncate text-2xl font-bold tracking-[-0.02em] text-rc-ink"
            title={card.spotName}
          >
            {card.spotName}
          </h3>
          {/* Both sub-lines are optional on live data — a mark with no reports
              in the window has no catch line, and a flat day has no window —
              and the card must not change height when one is missing, because
              it sits above the fold and the swap happens under the reader's
              eye.

              So an absent line is REPLACED by an invisible copy of itself
              rather than removed. The space is then reserved by the same box
              that would have filled it, which is why there is no min-height
              constant here to drift out of step with the type: change the
              leading and both states still agree. `visibility: hidden` also
              takes the placeholder out of the accessibility tree, so nothing
              announces an empty line. */}
          {card.freshCatches > 0 ? (
            <p className={FRESH_LINE}>
              <span className="h-2 w-2 shrink-0 rounded-full bg-rc-good" />
              {card.freshCatches} fresh{' '}
              {card.freshCatches === 1 ? 'catch' : 'catches'} logged in the last{' '}
              {card.freshWindowDays} days
            </p>
          ) : (
            <p aria-hidden className={`${FRESH_LINE} invisible`}>
              <span className="h-2 w-2 shrink-0 rounded-full" />
              &nbsp;
            </p>
          )}
          {card.windowTime ? (
            <p className={WINDOW_LINE}>
              Best window {card.windowTime}
              {card.tidePhase ? ` · ${card.tidePhase}` : ''}
            </p>
          ) : (
            <p aria-hidden className={`${WINDOW_LINE} invisible`}>
              &nbsp;
            </p>
          )}
        </div>

        <div className="shrink-0 text-center">
          <div
            className={`text-[68px] sm:text-[80px] leading-[0.85] font-bold tracking-[-0.04em] tabular-nums ${TIER_TEXT[card.tier]}`}
          >
            {card.score}
          </div>
          {card.tagWord && (
            <span
              className={`mt-2 inline-block rounded px-4 py-1 font-rc-mono text-[10px] font-semibold tracking-[0.14em] ${TIER_PILL[card.tier]}`}
            >
              {card.tagWord}
            </span>
          )}
        </div>
      </div>

      <div className="mt-7">
        <div ref={chartRef} className="group flex h-14 items-end gap-[3px]">
          {card.hours.map((score, i) => {
            const inWindow = i >= card.bestFrom && i <= card.bestTo;
            const h = Math.max(5, (score / 100) * 56);
            return (
              <div
                key={i}
                className={`flex-1 rounded-[2px] transition-[height,background-color] duration-500 ease-out motion-reduce:transition-none ${
                  inWindow
                    ? TIER_BAR[card.tier]
                    : 'bg-rc-rule-soft group-hover:bg-rc-rule'
                }`}
                style={{
                  height: shown ? `${h}px` : '4px',
                  transitionDelay: `${i * 18}ms`,
                }}
              />
            );
          })}
        </div>
        <div className="relative mt-1.5 h-4 font-rc-mono text-[9px] text-rc-ink-mute/70">
          {AXIS_TICKS.map(({ hour, label }) => (
            <span
              key={label}
              className="absolute -translate-x-1/2"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
