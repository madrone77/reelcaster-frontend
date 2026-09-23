"use client";

/**
 * The hero reel's map screen as a picture: a baked still of the map (see
 * @/lib/map/reel-still) with today's pins and the walking card drawn over it
 * as markup. No MapLibre, no tiles, no WebGL.
 *
 * It behaves like MarketingMap on the same props: the same pins (drawn by the
 * map's own puck painter), the same featured marks, and the same card every
 * ROTATE_MS. The live map eased to each mark in turn; here the picture slides
 * under the window instead.
 *
 * A still that has not been captured yet 404s, and the live map takes its
 * place. That covers a new spot or city until the nightly capture reaches it.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  MarketingSpotCard,
  pickFeatured,
  ROTATE_MS,
  type MapSpot,
} from "@/app/(marketing)/components/marketing-map";
import { LOCK_LABEL, NO_DATA_LABEL, PUCK_TIP_OFFSET, puckImage } from "@/app/explore/lib/score-puck";
import { projectOnStill, STILL_WINDOW, type StillFrame } from "@/lib/map/reel-still";

/** The relief style's background, so the box is water-coloured before the picture lands. */
const WATER = "#AFD2E6";
/** How far above its pin the card sits, as on the live map. */
const CARD_LIFT = 46;

export default function ReelStillMap({
  frame,
  spots,
  featuredSlug,
  featuredSlugs,
  lockedSlugs,
  live,
}: {
  frame: StillFrame;
  spots: MapSpot[];
  featuredSlug?: string;
  featuredSlugs?: string[];
  lockedSlugs: ReadonlySet<string>;
  /** The live map, drawn instead when the still is missing. */
  live: ReactNode;
}) {
  const [missing, setMissing] = useState(false);
  // The pins are painted on a canvas, which the server has not got: they
  // arrive with the first client render after hydration, not during it.
  const [mounted, setMounted] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    setMounted(true);
    // A 404 that landed before hydration fired its error event before React
    // was listening for it.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  // The window is whatever box the phone frame gives the map screen.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Everything positioned on the sheet. A mark off the sheet (a clipped city)
  // is not drawn and not walked to.
  const placed = useMemo(() => {
    const on = new Map<string, { x: number; y: number }>();
    for (const s of spots) {
      const p = projectOnStill(frame, s.lat, s.lng);
      if (p.x >= 0 && p.y >= 0 && p.x <= frame.w && p.y <= frame.h) on.set(s.slug, p);
    }
    return on;
  }, [spots, frame]);

  const featured = useMemo(
    () =>
      pickFeatured(spots, featuredSlug, featuredSlugs, lockedSlugs).filter((s) =>
        placed.has(s.slug),
      ),
    [spots, featuredSlug, featuredSlugs, lockedSlugs, placed],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const featuredCount = featured.length;
  useEffect(() => {
    if (featuredCount < 2 || missing) return;
    const id = window.setInterval(() => setActiveIdx((i) => (i + 1) % featuredCount), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [featuredCount, missing]);
  const active = featured[activeIdx % Math.max(1, featuredCount)] ?? null;
  const activeAt = active ? placed.get(active.slug) ?? null : null;

  if (missing) return <>{live}</>;

  // Slide the sheet so the active mark sits in the middle of the window,
  // never past the sheet's edge.
  const target = activeAt ?? { x: frame.w / 2, y: frame.h / 2 };
  const pan = (size: number, sheet: number, at: number) =>
    sheet <= size ? (size - sheet) / 2 : Math.min(0, Math.max(size - sheet, size / 2 - at));
  const tx = box ? pan(box.w, frame.w, target.x) : -(target.x - STILL_HALF_W);
  const ty = box ? pan(box.h, frame.h, target.y) : -(target.y - STILL_HALF_H);

  // Ascending score, so the best puck is drawn last and sits on top.
  const order = [...spots]
    .filter((s) => placed.has(s.slug))
    .sort((a, b) => (a.score ?? -1) - (b.score ?? -1));

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full overflow-hidden [container-type:inline-size]"
      style={{ background: WATER }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: frame.w,
          height: frame.h,
          transform: `translate(${tx}px, ${ty}px)`,
          // Only once it has settled into its box, so the first frame does
          // not glide in from the corner.
          transition: box ? "transform 1.6s ease" : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
            picture the pins are positioned on, not a responsive image */}
        <img
          ref={imgRef}
          src={frame.src}
          alt=""
          width={frame.w}
          height={frame.h}
          decoding="async"
          fetchPriority="low"
          onError={() => setMissing(true)}
          style={{ width: frame.w, height: frame.h, maxWidth: "none" }}
          draggable={false}
        />
        {mounted &&
          order.map((s) => {
            const at = placed.get(s.slug)!;
            const locked = lockedSlugs.has(s.slug);
            const label = locked ? LOCK_LABEL : s.score === null ? NO_DATA_LABEL : String(s.score);
            const img = puckImage(label, active?.slug === s.slug ? "sel" : "base");
            if (!img) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element -- a data URL sprite
              <img
                key={s.slug}
                src={img.src}
                alt=""
                aria-hidden
                width={img.w}
                height={img.h}
                className="pointer-events-none absolute"
                style={{
                  left: at.x - img.w / 2,
                  top: at.y - img.h + PUCK_TIP_OFFSET,
                  width: img.w,
                  height: img.h,
                  maxWidth: "none",
                  opacity: s.score === null && !locked ? 0.6 : 1,
                }}
              />
            );
          })}
        {active && activeAt && (
          <div
            className="absolute"
            style={{
              left: activeAt.x,
              top: activeAt.y - CARD_LIFT,
              transform: "translate(-50%, -100%)",
            }}
          >
            <MarketingSpotCard key={active.slug} spot={active} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Before the box is measured, centre on the phone's map box. */
const STILL_HALF_W = STILL_WINDOW.w / 2;
const STILL_HALF_H = STILL_WINDOW.h / 2;
