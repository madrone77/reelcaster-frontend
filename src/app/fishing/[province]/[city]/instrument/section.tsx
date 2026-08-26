// Section chrome for the instrument: a heading, three short claims, then the
// instrument itself.
//
// ── Why three claims and not a paragraph ─────────────────────────────────
//
// The first version of this explained how to READ each section, which is a
// reasonable thing to want and the wrong job for this page. A visitor who has
// clicked an ad is deciding whether this is worth their attention, not sitting
// down to learn a tool. Five lines of instruction under a heading reads like a
// manual, and nobody buys a manual.
//
// So each section makes three claims instead. The rule for writing one:
//
//   HEAD  what is impressive, in four words or fewer.
//   BODY  the concrete fact that makes the head true. A number wherever one
//         exists, because a real number is the only thing here that cannot be
//         written by a competitor.
//
// Things that are NOT allowed in a claim: vocabulary we invented ("peak",
// "fold", "RC score"), a superlative with nothing behind it ("the best
// forecast anywhere"), an instruction ("tap a day to..."), or any claim the
// product cannot keep. The interaction hints that used to live here are gone;
// the instruments carry their own, right where the hand is.
//
// ── Why not .rc-label ────────────────────────────────────────────────────
//
// `.rc-label` hard-codes `color: var(--rc-ink-mute)` (#8A919C) and
// rc-tokens.css is imported AFTER Tailwind, so a `text-*` utility beside it
// has EQUAL specificity and loses on source order. Headings written as
// `rc-label text-rc-ink` rendered at #8A919C, which is 3.18:1 on white and
// fails AA. Measured in the browser, not guessed. The treatment is spelled
// out here instead so the colour is ours.

import type { ReactNode } from "react";

export interface SectionClaim {
  /** Four words or fewer. Set larger than the line under it. */
  head: string;
  /** The fact that earns the head. One sentence. */
  body: ReactNode;
}

export default function Section({
  title,
  claims,
  aside,
  children,
  id,
}: {
  /** A real heading, in words, not a token label. */
  title: string;
  /** Exactly three. Two looks unfinished and four stops being scannable. */
  claims: [SectionClaim, SectionClaim, SectionClaim];
  /** Attribution or a count, set small beside the heading. */
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded border border-rc-rule bg-rc-panel px-4 py-5 lg:px-6 lg:py-6"
    >
      {/* One wrapping flex row, re-ordered at `sm`. On a wide screen the
          attribution sits on the heading's baseline at the right and the
          claims fill the row under it. On a phone that attribution would land
          BETWEEN the heading and the claims, so it is ordered last there and
          the reader goes straight from the title into the three points. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="order-1 text-[19px] font-semibold text-rc-ink leading-tight">
          {title}
        </h2>
        {aside && (
          <span className="order-3 sm:order-2 w-full sm:w-auto font-rc-mono text-[10px] text-rc-ink-soft italic shrink-0">
            {aside}
          </span>
        )}

        {/* Three across on a desktop, stacked on a phone. A phone reader
            scrolls past these to the instrument, so they stack rather than
            each taking a 120px column. */}
        <ul className="order-2 sm:order-3 w-full mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-3">
          {claims.map((c) => (
            <li key={c.head}>
              <h3 className="text-[15px] font-semibold text-rc-ink leading-snug">
                {c.head}
              </h3>
              {/* ink-soft (#5A616B, 6.6:1), never ink-mute, which is 3.18:1 on
                  white and fails AA at this size. */}
              <p className="text-[13px] leading-relaxed text-rc-ink-soft mt-1">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}
