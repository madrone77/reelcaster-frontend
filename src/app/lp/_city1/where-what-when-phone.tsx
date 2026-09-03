'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
 * cover the thing they explain. `GUTTER` is the room they get on each side,
 * and it is the component's own width, so a capture of this element is the
 * whole picture with nothing to crop. Every slab ends at the picture's edge
 * and nothing is drawn past it: the picture sits in a column, and a callout
 * that overran it was cut off wherever the column ended.
 */

/**
 * Room outside the device for the callouts, CSS px, the same on both sides.
 *
 * The photograph had 250 on the left and 60 on the right, because its
 * "What?" pointed at a species card left of centre and its slab ran off the
 * edge of a picture that could be cropped there. Drawn live, the target
 * moves: a one-species mark has no card row and the callout lands on the
 * header pill at the far right, where 60px holds neither a head nor a label.
 * Equal gutters give the right-hand callout the room the left-hand ones
 * have, and put the device on the centre line of its own box, so the box is
 * centred in its column like the other two phones' rather than nudged by a
 * margin. The sum is the old 310, so the picture is still 707 wide and shows
 * at the same size it did.
 */
const GUTTER = 155;
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
export const PICTURE_W = GUTTER + 397 + GUTTER;
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

/**
 * One callout's geometry: slab height, head height, head length, outline
 * width, label size.
 *
 * Smaller than the photograph's 78 / 152 / 86, which were cut for a 250
 * gutter. The left-hand slab is what is left of the gutter after the head
 * and the row's own inset, about 120px, and the label has to sit in it: a
 * 28px "Where?" is about 100. The head keeps the photograph's proportion.
 * A 152-tall head was also the wrong size for the rows it lands on: centred
 * on the 19px header pill it reached up and sat on the app bar's button.
 */
const SLAB = 60;
const HEAD_H = 92;
const HEAD_W = 52;
const STROKE = 8;
const FONT = 28;
/**
 * How far short of its row a tip stops. The outline is stroked centred on
 * the path, so half of it lies past the tip, and a tip put on the row's
 * edge had that half sitting on the first glyph of the mark's name.
 */
const GAP = 8;

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
  /** The bottom of the app bar's button, which no head may reach up to. */
  ceiling: number;
}

/**
 * A head centred on its row, cut down when the row sits close under the
 * app bar. The header pill is 26px below the bar's button, less than half
 * a head, and a full head centred on it covered the button's corner. The
 * head is shortened to the room the pill has, no further than a stub past
 * the slab, and the tip is dropped by whatever room is still missing, which
 * keeps it on the pill. Rows lower on the screen have the room and get the
 * full head.
 */
