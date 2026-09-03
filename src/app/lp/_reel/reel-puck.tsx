import type { CSSProperties } from "react";
import {
  COLLAR,
  HOT_TAG,
  PUCK,
  lighten,
  puckBox,
  puckPathData,
  type PuckRing,
} from "@/app/explore/lib/score-puck";
import { scoreColor } from "@/app/explore/lib/spot-geojson";

/**
 * The Explore map's score puck, as inline SVG.
 *
 * The map draws its pucks to a canvas (explore/lib/score-puck.ts) and hands
 * them to MapLibre as sprites. A landing page cannot do that: the reel is
 * server-rendered so its pins are in the first HTML, and there is no canvas
 * on the server. So this is the same puck drawn by the other rasteriser, in
 * the same paint order, from the same geometry object, the same outline
 * (puckPathData is puckPath's SVG twin) and the same colours.
 *
 * What it does NOT do is measure text. The canvas sizes the body to the
 * numeral it measured; here the width is estimated from the digit count at
 * the font's known advance. A two-digit score comes out at the map's 34px on
 * SF, Segoe and Roboto alike, which is every platform the map is looked at
 * on, and a pixel either way is not something a reader can see.
 *
 * Curated marks only (`rd`). The reel never shows a viewer's own spot, so the
 * square silhouette is not drawn here.
 */

/** 700 13px system digits are ~0.55em on SF Pro, Segoe UI and Roboto alike. */
const DIGIT_W = PUCK.SCORE_FONT.size * 0.555;
/** "Hot" at 800 10px: H + o + t on the same three faces. */
const TAG_W = PUCK.TAG_FONT.size * 1.73;

export default function ReelPuck({
  score,
  ring,
  hot,
  uid,
}: {
  score: number;
  /** The map's own ring states: plain, reports collar, or selected. */
  ring: PuckRing;
  /** Wear the "Hot" tag: reports exist here and there is a score to sit it above. */
  hot: boolean;
  /** Unique per puck on the page. Gradient and filter ids are document-global,
   *  and two pucks of different heights must not share a gradient. */
  uid: string;
}) {
  const label = String(score);
  const textW = Math.max(label.length * DIGIT_W, hot ? TAG_W : 0);
  const box = puckBox(textW, hot, "rd");
  const base = scoreColor(score);
  const collar = COLLAR[ring];
  const d = puckPathData(PUCK.PAD, PUCK.PAD, box.pillW, box.pillH, box.corner);
  const midX = PUCK.PAD + box.pillW / 2;
  const top = PUCK.PAD;
  const gradId = `rpg-${uid}`;
  const sheenId = `rps-${uid}`;
  const shadowId = `rpd-${uid}`;
  const text = {
    x: midX,
    textAnchor: "middle" as const,
    dominantBaseline: "central" as const,
    fill: "#ffffff",
    fontFamily: PUCK.FONT_FAMILY,
  };

  return (
    <svg
      className="reelpuck"
      viewBox={`0 0 ${box.w} ${box.h}`}
      width={box.w}
      height={box.h}
      style={
        {
          // Sized in the reel's own unit, so the puck scales with the phone
          // exactly as the still under it does.
          width: `calc(${box.w} * var(--sp))`,
          height: `calc(${box.h} * var(--sp))`,
        } as CSSProperties
      }
      aria-hidden
    >
      <defs>
        {/* Top of the body mixed toward white, running down to the tier colour.
            User-space units so the run covers the body and stops at the tail,
            as the canvas gradient does. */}
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={top + box.pillH}>
          <stop offset="0" stopColor={lighten(base, PUCK.LIGHTEN)} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
        {/* The sheen. The canvas clips a rect to the body; filling the body
            path with a gradient that has faded to nothing by the same depth is
            the same picture with no clipPath to name. */}
        <linearGradient id={sheenId} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={top + box.pillH * PUCK.SHEEN.depth}>
          <stop offset="0" stopColor="#ffffff" stopOpacity={PUCK.SHEEN.alpha} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Canvas shadowBlur is a Gaussian of roughly half its value in sigma. */}
        <filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy={PUCK.SHADOW.dy} stdDeviation={PUCK.SHADOW.blur / 2} floodColor={PUCK.SHADOW.color} />
        </filter>
      </defs>

      {/* Body, with the drop shadow attached to this fill only. */}
      <path d={d} fill={`url(#${gradId})`} filter={`url(#${shadowId})`} />

      {/* Collar, then the body again over it, so only the outer half of the
          centred stroke survives. Same trick as the canvas. */}
      {collar ? (
        <>
          <path d={d} fill="none" stroke={collar} strokeWidth={PUCK.COLLAR_W} strokeLinejoin="round" />
          <path d={d} fill={`url(#${gradId})`} />
        </>
      ) : null}

      <path d={d} fill={`url(#${sheenId})`} />

      {/* White ring last, over the fill, the sheen and the collar's inner half. */}
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={PUCK.RING_W} strokeLinejoin="round" />

      {hot ? (
        <>
          <text {...text} y={top + box.pillH * PUCK.TAG_Y_FRAC} fontSize={PUCK.TAG_FONT.size} fontWeight={PUCK.TAG_FONT.weight}>
            {HOT_TAG}
          </text>
          <text {...text} y={top + box.pillH * PUCK.SCORE_Y_FRAC} fontSize={PUCK.SCORE_FONT.size} fontWeight={PUCK.SCORE_FONT.weight}>
            {label}
          </text>
        </>
      ) : (
        <text {...text} y={top + box.pillH / 2 + 0.5} fontSize={PUCK.SCORE_FONT.size} fontWeight={PUCK.SCORE_FONT.weight}>
          {label}
        </text>
      )}
    </svg>
  );
}
