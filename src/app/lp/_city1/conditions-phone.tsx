"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CurrentConditionsStrip from "@/app/explore/spot/components/current-conditions-strip";
import SpotTerminal from "@/app/explore/spot/components/spot-terminal";
import { buildTerminalHours } from "@/app/explore/lib/terminal-hours";
import { bestWindow } from "@/app/explore/components/hourly-bars";
import { useSpotClock } from "@/app/explore/lib/use-spot-clock";
import {
  localDayStartUtcMs,
  signCurrentSeries,
} from "@/app/explore/lib/current-series";
import { fetchCurrentsPoint } from "@/lib/bluecaster-client";
import type { CurrentSample } from "@/lib/bluecaster-client";
import type { ConditionsFeed } from "./load-conditions";

/**
 * The second phone: one mark's real day, scrubbing itself.
 *
 * It replaces the still screenshot in the WHERE / WHAT / WHEN slot on /lp/4,
 * and the reason is the reason the Explore reel replaced the still above it.
 * A screenshot of this screen is a picture of numbers. The screen's whole
 * argument is that the numbers MOVE — that tide, current, wind, sea and sky
 * are lined up on the same hour, and that dragging across the day changes all
 * of them together. A reader gets that from watching it happen in about two
 * seconds, and from a caption never.
 *
 * ── What is real here ────────────────────────────────────────────────────
 *
 * All of it. This is not a mockup and not a recording: it is the SAME
 * CurrentConditionsStrip and SpotTerminal the spot page and the city
 * instrument render, on today's real payload for the mark the hero is already
 * about, rebuilt whenever the page's cache is. That is why it is worth the
 * component rather than an MP4 — a video of a good day keeps advertising that
 * day forever, and this cannot show a score the product would not show.
 *
 * It also means the phone is USABLE. Touch it and the sweep hands over: the
 * chart is a real slider with real hours under it, so a reader who scrubs it
 * has used the product before clicking anything.
 *
 * ── No app bar, no tab bar ───────────────────────────────────────────────
 *
 * The Explore reel above wears both, because a map with no chrome around it
 * is just a map. This one deliberately does not. The screen it is drawing is
 * ~750px of instrument on its own, and hanging a 116px bar over it and a 76px
 * one under it made a phone half again taller than any iPhone has ever been:
 * 375 by 948, when the device it is meant to look like is 375 by 812. Chrome
 * that costs the picture its proportions is chrome that is arguing against
 * the thing it frames.
 *
 * The dynamic island stays, drawn in CSS on the screen itself, because it is
 * what still says "phone" once the bars are gone. Nothing else is drawn up
 * there: no clock, no battery, no carrier. Same rule as the reel, and for the
 * same reason -- a frame that invents a battery percentage is a frame with a
 * detail in it somebody has to keep honest.
 *
 * ── Why the pane and the chart are told they are on a phone ──────────────
 *
 * Both components swap layout at Tailwind's `lg`, which asks how wide the
 * WINDOW is. Inside a phone frame that is the wrong question — the container
 * is 375px and the window is a laptop — so both take a `phone` prop that pins
 * the answer to the container. See their own notes.
 */

/** How long the sweep spends on one hour. Slow enough to read the numbers. */
const HOUR_MS = 1000;

/** Sweep resolution. The line glides; the readouts still step by the hour. */
const TICK_MS = 80;

/** Rest at each end of the day before turning back. */
const DWELL_MS = 1800;

