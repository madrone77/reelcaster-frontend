"use client";

import { useEffect, useRef, useState } from "react";

const DEMO_SCORE = 82;
const DEMO_SPARK = [22, 28, 34, 45, 58, 68, 76, 82, 79, 70, 58, 44, 33, 26];

/** Same soft-tint tier language used across the app (rc-good/fair/poor). */
function tierFor(score: number) {
  if (score >= 75) return { label: "Good", bg: "bg-rc-good-bg", ink: "text-rc-good-ink", stroke: "#16A34A" };
  if (score >= 55) return { label: "Fair", bg: "bg-rc-fair-bg", ink: "text-rc-fair-ink", stroke: "#D78711" };
  return { label: "Poor", bg: "bg-rc-poor-bg", ink: "text-rc-poor-ink", stroke: "#DC2626" };
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const bw = 100 / values.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-10" aria-hidden>
      {values.map((v, i) => {
        const rel = (v - min) / span;
        const h = Math.max(3, rel * 36);
        const active = v >= max * 0.75;
        return (
          <rect
            key={i}
            x={(i * bw + bw * 0.2).toFixed(1)}
            y={(40 - h).toFixed(1)}
            width={(bw * 0.6).toFixed(1)}
            height={h.toFixed(1)}
            rx={1}
            fill={active ? stroke : "var(--rc-rule)"}
          />
        );
      })}
    </svg>
  );
}

/**
 * The hero visual — matches the Figma "hero-score-card" spec: label + relative
 * timestamp, species/season tag, spot name beside a large tier-colored score,
 * a recent-activity line, best window, and an hourly sparkline.
 */
export default function ScoreHero() {
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(DEMO_SCORE);
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * DEMO_SCORE));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const tier = tierFor(DEMO_SCORE);

  return (
    <div
      className="w-full max-w-md rounded border border-rc-rule bg-rc-panel p-6"
      style={{ boxShadow: "var(--rc-shadow-panel)" }}
    >
      <div className="flex items-baseline justify-between">
        <span className="rc-label text-[10px]">Reelcaster Score</span>
        <span className="font-rc-mono text-[10px] text-rc-ink-mute">Updated 5 min ago</span>
      </div>

      <div className="flex items-center justify-between gap-3 mt-5">
        <span className="inline-flex px-2 py-0.5 rounded bg-rc-brand-soft font-rc-mono text-[10px] font-semibold text-rc-brand uppercase tracking-[0.04em]">
          Chinook · Peak season
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[40px] leading-none font-bold tracking-[-0.03em] tabular-nums text-rc-good"
            aria-label={`Fishing score ${DEMO_SCORE} out of 100, ${tier.label}`}
          >
            {n}
          </span>
          <span className={`px-2 py-0.5 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.04em] ${tier.bg} ${tier.ink}`}>
            {tier.label}
          </span>
        </div>
      </div>

      <p className="text-2xl font-bold text-rc-ink mt-3">Constance Bank</p>

      <div className="flex items-center gap-1.5 mt-4 font-rc-mono text-xs text-rc-ink">
        <span className="w-1.5 h-1.5 rounded-full bg-rc-good shrink-0" />
        9 fresh catches logged in the last 14 days
      </div>
      <p className="font-rc-mono text-xs text-rc-ink-mute mt-1">Best window 5:30–7:30 PM · Flood tide</p>

      <div className="mt-4 pt-4 border-t border-rc-rule-soft">
        <Sparkline values={DEMO_SPARK} stroke={tier.stroke} />
        <div className="flex justify-between font-rc-mono text-[9px] text-rc-ink-mute mt-1 uppercase tracking-[0.06em]">
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>
      </div>
    </div>
  );
}
