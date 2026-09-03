'use client';

import { useEffect, useRef, useState } from 'react';
import PhoneFrame from '@/app/(marketing)/components/phone-frame';
import SpotHeroPhone from '@/app/(marketing)/components/spot-hero-phone';
import type { SpotHeroFeed } from '@/app/(marketing)/components/spot-hero-feed';

/**
 * The WHERE / WHAT / WHEN picture, drawn rather than photographed.
 *
 * `/lp/<city>/1` shows this as a PNG: a real iPhone screenshot of one spot
 * page with three arrows pasted on it in an image editor. It went stale the
 * way every screenshot does, and it is the one phone on the family of pages
 * that is not the product itself. The reel above it, the conditions phone on
 * /4 and the homepage's spot slide are all the app's own components inside a
 * CSS device. This is that same treatment for the same three-beat picture:
 * the homepage's SpotHeroPhone -- the real SpeciesCardRow, ScoreCard and
 * SpotMiniMap on today's payload -- inside the same PhoneFrame, with the
 * three callouts laid over it.
 *
 * ── The arrows are measured, not placed ──────────────────────────────────
 *
 * Each callout points at a row of the rendered page: the mark's name, the
 * selected species card, and the best-window box. Those rows move -- a
 * two-line mark name pushes everything under it down, a third species widens
 * the card row, a closed fishery drops the window -- so their positions are
 * read off the DOM after layout rather than typed in. An arrow pointing at
 * the wrong line is worse than no arrow at all. They are re-read on resize
 * and whenever the selected card changes, because the phone is live: tap a
 * species and the "What?" arrow follows.
 *
 * The rows are found by what they ARE (the page's h2, the pressed card, the
 * BEST WINDOW label) rather than by a y band, for the same reason.
 *
 * ── The gutters are part of the picture ──────────────────────────────────
 *
 * The callouts hang outside the device on purpose, as they did on the
 * photograph: the words are the explainer, and inside the screen they would
 * cover the thing they explain. `LEFT` and `RIGHT` are the room they get, and
 * they are the component's own width, so a capture of this element is the
 * whole picture with nothing to crop.
 */

/** Room outside the device for the callouts, CSS px. */
const LEFT = 250;
const RIGHT = 60;
/** Room under the device for PhoneFrame's own drop shadow. */
const BOTTOM = 64;
/**
 * The device, at the width a real 375px screen fits inside a real bezel.
 *
 * A literal class, not a template: Tailwind generates utilities by scanning
 * source for the string, and `w-[${n}px]` is a string it never sees. The
 * first capture of this was a 310px-wide picture of a collapsed frame.
 */
const DEVICE = "w-[397px]";

/**
 * The device's own height at that width: PhoneFrame's 840 screen units at
 * `--sp` = 94cqw/375, plus 3cqw of bezel top and bottom. Stated rather than
 * measured because the fitted picture below needs it before anything has
 * rendered.
 */
const DEVICE_H = 860;

/** The picture's own size, CSS px. What the capture script shoots. */
export const PICTURE_W = LEFT + 397 + RIGHT;
export const PICTURE_H = DEVICE_H + BOTTOM;

/**
 * The scale the picture is SHOWN at on the landing page, and it is the
 * other two phones' number, not this one's: city1-css.ts draws the
 * conditions phone and the alert phone at 397 and shows them at .7, a fixed
 * 278px at every width, so the three screens under the hero are one size.
 * The same rule is a string in that stylesheet and cannot be imported;
 * change both or the picture is the odd phone out again.
 */
const SHOWN = 0.7;

/** One callout's geometry: slab height, head height, head length. */
const SLAB = 78;
const HEAD_H = 152;
const HEAD_W = 86;
/**
 * The shortest slab that still holds a label. The left-hand callouts always
 * get it (LEFT is sized for them); the right-hand one gets it by extending
 * its tail past the gutter when its target sits far to the right, which the
 * one-species fallback (the header pill) does. The SVG overflows on purpose.
 */
const MIN_SLAB = 150;

interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