function fitHead(row: Box, ceiling: number) {
  let tipY = (row.top + row.bottom) / 2;
  const room = 2 * (tipY - ceiling - STROKE);
  const headH = Math.min(HEAD_H, Math.max(SLAB + 12, room));
  if (room < headH) tipY += (headH - room) / 2;
  return { tipY, headH };
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
  headH = HEAD_H,
}: {
  label: string;
  dir: 'left' | 'right';
  tipX: number;
  tipY: number;
  /** Where the slab ends: the picture's edge on the callout's own side. */
  tail: number;
  headH?: number;
}) {
  const s = dir === 'right' ? 1 : -1;
  const neck = tipX - s * HEAD_W;
  const d = [
    `M${tipX},${tipY}`,
    `L${neck},${tipY - headH / 2}`,
    `L${neck},${tipY - SLAB / 2}`,
    `L${tail},${tipY - SLAB / 2}`,
    `L${tail},${tipY + SLAB / 2}`,
    `L${neck},${tipY + SLAB / 2}`,
    `L${neck},${tipY + headH / 2}`,
    'Z',
  ].join('');
  return (
    <g filter="url(#wwv-shadow)">
      <path
        d={d}
        fill="#262626"
        stroke="#262626"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Centred in the slab, leaning a little towards the head: the head's
          base is taller than the slab, so a label that is wider than a short
          slab runs into the head rather than off the tail. */}
      <text
        x={(neck + tail) / 2 + s * 8}
        y={tipY}
        fill="#fff"
        fontSize={FONT}
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
      // The app bar's button, from PhoneFrame. See fitHead.
      const ceiling = box(leaf('span', /^start free trial$/i))?.bottom ?? 0;
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
      setTargets({ name, card, window, ceiling });
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
        padding: `0 ${GUTTER}px ${BOTTOM}px`,
        background: 'transparent',
      }}
    >
      <PhoneFrame
        width={DEVICE}
        label={`The ReelCaster spot page for ${feed.spot.name} on a phone. Arrows label the spot name as Where, the species score card as What, and the best window as When.`}
      >
        <SpotHeroPhone
          feed={feed}
          serverNowMs={serverNowMs}
          deferMap={deferMap}
          regsLink={false}
        />
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
            tipX={targets.name.left - GAP}
            tail={0}
            {...fitHead(targets.name, targets.ceiling)}
          />
          {targets.card && (
            <Arrow
              label="What?"
              dir="left"
              tipX={targets.card.right + GAP}
              tail={size.w}
              {...fitHead(targets.card, targets.ceiling)}
            />
          )}
          {targets.window && (
            // The window is a filled panel, not a line of text, and a tip
            // stopped at a panel's edge reads as pointing at the edge. The
            // photograph's tip sat inside the panel; so does this one.
            <Arrow
              label="When?"
              dir="right"
              tipX={targets.window.left + HEAD_W / 2}
              tail={0}
              {...fitHead(targets.window, targets.ceiling)}
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
 * page. The cap is the box's max-width: at SHOWN the picture is PICTURE_W *
 * SHOWN wide, and a box that wide resolves to exactly that scale. The box
 * keeps the picture's aspect ratio, so the page reserves the right height and
 * the caption under it does not move when the phone scales.
 *
 * The box is centred in its column, and because the gutters are equal that
 * centres the device too, on the axis the alert phone under it sits on. The
 * photograph's unequal gutters needed a margin computed to put the device
 * there, and in the fit case, where there was no room for it, the device sat
 * right of centre with its right-hand callout cut off.
 *
 * ── The number is written twice: once in CSS, once measured ──────────────
 *
 * The server render has to be the right size already, or the page jumps at
 * hydration, so the scale is first stated in CSS: `cqw` reads the box's width
 * from a descendant (an element cannot query its own size, so the unit sits
 * on the child and the container-type on the box) and the stylesheet divides
 * it by the picture's width. Dividing two lengths into a number is the
 * catch. `tan(atan2(a, b))` was the standard trick and Chrome and Firefox
 * compute it, but WebKit gets it wrong whenever the lengths cannot be
 * resolved at parse time: atan2() hands back degrees and the tan() around it
 * reads them as radians. On a 390px phone that made the scale 2.6, the min()
 * capped it at 1, and the picture stood at full size across the column with
 * arrows the height of the hero (2026-09-03, an iPhone screenshot, reproduced
 * in Playwright's WebKit). `calc(100cqw / 707px)` says the same thing without
 * trigonometry; it is CSS Values 4 typed arithmetic, which WebKit and Chrome
 * evaluate correctly and an older engine drops at parse time. It is listed
 * second so it wins wherever it parses and gives way to the trig where it
 * does not.
 *
 * Then, once the component is on the page, it measures the box and writes the
 * number itself as an inline style, which beats the stylesheet and which every
 * engine can apply. In Chrome that is the number the stylesheet already
 * produced, so nothing moves; in a WebKit too old for typed arithmetic it is
 * the moment the picture snaps to size. A layout effect, so it lands before
 * the first client paint.
 *
 * The picture's width reaches the rule as a custom property, `--wwv-w`, set
 * on the box, rather than being interpolated into the string. The first
 * version interpolated it, as two template literals joined with +, and the
 * production server bundle's minifier folded them into one literal and lost
 * the tail of the first: `707px))));` came out as `707`, the rule was
 * unbalanced, and every engine dropped it, so the first paint was unscaled
 * everywhere until the layout effect ran (2026-09-03, seen on
 * www.reelcaster.com and reproduced with `next build`; the client bundle,
 * compiled to a different target, kept the string). The dev server never
 * showed it. Plain single-quoted strings with nothing to substitute give the
 * minifier nothing to fold.
 */
const FIT_CSS =
  '.wwv-fit{' +
  'transform:scale(min(1,tan(atan2(100cqw,var(--wwv-w)))));' +
  'transform:scale(min(1,calc(100cqw / var(--wwv-w))))' +
  '}';

export function WhereWhatWhenPicture(props: {
  feed: SpotHeroFeed;
  serverNowMs: number;
  deferMap?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () =>
      setScale(Math.min(1, el.getBoundingClientRect().width / PICTURE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      style={{
        containerType: 'inline-size',
        position: 'relative',
        width: '100%',
        maxWidth: PICTURE_W * SHOWN,
        aspectRatio: `${PICTURE_W} / ${PICTURE_H}`,
        marginInline: 'auto',
        ['--wwv-w' as string]: `${PICTURE_W}px`,
      }}
    >
      <style href="wwv-fit" precedence="default">
        {FIT_CSS}
      </style>
      <div
        className="wwv-fit"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: PICTURE_W,
          height: PICTURE_H,
          transformOrigin: 'top left',
          transform: scale == null ? undefined : `scale(${scale})`,
        }}
      >
        <WhereWhatWhenPhone {...props} />
      </div>
    </div>
  );
}
