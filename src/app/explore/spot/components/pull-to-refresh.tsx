"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";

/**
 * Pull down at the top of the spot page to refetch the live numbers.
 *
 * Renders nothing but a floating indicator — the page content does NOT move
 * with the finger, deliberately. Translating the content would mean wrapping
 * it in a `transform`, and a transformed ancestor becomes the containing block
 * for every `position: fixed` descendant: the top bar, the mobile tab bar and
 * the dialogs inside this tree would all start scrolling with the page. The
 * indicator alone carries the gesture.
 *
 * Touch only. There is no mouse path — a desktop reader has the browser's own
 * reload, and the page has a visible freshness stamp.
 */

/** Pull distance that arms the refresh. */
const THRESHOLD = 64;
/**
 * Where the indicator parks while the refresh runs — snapping back up from
 * wherever the finger left it, the way a native refresh control does.
 *
 * Deliberately shallower than THRESHOLD. Nothing moves out of its way (see
 * below), so a deep park would sit on the spot name for the length of the
 * request; this tucks it into the gap under the top bar instead.
 */
const REST = 44;
/** Hard cap on travel, however far the finger goes. */
const MAX = 132;
/** Indicator diameter. */
const SIZE = 36;

/**
 * Height of the fixed top bar — ExploreTopBar and AdBrandBar are both
 * `fixed top-0 z-40 h-16`.
 *
 * The indicator parks itself behind that bar at rest (`z-30`, one layer under
 * it) and rides out from underneath as the page is pulled, the way a native
 * refresh control emerges from behind a nav bar. Drawn OVER the bar instead it
 * read as a white disc glitching across the brand blue.
 */
const TOP_BAR = 64;

/**
 * Minimum time the spinner stays up.
 *
 * A warm cache answers in ~50ms, which reads as the gesture having done
 * nothing at all. This is the only thing here that is not driven by the real
 * request; it never *shortens* the wait.
 */
const MIN_SPIN_MS = 450;

/**
 * Rubber band. Linear at the start so the indicator tracks the finger, then
 * asymptotic toward MAX so a long drag has somewhere to go without the
 * indicator sliding down the whole screen.
 */
function damp(dy: number): number {
  return MAX * (1 - Math.exp(-dy / MAX));
}

type Phase = "idle" | "pulling" | "refreshing";

export default function PullToRefresh({
  onRefresh,
}: {
  /** Resolves when the refetched data has landed. Never rejects — errors are
   *  the caller's to swallow, since a failed refresh still ends the gesture. */
  onRefresh: () => Promise<unknown>;
}) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  // Gesture bookkeeping. Refs, not state: these are written on every touchmove
  // and read inside the listeners, so a render per pixel would be waste.
  const startY = useRef(0);
  const startX = useRef(0);
  const tracking = useRef(false);
  const engaged = useRef(false);
  const distance = useRef(0);
  // The listeners are bound once, so they read the live phase from here rather
  // than closing over a stale one.
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const run = useCallback(async () => {
    setPhase("refreshing");
    setPull(REST);
    const started = Date.now();
    try {
      await onRefresh();
    } catch {
      // A refresh that failed still has to let go of the screen.
    }
    const left = MIN_SPIN_MS - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    setPull(0);
    setPhase("idle");
  }, [onRefresh]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      tracking.current = false;
      engaged.current = false;
      distance.current = 0;
      if (phaseRef.current === "refreshing") return;
      // Pinch-zoom and other multi-touch gestures are not a pull.
      if (e.touches.length !== 1) return;
      // Only from the very top of the document.
      if (window.scrollY > 0) return;
      // Anything that handles its own drag — the mini map's canvas, the
      // horizontally scrolling day strip — keeps its gesture. Opting out means
      // the browser's own pull-to-refresh answers there instead, which is a
      // reload: still a refresh, just a blunter one.
      const target = e.target as Element | null;
      if (target?.closest?.("canvas, [data-no-pull-refresh]")) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      tracking.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current) return;
      if (e.touches.length !== 1) {
        tracking.current = false;
        setPull(0);
        setPhase("idle");
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;

      if (!engaged.current) {
        // Decide on the FIRST move of the gesture, and preventDefault there if
        // the answer is yes. iOS commits to its own overscroll on the opening
        // move of a drag, so a threshold measured over a few frames would let
        // Safari's rubber band start underneath ours.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          tracking.current = false;
          return;
        }
        engaged.current = true;
      }

      // The document moved under us (momentum from an earlier flick, an
      // anchor jump): the gesture is no longer a pull from the top.
      if (window.scrollY > 0) {
        tracking.current = false;
        engaged.current = false;
        setPull(0);
        setPhase("idle");
        return;
      }

      // Suppresses the browser's own pull-to-refresh and the rubber band.
      if (e.cancelable) e.preventDefault();
      const next = dy > 0 ? damp(dy) : 0;
      distance.current = next;
      setPull(next);
      setPhase("pulling");
    };

    const onEnd = () => {
      if (!tracking.current || !engaged.current) return;
      tracking.current = false;
      engaged.current = false;
      if (distance.current >= THRESHOLD) {
        void run();
      } else {
        setPull(0);
        setPhase("idle");
      }
      distance.current = 0;
    };

    const onCancel = () => {
      tracking.current = false;
      engaged.current = false;
      distance.current = 0;
      if (phaseRef.current !== "refreshing") {
        setPull(0);
        setPhase("idle");
      }
    };

    // `passive: false` on the move listener is what makes preventDefault
    // possible; touchmove is passive by default on the document.
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [run]);

  const refreshing = phase === "refreshing";
  const armed = !refreshing && pull >= THRESHOLD;
  const visible = pull > 2 || refreshing;

  return (
    <div
      aria-hidden={!refreshing}
      role="status"
      className="fixed left-1/2 top-0 z-30"
      style={{
        // At rest it sits tucked behind the bottom edge of the top bar and
        // rides the pull down from there.
        transform: `translate(-50%, ${TOP_BAR - SIZE + pull}px)`,
        opacity: refreshing ? 1 : visible ? Math.min(1, pull / THRESHOLD) : 0,
        transition:
          phase === "pulling"
            ? "none"
            : "transform 220ms ease-out, opacity 220ms ease-out",
        pointerEvents: "none",
      }}
    >
      <div
        className="grid place-items-center rounded-full border border-rc-rule bg-rc-panel shadow-rc-panel"
        style={{ width: SIZE, height: SIZE }}
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-rc-brand" />
        ) : (
          <ArrowDown
            className="h-4 w-4 text-rc-ink-mute transition-transform duration-150"
            style={{
              transform: armed ? "rotate(180deg)" : "rotate(0deg)",
              color: armed ? "var(--rc-brand)" : undefined,
            }}
          />
        )}
      </div>
      <span className="sr-only">{refreshing ? "Refreshing" : ""}</span>
    </div>
  );
}
