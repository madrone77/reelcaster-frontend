import { useId } from "react";
import {
  MAP_PUCK as P,
  NO_DATA_LABEL,
  lighten,
  mapPuckPaint,
  puckBox,
  puckPathData,
} from "../lib/score-puck";

/**
 * The Explore map's score puck, as inline SVG, for surfaces that are not a
 * MapLibre canvas: the nearby-spot card's satellite still, today.
 *
 * The map rasterises its pucks to a canvas (lib/score-puck.ts, drawPuck) and
 * hands them to MapLibre as sprites. This is that puck drawn a second way, in
 * the same paint order, from the same geometry (MAP_PUCK), the same outline
 * (puckPathData is puckPath's SVG twin), the same colours (mapPuckPaint) and
 * the same face (IBM Plex Mono via `--font-plex-mono`, which the map reads
 * off the document at raster time and this reads as a CSS var).
 *
 * The landing pages' reel-puck.tsx is the same idea for the reel, but it
 * deliberately reads PUCK, the larger ringed geometry, so the reel keeps its
 * size. This one follows the map.
 *
 * Width is estimated, not measured: Plex Mono digits advance 0.6em, so a
 * two-digit score sizes to the map's 30px body exactly.
 */

/** IBM Plex Mono digit advance, as a fraction of the font size. */
const DIGIT_EM = 0.6;

/** Tail tip, measured down from the top of the box. Position the box by this. */
export const MAP_PUCK_TIP_Y = P.PAD + P.PILL_H + P.TAIL_H;

export default function MapPuckSvg({ score, className }: { score: number | null; className?: string }) {
  const id = useId();
  const label = score === null || !Number.isFinite(score) ? NO_DATA_LABEL : String(Math.round(score));
  const textW = label.length * P.SCORE_FONT.size * DIGIT_EM;
  const box = puckBox(textW, false, "rd");
  const { fill: base, ink } = mapPuckPaint(score);
  const d = puckPathData(P.PAD, P.PAD, box.pillW, box.pillH, box.corner);
  const midX = P.PAD + box.pillW / 2;
  const top = P.PAD;
  const gradId = `${id}-g`;
  const sheenId = `${id}-s`;
  const shadowId = `${id}-d`;
  const inkShadowId = `${id}-i`;

  return (
    <svg
      viewBox={`0 0 ${box.w} ${box.h}`}
      width={box.w}
      height={box.h}
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={top + box.pillH}>
          <stop offset="0" stopColor={lighten(base, P.LIGHTEN)} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
        <linearGradient id={sheenId} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={top + box.pillH * P.SHEEN.depth}>
          <stop offset="0" stopColor="#ffffff" stopOpacity={P.SHEEN.alpha} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Canvas shadowBlur is a Gaussian of roughly half its value in sigma. */}
        <filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy={P.SHADOW.dy} stdDeviation={P.SHADOW.blur / 2} floodColor={P.SHADOW.color} />
        </filter>
        {/* The slight shadow the canvas puts under the glyphs so white holds on the lighter fills. */}
        <filter id={inkShadowId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(15, 23, 42, 0.45)" />
        </filter>
      </defs>

      {/* Body, with the drop shadow attached to this fill only. */}
      <path d={d} fill={`url(#${gradId})`} filter={`url(#${shadowId})`} />
      {/* Sheen across the top of the body. */}
      <path d={d} fill={`url(#${sheenId})`} />
      {P.RING_W > 0 ? (
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={P.RING_W} strokeLinejoin="round" />
      ) : null}

      <text
        x={midX}
        y={top + box.pillH / 2 + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill={ink}
        fontSize={P.SCORE_FONT.size}
        fontWeight={P.SCORE_FONT.weight}
        style={{ fontFamily: `var(--font-plex-mono), ${P.FONT_FAMILY}` }}
        filter={`url(#${inkShadowId})`}
      >
        {label}
      </text>
    </svg>
  );
}
