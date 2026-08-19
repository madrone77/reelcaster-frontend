/**
 * A small United States flag for the header trust chip on /lp/6.
 *
 * Drawn inline rather than set as the 🇺🇸 emoji on purpose. That emoji has no
 * glyph on most Windows builds and falls back to the letters "US" in a box,
 * which is exactly the sort of small broken detail this audience notices on a
 * page asking for a card. An inline SVG renders the same everywhere and costs
 * nothing over the wire, since the whole page is already one document.
 *
 * The star field is a staggered grid of dots, not fifty five-pointed stars.
 * At the 14px this renders at, real stars turn to mush and the canton reads as
 * a smudge; dots hold their shape and still read as the union. This is the
 * usual treatment for flag icons at small sizes.
 *
 * Marked aria-hidden because the chip's own text already says what data the
 * page runs on. The flag is a market cue, not information a screen reader
 * needs read out, and "United States flag" announced before "WDFW + NOAA
 * DATA" would be noise.
 */
export default function LpFlagUs({ size = 14 }: { size?: number }) {
  // 13 stripes over a 3:2 field. Height 14 keeps each stripe just over 1px,
  // which still resolves cleanly on a 2x phone screen.
  const stripes = Array.from({ length: 13 }, (_, i) => i);

  return (
    <svg
      width={size * 1.5}
      height={size}
      viewBox="0 0 30 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ borderRadius: 2, display: "block", flexShrink: 0 }}
    >
      <rect width="30" height="20" fill="#FFFFFF" />
      {stripes
        .filter((i) => i % 2 === 0)
        .map((i) => (
          <rect key={i} x="0" y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
        ))}
      {/* Canton: 2/5 of the width, 7/13 of the height, per the real ratios. */}
      <rect x="0" y="0" width="12" height={(7 * 20) / 13} fill="#3C3B6E" />
      {/* Staggered dot field standing in for the fifty stars. */}
      {[0, 1, 2, 3].map((row) =>
        Array.from({ length: row % 2 === 0 ? 5 : 4 }, (_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={1.6 + col * 2.2 + (row % 2 === 0 ? 0 : 1.1)}
            cy={1.6 + row * 2.6}
            r="0.7"
            fill="#FFFFFF"
          />
        )),
      )}
    </svg>
  );
}