interface Targets {
  name: Box;
  card: Box | null;
  window: Box | null;
}

/**
 * One callout: a slab with a triangular head, pointing at a row.
 *
 * `dir` is the way the head points, so a callout can come in from either side
 * without a second path to keep in step with this one. Corners are rounded by
 * stroking the shape in its own colour, which is cheaper than a rounded path
 * and keeps the geometry above readable.
 */
function Arrow({
  label,
  dir,
  tipX,
  tipY,
  tail,
}: {
  label: string;
  dir: 'left' | 'right';
  tipX: number;
  tipY: number;
  tail: number;
}) {
  const s = dir === 'right' ? 1 : -1;
  const neck = tipX - s * HEAD_W;
  const d = [
    `M${tipX},${tipY}`,
    `L${neck},${tipY - HEAD_H / 2}`,
    `L${neck},${tipY - SLAB / 2}`,
    `L${tail},${tipY - SLAB / 2}`,
    `L${tail},${tipY + SLAB / 2}`,
    `L${neck},${tipY + SLAB / 2}`,
    `L${neck},${tipY + HEAD_H / 2}`,
    'Z',
  ].join('');
  return (
    <g filter="url(#wwv-shadow)">
      <path
        d={d}
        fill="#262626"
        stroke="#262626"
        strokeWidth={10}
        strokeLinejoin="round"
      />
      <text
        x={(neck + tail) / 2}
        y={tipY}
        fill="#fff"
        fontSize={40}
        fontWeight={800}
        fontFamily="var(--font-inter), Inter, -apple-system, Helvetica, Arial, sans-serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

export default function WhereWhatWhenPhone({
  feed,
  serverNowMs,
  deferMap = false,
}: {
  feed: SpotHeroFeed;
  /** The instant the server baked this HTML. See useSpotClock. */
  serverNowMs: number;
  /** Hold the mini map until the phone is near the viewport. See SpotHeroPhone. */
  deferMap?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const measure = () => {
      const h = el.getBoundingClientRect();
      // Client rects are measured AFTER any transform on an ancestor, and
      // WhereWhatWhenPicture scales this whole element to fit its column.
      // The SVG below is drawn inside that transform, in the element's own
      // untransformed pixels, so every rect is divided back by the scale or
      // the callouts land short of their rows by exactly the amount the
      // picture was shrunk. offsetWidth is the layout width, unscaled.
      const k = el.offsetWidth ? h.width / el.offsetWidth : 1;
      const box = (node: Element | null): Box | null => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return {
          top: (r.top - h.top) / k,
          left: (r.left - h.left) / k,
          right: (r.right - h.left) / k,
          bottom: (r.bottom - h.top) / k,
        };
      };
      const leaf = (tag: string, re: RegExp) =>
        [...el.querySelectorAll(tag)].find(
          (n) =>
            n.children.length === 0 && re.test((n.textContent ?? '').trim()),
        ) ?? null;

      const name = box(el.querySelector('h2'));
      if (!name) return;

      // The pressed card, found by walking down from the SPECIES kicker
      // rather than by asking the whole screen for a pressed button: the
      // mini map's layer toggles are pressed buttons too, and a mark with
      // one species draws no card row at all, at which point the first
      // pressed button on the screen is "Bathymetry". When there is no row,
      // the pill in the header that names the species and its status is
      // what says "what", and the callout lands there instead.
      const kicker = leaf('div', /^species$/i);
      const row = kicker?.parentElement?.parentElement ?? null;
      const card = box(
        row?.querySelector('button[aria-pressed="true"]') ??
          leaf('span', /·\s*(open|release|closed)$/i),
      );
      const window = box(leaf('div', /^best window$/i)?.parentElement ?? null);
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
      setTargets({ name, card, window });
    };

    measure();
    // Fonts change the width of the name and the cards; measure again once
    // they are in.
    document.fonts?.ready.then(measure).catch(() => {});

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The pressed card moves when a reader taps another species.
    const mo = new MutationObserver(measure);
    mo.observe(el, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-pressed'],
    });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div
      ref={host}
      data-wwv
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: `0 ${RIGHT}px ${BOTTOM}px ${LEFT}px`,
        background: 'transparent',
      }}
    >
      <PhoneFrame
        width={DEVICE}
        label={`The ReelCaster spot page for ${feed.spot.name} on a phone. Arrows label the spot name as Where, the species score card as What, and the best window as When.`}
      >
        <SpotHeroPhone feed={feed} serverNowMs={serverNowMs} deferMap={deferMap} />
      </PhoneFrame>

      {targets && size && (
        <svg
          aria-hidden
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <defs>
            <filter id="wwv-shadow" x="-20%" y="-20%" width="150%" height="150%">
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="7"
                floodColor="#000"
                floodOpacity="0.22"
              />
            </filter>
          </defs>
          <Arrow
            label="Where?"
            dir="right"
            tipX={targets.name.left - 2}
            tipY={(targets.name.top + targets.name.bottom) / 2}
            tail={0}
          />
          {targets.card && (
            <Arrow
              label="What?"
              dir="left"
              tipX={targets.card.right + 8}
              tipY={(targets.card.top + targets.card.bottom) / 2}
              tail={Math.max(size.w, targets.card.right + 8 + HEAD_W + MIN_SLAB)}
            />
          )}
          {targets.window && (
            <Arrow
              label="When?"
              dir="right"
              tipX={targets.window.left + 44}
              tipY={(targets.window.top + targets.window.bottom) / 2}
              tail={0}
            />
          )}
        </svg>
      )}
    </div>
  );
}

