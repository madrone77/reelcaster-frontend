// The hub's shared vocabulary: one type scale, one chip, one label.
//
// This exists because the block grew a component at a time and ended up with
// eight font sizes (10, 11, 12, 13, 15, 17, 21, 26), four corner radii and
// three different chip treatments sitting in a single row on one card. Every
// one of those was defensible where it was written and none of them agreed
// with each other, which is what made a page of correct components read as
// untidy.
//
// Nothing here is new design. It is the existing rc token set, narrowed to
// the handful of steps this block actually needs, so a new element has an
// obvious size to be rather than a plausible one.

import type { ReactNode } from "react";

// ── Type ────────────────────────────────────────────────────────────────
//
// Five steps and one rule: MONO carries values you compare (scores, clock
// times, counts), SANS carries words you read. The old block mixed them by
// component rather than by purpose, so a spot name and a tide phase were set
// in the same face as a score.

export const TYPE = {
  /** The one number the hero exists to show. */
  display: "text-[30px] sm:text-[38px] font-bold leading-[1.05] tracking-tight",
  /** A featured card's subject. */
  title: "text-[21px] sm:text-[24px] font-bold leading-tight",
  /** Section heading. */
  heading: "text-[17px] font-semibold",
  /** A row's subject: a spot name, a species name. */
  item: "text-[15px] font-semibold",
  /** Running prose. */
  body: "text-[14px] leading-relaxed",
  /** Secondary line under an item. */
  meta: "text-[12px]",
  /** A value read as data. */
  value: "font-rc-mono text-[13px] font-semibold tabular-nums",
} as const;

// ── Rhythm ──────────────────────────────────────────────────────────────
//
// Two radii, not four: `card` for everything in the flow, `panel` for the two
// elements that sit above it (the hero and the spotlight). One card padding.

export const CARD = "rounded-xl border border-rc-rule bg-rc-panel";
export const PANEL = "rounded-2xl shadow-rc-panel";
export const PAD = "p-4";

/**
 * The small uppercase label.
 *
 * Not `.rc-label`. That class hard-codes `color: var(--rc-ink-mute)` and
 * rc-tokens.css is imported after Tailwind, so a `text-*` utility beside it
 * has equal specificity and loses on source order — which pins every label to
 * 2.8:1 on a light surface. Taking the colour as a prop keeps it legible on
 * both grounds.
 */
export function Label({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  /** `muted` on paper, `onDark` on the navy hero, `onAccent` on emerald. */
  tone?: "muted" | "onDark" | "onAccent";
}) {
  const color =
    tone === "onDark"
      ? "text-slate-400"
      : tone === "onAccent"
        ? "text-rc-navy-deep"
        : "text-rc-ink-soft";
  return (
    <span
      className={`font-rc-mono text-[10px] font-semibold uppercase leading-3 tracking-[0.08em] ${color}`}
    >
      {children}
    </span>
  );
}

/**
 * The one chip.
 *
 * A card used to carry a brand-soft sans chip, an emerald mono chip, a
 * bordered mono chip and a bare sans string in the same row, which reads as
 * four unrelated things rather than one row of attributes. Same shape and
 * size for all of them; only the tone changes, and only one `accent` per row.
 */
export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  /** `accent` is the row's one highlight; `brand` marks a standing fact
   *  about the place rather than a fact about today. */
  tone?: "neutral" | "accent" | "brand";
}) {
  const tones = {
    neutral: "bg-rc-surface text-rc-ink-soft",
    accent: "bg-rc-emerald-deep text-white",
    brand: "bg-rc-brand-soft text-rc-brand",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A labelled value, as used in the hero bar and the spotlight grid. */
export function Stat({
  label,
  value,
  tone = "light",
}: {
  label: string;
  value: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className="min-w-0">
      <Label tone={tone === "dark" ? "onDark" : "muted"}>{label}</Label>
      <div
        className={`${TYPE.value} mt-1 truncate ${
          tone === "dark" ? "text-white" : "text-rc-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
