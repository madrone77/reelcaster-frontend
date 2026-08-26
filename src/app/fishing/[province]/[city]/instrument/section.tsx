// Section chrome for the instrument, and the plain-English note under each
// heading that says how to read it.
//
// ── Why the note exists ──────────────────────────────────────────────────
//
// This page is bought traffic. The reader has never seen a fishing score
// before, has no idea a number out of 100 is a forecast rather than a rating
// somebody left, and does not know a chart on a city page belongs to one
// specific piece of water. Every one of those is obvious to us and to nobody
// arriving from an ad. An instrument nobody can read is a picture.
//
// So the rule for `how`: say what the thing IS, what the number MEANS, and
// what to DO with it, in the words somebody would use out loud. No jargon we
// invented, no "RC score", no "fold", no "peak". Short sentences.
//
// ── Why not .rc-label ────────────────────────────────────────────────────
//
// `.rc-label` hard-codes `color: var(--rc-ink-mute)` (#8A919C) and
// rc-tokens.css is imported AFTER Tailwind, so a `text-*` utility beside it
// has EQUAL specificity and loses on source order. Headings written as
// `rc-label text-rc-ink` therefore rendered at #8A919C, which is 3.18:1 on
// white and fails AA. Measured in the browser, not guessed. The uppercase
// treatment is spelled out here instead, the same way the hub's `Label` does
// it, so the colour is ours.

import type { ReactNode } from "react";

export default function Section({
  title,
  how,
  aside,
  children,
  id,
}: {
  /** A real heading, in words, not a token label. */
  title: string;
  /**
   * How to read this section, for somebody who has never seen it.
   *
   * One or two short sentences. It is NOT a subtitle and NOT a sales line: if
   * it does not help a stranger use the thing underneath it, cut it.
   */
  how: ReactNode;
  /** Attribution or a count, set small and right of the heading. */
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="rounded border border-rc-rule bg-rc-panel px-4 py-5 lg:px-6 lg:py-6">
      {/* One wrapping flex row, re-ordered at `sm`. On a wide screen the
          attribution sits on the heading's baseline at the right and the note
          wraps under both. On a phone that same attribution would land BETWEEN
          the heading and the note, interrupting the read for exactly the
          person the note was written for, so it is ordered last there. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="order-1 text-[17px] font-semibold text-rc-ink leading-tight">
          {title}
        </h2>
        {aside && (
          <span className="order-3 sm:order-2 w-full sm:w-auto font-rc-mono text-[10px] text-rc-ink-soft italic shrink-0">
            {aside}
          </span>
        )}
        {/* ink-soft (#5A616B, 6.6:1), never ink-mute: this is body text a
            first-time reader is meant to actually read, not a caption. */}
        <p className="order-2 sm:order-3 w-full text-[13px] leading-relaxed text-rc-ink-soft mt-1.5 max-w-[68ch]">
          {how}
        </p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
