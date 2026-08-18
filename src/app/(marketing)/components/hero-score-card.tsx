'use client';

// Static demo of the product's spot score card (mirrors the real
// src/app/explore/spot/components/score-card.tsx + hourly-bars.tsx styling,
// but hard-coded — the landing page makes no API calls). The bars cascade up
// once the card scrolls into view, and lift on hover — a whisper of life that
// hints the real thing is interactive, without making the hero a toy.

import { useEffect, useRef, useState } from 'react';

const DEMO_HOURS = [
  28, 25, 22, 20, 24, 30, 38, 42, 40, 36, 34, 38, 45, 44, 40, 52, 66, 82, 78,
  74, 58, 44, 36, 30,
];

// 4 PM – 7 PM bars render solid green ("Best window 5:30 – 7:30 PM").
const WINDOW_START = 16;
const WINDOW_END = 19;

const AXIS_TICKS = [
  { hour: 6, label: '6A' },
  { hour: 12, label: '12P' },
  { hour: 18, label: '6P' },
  { hour: 24, label: '12A' },
];

export default function HeroScoreCard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

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

  return (
    <div className="rounded border border-rc-rule bg-rc-panel shadow-rc-panel p-6 sm:p-8">
      <div className="text-center">
        {/* NOT "Updated 5 min ago". Every number on this card is hardcoded,
            the scoring fan-out is not a five-minute loop, and a static figure
            under a live badge is the one thing here a customer could catch us
            on. Same wording, and the same reasoning, as the /lp score card.
            See the note at the top of src/app/lp/_shared/lp-content.ts. */}
        <p className="font-rc-mono text-[10px] tracking-[0.2em] uppercase text-rc-ink-mute/80">
          Updated hourly
        </p>
        <p className="mt-1 font-rc-mono text-lg sm:text-xl tracking-[0.3em] uppercase text-rc-ink-mute">
          Reelcaster Score
        </p>
      </div>

      <div className="mt-7 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <span className="inline-block rounded bg-rc-brand-soft px-2 py-1 font-rc-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-rc-brand">
            Chinook · Peak Season
          </span>
          <h3 className="mt-2.5 text-2xl font-bold tracking-[-0.02em] text-rc-ink">
            Constance Bank
          </h3>
          <p className="mt-2.5 flex items-center gap-2 text-xs font-medium text-rc-ink">
            <span className="h-2 w-2 shrink-0 rounded-full bg-rc-good" />
            9 fresh catches logged in the last 14 days
          </p>
          <p className="mt-1.5 font-rc-mono text-[11px] text-rc-ink-mute">
            Best window 5:30 – 7:30 PM · Flood tide
          </p>
        </div>

        <div className="shrink-0 text-center">
          <div className="text-[68px] sm:text-[80px] leading-[0.85] font-bold tracking-[-0.04em] text-rc-good">
            82
          </div>
          <span className="mt-2 inline-block rounded bg-rc-good-bg px-4 py-1 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-good-ink">
            GOOD
          </span>
        </div>
      </div>

      <div className="mt-7">
        <div ref={chartRef} className="group flex h-14 items-end gap-[3px]">
          {DEMO_HOURS.map((score, i) => {
            const inWindow = i >= WINDOW_START && i <= WINDOW_END;
            const h = Math.max(5, (score / 100) * 56);
            return (
              <div
                key={i}
                className={`flex-1 rounded-[2px] transition-[height,background-color] duration-500 ease-out motion-reduce:transition-none ${
                  inWindow
                    ? 'bg-rc-good'
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
