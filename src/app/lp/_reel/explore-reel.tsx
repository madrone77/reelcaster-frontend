"use client";

import Image from "next/image";
import { Home, Map, NotebookPen, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { tierFor, TIER_PIN } from "@/app/explore/lib/explore-data";
import type { ReelPin } from "./city-proof";
import { placePin, panFor, inSafeArea, type ReelFrame } from "./reel-frame";

/**
 * The hero: Explore, on a phone, walking its own spots.
 *
 * The static shot it replaces showed one screen holding still, which is the
 * one thing this product does not do. The claim being made is that every mark
 * around the city is scored separately, and a reader accepts that far quicker
 * from watching the answer change spot to spot than from a sentence saying so.
 *
 * HOW IT IS BUILT, AND WHY THIS WAY
 * The map is a still of the real Explore map with its pin layer switched off,
 * chosen by the `frame` prop (see reel-frame.ts). Everything above it -- pins,
 * counter, preview card, chrome -- is markup, so the active pin can grow and
 * the card can change without a second image per spot and without a video that
 * goes stale the next time a score moves. It also stays sharp on any display,
 * which a screen-recorded MP4 at a fixed resolution does not.
 *
 * The spots, the scores and the three readings on the card are the SAME
 * payload the marks band further down the page is built from, so the phone
 * cannot advertise a spot at 88 above a list that has it at 84.
 *
 * COST
 * One image of well under 100 KB per city, and this component. No map engine,
 * no tile requests, no video. The image keeps `priority` because it is still the hero's LCP
 * element, and nothing here blocks it: the pins are absolutely positioned over
 * it and the first card is rendered on the server.
 */

/**
 * The tab bar, matching components/mobile-bottom-nav.tsx tab for tab and icon
 * for icon. Explore is the lit one because Explore is what the phone is
 * showing; a hero whose nav highlights a tab other than the screen it is on
 * is a mistake nobody can name but everybody feels.
 */
const REEL_TABS: { label: string; Icon: LucideIcon; on?: boolean }[] = [
  { label: "Home", Icon: Home },
  { label: "Explore", Icon: Map, on: true },
  { label: "Catch log", Icon: NotebookPen },
  { label: "More", Icon: MoreHorizontal },
];

/** How long the reel rests on each spot. */
const DWELL_MS = 2400;

/** Most marks the reel will walk. Past this it stops reading as a tour. */
const MAX_STOPS = 8;

/**
 * Map pixels below which two pins are the same pin as far as a reader is
 * concerned. The real map declutters on zoom; this still cannot, so a stop
 * that would land under a pin already drawn is dropped instead. Highlighting
 * a badge that is sitting behind another badge reads as the reel losing its
 * place, which is worse than showing one mark fewer.
 */
const PIN_GAP = 26;

/**
 * The card's sparkline: 24 hourly scores folded into 12 two-hour buckets, the
 * best window at full strength and the rest at a tint.
 *
 * Deliberately the same shape as components/spot-trend.tsx rather than a call
 * to it: that one is a Tailwind component built for the rail card, and this
 * page carries its own injected stylesheet with no Tailwind in reach. The
 * numbers it draws still come from the same series and the same window
 * function, so the two agree on the thing that matters.
 */
function TrendBars({
  hours,
  from,
  to,
}: {
  hours: number[];
  from: number;
  to: number;
}) {
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const pair = [hours[2 * i], hours[2 * i + 1]].filter(
      (v): v is number => typeof v === "number",
    );
    const score = pair.length ? pair.reduce((a, b) => a + b, 0) / pair.length : 0;
    const lit =
      from >= 0 && ((2 * i >= from && 2 * i <= to) || (2 * i + 1 >= from && 2 * i + 1 <= to));
    return { score, lit };
  });
  return (
    <span className="reeltrend" aria-hidden>
      {buckets.map((b, i) => (
        <i
          key={i}
          className={b.lit ? "lit" : undefined}
          style={{ height: `${Math.max(12, (b.score / 100) * 100)}%` }}
        />
      ))}
    </span>
  );
}

