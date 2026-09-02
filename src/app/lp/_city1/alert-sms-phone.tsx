"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatAlertSms,
  type AlertSmsParts,
  type AlertSmsWhen,
} from "./alert-sms";

/**
 * The third picture: the text arriving.
 *
 * The reel says which mark. The conditions phone says what the day looks like
 * there. Both still ask the reader to go and look. This one is the offer the
 * page actually makes -- that they do not have to look, because we will tell
 * them -- and an arriving text is the only way to show a thing whose whole
 * value is that it reaches you when you are not on the page.
 *
 * ── Which message this is ────────────────────────────────────────────────
 *
 * The LEAD-TIME heads-up, not the day-of alert. The phone's own clock is a
 * weekday morning and the text is about the Sunday coming: that gap is the
 * product, and it is what the band's headline is promising. A text naming an
 * hour with no day would only be useful to somebody already awake.
 *
 * ── What is real, and what is not ────────────────────────────────────────
 *
 * The FORMAT is real, built by formatAlertSms() from the same shape as the
 * alert engine's own subject line; see alert-sms.ts. The NUMBERS are written
 * down per city rather than read live, and that is a deliberate difference
 * from the conditions phone above: this is a picture of a message, so whatever
 * it shows is frozen when the page is built, and dressing it up as live would
 * be the dishonest option rather than the careful one. What it must not do is
 * name a mark we do not score or an hour that mark does not peak at.
 *
 * ── Why a lock screen and not a thread ───────────────────────────────────
 *
 * This was a Messages thread first, and it was accurate and weak: a real
 * thread holding one message is four fifths empty, so the picture was mostly
 * white. A lock screen is also the truer moment. The value being sold is that
 * the text reaches an angler who is not looking at anything, and the place you
 * meet a text you were not waiting for is the lock screen, not a thread you
 * had to open.
 *
 * ── The animation ────────────────────────────────────────────────────────
 *
 * The banner drops in, holds, fades, and the screen sits empty for a beat
 * before it comes again. The empty beat is what makes it read as ARRIVING
 * rather than as a screenshot -- a banner that is simply always there is a
 * still picture with rounded corners.
 *
 * It pauses off screen and does not run at all under prefers-reduced-motion,
 * where it renders the banner and leaves it: the message is the content, so
 * the reduced-motion view is the whole band rather than a degraded version of
 * it. Same reason the server renders the "sent" state.
 */

/** Beat timings, ms: how long the banner holds, and the empty beat before it. */
const HOLD_MS = 5200;
const EMPTY_MS = 1100;

type Phase = "empty" | "shown";

export default function AlertSmsPhone({
  parts,
  when,
  /** Wall-clock label on the lock screen. Written down, not read: a picture of
   *  a phone whose clock is the reader's own is the detail that gives a mock
   *  away, and a clock that ticks would be a hydration mismatch besides. */
  timeLabel,
}: {
  parts: AlertSmsParts;
  /** Computed on the server so the day cannot go stale. See nextSundayFrom. */
  when: AlertSmsWhen;
  timeLabel: string;
}) {
  const body = formatAlertSms(parts, when);

  // Server and first client render agree on "sent": the message is the point
  // of the band, so it must be in the HTML rather than animated in after
  // hydration. The cycle takes over on mount, and only when it should run.
  const [phase, setPhase] = useState<Phase>("shown");
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
      threshold: 0.3,
    });
    io.observe(host);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    // A timeout chain rather than an interval, so a backgrounded tab cannot
    // stack beats on top of one another and flicker when it comes back.
    let t: ReturnType<typeof setTimeout>;
    const hold = () => {
      t = setTimeout(() => {
        setPhase("empty");
        t = setTimeout(() => {
          setPhase("shown");
          hold();
        }, EMPTY_MS);
      }, HOLD_MS);
    };
    hold();
    return () => clearTimeout(t);
  }, [running]);

  return (
    <div className="smsphone" ref={hostRef}>
      <div className="smsbody">
        <div className="smsscreen">
          <div className="smsclock">
            <span className="smsdate">{when.arrivedOn}</span>
            <span className="smstime">{timeLabel}</span>
          </div>
          {/* The banner is always in the DOM so the message is readable to a
              crawler and to anyone whose motion setting stops the loop; the
              phase only drives its visibility. */}
          <div className={`smsbanner${phase === "shown" ? " on" : ""}`}>
            <span className="smsicon" aria-hidden>
              RC
            </span>
            <div className="smsmsg">
              <div className="smshead">
                <span className="smsapp">ReelCaster</span>
                <span className="smswhen">now</span>
              </div>
              <p className="smstext">{body}</p>
            </div>
          </div>
          <div className="smsbar" aria-hidden />
        </div>
      </div>
    </div>
  );
}