export default function ConditionsPhone({
  feed,
  serverNowMs,
}: {
  feed: ConditionsFeed;
  /** The instant the server baked this HTML. See useSpotClock. */
  serverNowMs: number;
}) {
  const { hour: nowHour } = useSpotClock(feed.tz, serverNowMs);

  const hours = useMemo(
    () => buildTerminalHours(feed.conditions, feed.scores),
    [feed.conditions, feed.scores],
  );
  // Memoized so the tuple keeps its identity: it feeds the terminal's rebuild
  // effect, and a fresh array every render would tear the SVG down on every
  // tick of the sweep.
  const win = useMemo(() => bestWindow(feed.scores), [feed.scores]);

  /**
   * The scorable range, which is not always the whole day.
   *
   * Leading and trailing hours can carry tide but no score — today's 00:00
   * before the morning bake, for instance — and they render as empty cells.
   * The terminal already refuses to park its cursor on one; the sweep has to
   * turn around at the same place or it spends four seconds a lap sitting on
   * a blank readout.
   */
  const [lo, hi] = useMemo(() => {
    const scored = feed.scores.map((v) => typeof v === "number" && Number.isFinite(v));
    const a = scored.indexOf(true);
    if (a < 0) return [0, 23] as const;
    let b = 23;
    while (b > a && !scored[b]) b--;
    return [a, b] as const;
  }, [feed.scores]);

  const clamp = (h: number) => Math.max(lo, Math.min(hi, h));

  /**
   * The scrubbed hour, FRACTIONAL.
   *
   * SpotTerminal's cursor is painted at `selectedHour + 0.5` and its readouts
   * are read at `Math.round(selectedHour)`, so a fractional value glides the
   * line and the tide dot while the numbers still change once per hour, on the
   * hour, which is the whole point of the animation. Handing it whole hours
   * instead would step the line 13px at a time and read as a slideshow.
   */
  const [hour, setHour] = useState(() => clamp(nowHour));
  const dir = useRef(1);
  const dwell = useRef(DWELL_MS);

  /** Set once the reader scrubs it themselves. The sweep never comes back. */
  const [taken, setTaken] = useState(false);

  /** Only sweep while it is on screen and motion is welcome. */
  const [running, setRunning] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setRunning(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(host);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (taken || !running) return;
    const id = setInterval(() => {
      setHour((prev) => {
        if (dwell.current > 0) {
          dwell.current -= TICK_MS;
          return prev;
        }
        const next = prev + (dir.current * TICK_MS) / HOUR_MS;
        if (next >= hi) {
          dir.current = -1;
          dwell.current = DWELL_MS;
          return hi;
        }
        if (next <= lo) {
          dir.current = 1;
          dwell.current = DWELL_MS;
          return lo;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [taken, running, lo, hi]);

  /**
   * Real predicted current at the mark, fetched after mount and never
   * blocking. Without it the chart draws its tide-derived shape and the strip
   * falls back to the tide trend — the product's own documented degradation,
   * not a broken row. Same call the spot page and the instrument make.
   */
  const [samples, setSamples] = useState<(CurrentSample | null)[] | null>(null);
  useEffect(() => {
    if (!feed.iso) return;
    const fromMs = localDayStartUtcMs(feed.iso, feed.tz);
    if (!Number.isFinite(fromMs)) return;
    let cancelled = false;
    fetchCurrentsPoint(
      feed.lat,
      feed.lng,
      new Date(fromMs).toISOString(),
      new Date(fromMs + 23 * 3_600_000).toISOString(),
    )
      .then((d) => {
        if (cancelled) return;
        const byHour: (CurrentSample | null)[] = new Array(24).fill(null);
        for (const s of d?.series ?? []) {
          const h = Math.round((Date.parse(s.t) - fromMs) / 3_600_000);
          if (h >= 0 && h < 24) byHour[h] = s;
        }
        setSamples(byHour);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [feed.iso, feed.tz, feed.lat, feed.lng]);

  const current = useMemo(
    () => (samples ? signCurrentSeries(samples, hours.tide) : null),
    [samples, hours.tide],
  );

  const read = Math.round(hour);

  /**
   * The tiles read the SCRUBBED hour, not the wall clock.
   *
   * `rightNow` is a snapshot of the live hour, and handing it straight to the
   * strip froze five of the eight tiles: the line swept the whole day while
   * tide, wind, sea, air and sky sat on whatever they were at 2 PM. Feeding it
   * the hour's own conditions cell is what the city instrument does, and it is
   * the entire point of the animation — the tiles have to move with the line
   * or the phone is arguing against itself.
   *
   * `hourLocal` is blanked because the TIME tile draws the hour itself.
   */
  const snapshot = useMemo(() => {
    const cell = feed.conditions[read];
    return cell ? { ...cell, hourLocal: "" } : feed.rightNow;
  }, [feed.conditions, feed.rightNow, read]);

  return (
    <div className="condphone" ref={hostRef}>
      <div className="condbody">
        <div className="condscreen">
          <div className="condpane">
            <CurrentConditionsStrip
              rightNow={snapshot}
              score={feed.scores[read] ?? null}
              currentSigned={current}
              hour={read}
              isNow={read === nowHour}
              phone
            />
            <SpotTerminal
              hours={hours}
              realCurrent={current}
              tideRange={feed.tideRange}
              sun={feed.sun}
              nowHour={nowHour}
              selectedHour={hour}
              onSelectHour={(h) => {
                // The reader has it now. Stop sweeping rather than fighting
                // them for the cursor a tick later.
                setTaken(true);
                setHour(h);
              }}
              bestWindow={win.window}
              phone
            />
          </div>
        </div>
      </div>
    </div>
  );
}