export default function ExploreReel({
  cityName,
  pins,
  frame,
}: {
  cityName: string;
  pins: ReelPin[];
  /** Which capture this reel is drawn on, and the geometry that placed it.
   *  A parameter rather than a module constant, so a second city costs a
   *  capture rather than a fork of this file. See reel-frame.ts. */
  frame: ReelFrame;
}) {
  /**
   * The stops, in the order the eye should travel: north to south down the
   * water, not best-score-first. A reel that jumps top, bottom, middle reads
   * as a slideshow; one that walks the channel reads as somebody scanning the
   * water, which is the thing being sold.
   *
   * Spots under the chip row or behind the preview card are dropped. Drawing a
   * pin the reader cannot see, then highlighting it, is the reel appearing to
   * break.
   */
  const stops = useMemo(() => {
    const visible = pins
      .map((p) => {
        const at = placePin(frame, p.lng, p.lat);
        return { pin: p, at, pan: panFor(frame, at.x, at.y) };
      })
      // Eligibility is tested in the WINDOW, after the sheet has slid to the
      // mark: a stop is fine wherever it sits on the sheet as long as the
      // window can bring it out from under the chrome. That only fails at the
      // sheet's own edges, where the pan clamps and the pin cannot be
      // centred.
      .filter(({ at, pan }) => inSafeArea(at.x - pan.tx, at.y - pan.ty));
    // Best first, decluttered, cut to length, THEN ordered by latitude: taking
    // the top of a latitude-sorted list would hand the reel whichever marks
    // happen to be furthest north rather than the ones worth showing.
    const kept: typeof visible = [];
    for (const v of visible) {
      const clash = kept.some(
        (k) => Math.abs(k.at.x - v.at.x) < PIN_GAP && Math.abs(k.at.y - v.at.y) < PIN_GAP,
      );
      if (!clash) kept.push(v);
      if (kept.length === MAX_STOPS) break;
    }
    return kept.sort((a, b) => a.at.y - b.at.y);
  }, [pins, frame]);

  const [i, setI] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);

  /**
   * Advance only while the hero is on screen and the visitor has not asked for
   * less motion.
   *
   * The observer is not a micro-optimisation: this page is long, and a timer
   * that keeps repainting a phone nobody is looking at for the whole visit is
   * exactly the sort of thing that shows up as battery on a phone and as
   * nothing at all in a lab test.
   */
  useEffect(() => {
    if (stops.length < 2) return;
    const quiet = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (quiet?.matches) return;

    const host = hostRef.current;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => setI((n) => (n + 1) % stops.length), DWELL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (!host || typeof IntersectionObserver === "undefined") {
      start();
      return stop;
    }
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? start() : stop()),
      { threshold: 0.15 },
    );
    io.observe(host);
    return () => {
      io.disconnect();
      stop();
    };
  }, [stops.length]);

  if (!stops.length) return null;

  const active = stops[Math.min(i, stops.length - 1)];
  const card = active.pin;
  const tier = tierFor(card.score);

  return (
    <div className="reel" ref={hostRef}>
      {/* Announced once, as a still description. A live region that re-read
          the spot name every 2.4 seconds would make the page unusable with a
          screen reader on, and the reel is illustration: every spot in it is
          also a real link in the marks band below. */}
      <div className="reelphone" role="img"
        aria-label={`The ReelCaster Explore map on a phone, cycling through ${stops.length} scored fishing spots around ${cityName}.`}>
        {/* The black shell is a CHILD of the container, not the container
            itself. Only a descendant can read cqw; the container element
            cannot query its own size, and a cqw written on .reelphone falls
            back to the viewport instead of failing loudly. */}
        <div className="reelbody">
          <div className="reelscreen">
          <div className="reelnav">
            {/* The app's own bar carries the mark, so the phone does too.
                White-on-brand variant, because this strip is the brand blue;
                the blue knockout would put a blue box on a blue bar. */}
            <Image
              className="reelwm"
              src="/reelcaster-mark-white.svg"
              alt=""
              width={104}
              height={48}
              priority
            />
            {/* Sentence case in the markup and uppercased in CSS, as the
                real button is: the label a screen reader reads should be the
                label the product uses. */}
            <span className="reelnavcta">Start free trial</span>
          </div>

          <div className="reelmap">
            {/* The sheet, and everything pinned to it, slide together as one
                transform. Pins are positioned in percentages of THIS layer,
                so they cannot drift out of register with the image no matter
                what the pan is doing -- there is only ever one thing moving. */}
            <div
              className="reelpan"
              style={{
                ["--iw" as string]: frame.width,
                ["--ih" as string]: frame.height,
                ["--tx" as string]: active.pan.tx,
                ["--ty" as string]: active.pan.ty,
              }}
            >
            <Image
              src={frame.src}
              alt=""
              width={frame.width * 2}
              height={frame.height * 2}
              priority
              sizes="(min-width: 420px) 505px, 135vw"
              className="reelmapimg"
            />

            {stops.map((s, n) => {
              const on = n === i;
              return (
                <span
                  key={s.pin.slug}
                  className={`reelpin${on ? " on" : ""}`}
                  style={{
                    left: s.at.left,
                    top: s.at.top,
                    // The product's own pin colour for the tier, so a pin here
                    // is the colour it would be on the real map.
                    ["--pin" as string]: TIER_PIN[tierFor(s.pin.score)],
                  }}
                >
                  {on ? <i className="reelping" /> : null}
                  <b>{s.pin.score}</b>
                </span>
              );
            })}
            </div>

            <div className="reelchip">
              {/* City and region, as Explore's own location chip reads them. */}
              <span className="reelloc">
                {cityName} · {frame.regionLabel}
              </span>
              <span className="reeladd">Add spot</span>
            </div>

            <div className="reelcount">
              {i + 1} of {stops.length}
            </div>

            {/* Keyed so React remounts it on every stop: the fade is a mount
                animation, which is far less code than orchestrating an
                out-then-in transition and cannot get stuck half faded. */}
            <div className="reelcard" key={card.slug}>
              <div className="reelcardtop">
                <span className="reelspot">{card.name}</span>
                {/* "88 GOOD" — the same string the real spot card builds,
                    from the same tier function. */}
                <span className={`reelbadge ${tier}`}>
                  {card.score} {tier.toUpperCase()}
                </span>
              </div>
              <div className="reelsp">
                {card.species}
                {/* The management area, as the regulator numbers it. Muted,
                    because it is where the mark is rather than what is biting
                    there -- and it earns its place beside the species because
                    seasons and limits are set per area, so it is the first
                    thing an angler checks a spot name against. */}
                {card.area ? <span className="reelarea">{card.area}</span> : null}
              </div>
              {/* The three readings and the day's shape, side by side, as the
                  real card lays them out. */}
              <div className="reelmetarow">
                <div className="reelmeta">
                  <span>
                    <em>WIND</em>
                    {card.wind ?? "—"}
                  </span>
                  <span>
                    <em>SEA</em>
                    {card.sea ?? "—"}
                  </span>
                  <span>
                    <em>CURRENT</em>
                    {card.current ?? "—"}
                  </span>
                </div>
                <TrendBars hours={card.hours} from={card.bestFrom} to={card.bestTo} />
              </div>
              <div className="reelmore">
                <span>VIEW MORE →</span>
                <b aria-hidden>★</b>
              </div>
            </div>

            {/* The app's four tabs, drawn with the app's own icons rather
                than lookalikes: these are the same lucide glyphs
                components/mobile-bottom-nav.tsx renders, imported from the
                same package, so the phone in the hero cannot end up with a
                tab bar the product does not have. */}
            <div className="reeltabs">
              {REEL_TABS.map(({ label, Icon, on }) => (
                <span key={label} className={on ? "on" : undefined}>
                  <Icon aria-hidden />
                  <em>{label}</em>
                </span>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
