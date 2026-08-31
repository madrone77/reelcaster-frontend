/**
 * The look of a forecast day you have not paid for.
 *
 * A locked day used to be an empty grey slot with a padlock on it, which reads
 * as "nothing here" rather than "something here you can't have yet". This is
 * the other reading: a score behind frosted glass. Green where the number
 * would be, blurred past legibility, under a thin grey wash.
 *
 * There is no number under the blur, and that is deliberate. Both forecast
 * proxies null the score grid for every day past the caller's horizon before
 * the payload leaves the server (see api/bluecaster/{map,spots/[slug]}
 * /forecast-14d), which is what makes the wall a wall instead of a CSS filter
 * anyone can lift in devtools. So the shapes here are decorative and
 * aria-hidden: slabs and bars in the good-score green, never text. A real
 * number would have to be either invented or given away, and a shape is
 * honester than both.
 *
 * The green is always the GOOD green, on every locked day, because we do not
 * know that day's tier either. It is the shape of a reading, not a claim about
 * this one — the tile's own words ("Sign up free" / "Upgrade to Pro") are what
 * say what it costs to find out.
 *
 * One definition for every surface that draws a locked day, so the lock reads
 * the same on the strip, the pill rail and a spot card. Add a variant here
 * rather than a fifth copy of the CSS somewhere else.
 */

/**
 * Which locked slot this is filling.
 *
 * - `cell`   — a forecast-strip DayCell (~52x101): desktop strip, spot page,
 *              city instrument page. Two slabs where the 28px numeral sits.
 * - `tile`   — a mobile date-pill-rail tile (52x52). One block, no room for two.
 * - `card`   — a spot card's labelled day cell (~40x38). Same, smaller.
 * - `track`  — one bar of the compact spot-card strip (a sliver, 32px tall).
 */
export type GauzeVariant = "cell" | "tile" | "card" | "track";

/** Ghost geometry per variant: where the green sits and how hard it is blurred. */
const GHOST: Record<GauzeVariant, string> = {
  cell: "translate-y-[13px] gap-2",
  tile: "translate-y-[6px]",
  card: "translate-y-[5px]",
  track: "",
};

/**
 * How heavy the wash is.
 *
 * A bigger slot shows more green through the same alpha, so the small ones sit
 * a step lighter to land in the same place: visibly green, never readable.
 *
 * Only the two big variants pay for `backdrop-blur`. There are at most
 * fourteen of those on a screen, and the frosted-glass edge is worth a
 * compositing pass at that size. The card variants are drawn per spot card:
 * a browse list of twenty cards is 240 locked slots, and 240 backdrop-filter
 * layers is a scroll-jank bill for an effect nobody can see at 20x14px. The
 * ghost under them carries its own `blur()` either way, so what is lost is
 * the blurring of the tile's own border, not the blurring of the green.
 */
const WASH: Record<GauzeVariant, string> = {
  cell: "bg-rc-surface/40 backdrop-blur-[2px]",
  tile: "bg-rc-surface/55 backdrop-blur-[2px]",
  card: "bg-rc-surface/55",
  track: "bg-rc-surface/50",
};

function Ghost({ variant }: { variant: GauzeVariant }) {
  if (variant === "cell") {
    return (
      <>
        <div className="flex items-end gap-[7px] blur-[5px]">
          <span className="block h-8 w-4 rounded-[3px] bg-rc-good" />
          <span className="block h-8 w-4 rounded-[3px] bg-rc-good" />
        </div>
        {/* Stands in for the peak-time chip, so the tile's whole shape is
            under the glass and not just its number. */}
        <span className="block h-[14px] w-10 rounded bg-rc-good/25 blur-[4px]" />
      </>
    );
  }
  if (variant === "tile") {
    return <span className="block h-4 w-6 rounded-[2px] bg-rc-good blur-[4px]" />;
  }
  if (variant === "card") {
    return <span className="block h-3.5 w-5 rounded-[2px] bg-rc-good blur-[3px]" />;
  }
  // track: the whole slot, not a bar. The compact strip has no numerals to
  // hide, so what is behind the glass here is the bar's HEIGHT — and a
  // half-height green block would be read as that height. Filling the slot
  // says "this column is hidden" and cannot be mistaken for a reading.
  return <span className="block h-full w-full bg-rc-good/80 blur-[3px]" />;
}

/**
 * Drop into any `relative overflow-hidden` locked slot, above the slot's own
 * background and below its crisp content (give that content `relative`, or a
 * wrapper with it — positioned layers paint over static ones whatever the DOM
 * order says).
 */
export default function LockedGauze({ variant }: { variant: GauzeVariant }) {
  return (
    <>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center ${GHOST[variant]}`}
      >
        <Ghost variant={variant} />
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${WASH[variant]}`}
      />
    </>
  );
}