/**
 * The picture, fitted to the column it is given.
 *
 * WhereWhatWhenPhone lays itself out at one size, PICTURE_W by PICTURE_H,
 * because the app inside it needs its 375px and the callouts are sized to be
 * read at 1x. A landing-page column is narrower than that, and shrinking the
 * box instead would push the components under their measuring floors and wrap
 * a spot page at a width no iPhone has, which is the lesson the homepage
 * carousel learned (see (marketing)/components/product-carousel.tsx). So the
 * picture is drawn at full size and SCALED, the way that carousel shows its
 * devices at 65%.
 *
 * The scale is the column's width over the picture's, capped at SHOWN so the
 * phone inside comes out the same 278px as the two phones beside it in the
 * page, and it is computed in CSS rather than measured in JS so the server
 * render is already the right size and nothing jumps at hydration. The cap
 * is the box's max-width: at SHOWN the picture is PICTURE_W * SHOWN wide, and
 * a box that wide resolves cqw to exactly that scale.
 *
 * The PHONE is centred, not the picture. The callouts hang further out on
 * the left than the right, so centring the box put the device 66px right of
 * the axis the alert phone under it sits on. The left margin places the
 * device's centre on the column's centre wherever there is room, and falls
 * back to a left-aligned box where there is not, which is the fit case. `tan(atan2(a, b))` is the
 * standard way to divide two lengths into a unitless number, and `cqw` reads
 * the box's width from a descendant: an element cannot query its own size, so
 * the unit sits on the child and the container-type on the box. The box keeps
 * the picture's aspect ratio, so the page reserves the right height and the
 * caption under it does not move when the phone scales.
 */
export function WhereWhatWhenPicture(props: {
  feed: SpotHeroFeed;
  serverNowMs: number;
  deferMap?: boolean;
}) {
  return (
    <div
      style={{
        containerType: 'inline-size',
        position: 'relative',
        width: '100%',
        maxWidth: PICTURE_W * SHOWN,
        aspectRatio: `${PICTURE_W} / ${PICTURE_H}`,
        marginLeft: `max(0px, calc(50% - ${(LEFT + 397 / 2) * SHOWN}px))`,
        marginRight: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: PICTURE_W,
          height: PICTURE_H,
          transformOrigin: 'top left',
          transform: `scale(min(1, tan(atan2(100cqw, ${PICTURE_W}px))))`,
        }}
      >
        <WhereWhatWhenPhone {...props} />
      </div>
    </div>
  );
}
