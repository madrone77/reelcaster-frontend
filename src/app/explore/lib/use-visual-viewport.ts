"use client";

import { useEffect, useState } from "react";

export interface ViewportMetrics {
  /** How many px of the layout viewport's bottom edge the keyboard covers. */
  keyboard: number;
  /** Height of the area the user can actually see right now, in px. */
  height: number;
}

/**
 * Anything below this is browser chrome moving (the collapsing URL bar), not a
 * keyboard. A software keyboard is never this short; the URL bar never this
 * tall.
 */
const KEYBOARD_MIN = 100;

/**
 * Measures the *visual* viewport — the part of the page a phone is actually
 * showing — so a bottom-pinned sheet can sit on top of the on-screen keyboard
 * instead of underneath it.
 *
 * Why this is needed at all: opening the keyboard does not resize the page.
 * Both mobile Safari and Chrome shrink only the visual viewport and leave the
 * layout viewport alone, and `position: fixed` is laid out against the *layout*
 * viewport. So a sheet at `bottom: 0` renders behind the keyboard, the browser
 * then pans the whole visual viewport upwards to drag the focused input into
 * sight, and the result is the page apparently scrolled halfway off the screen
 * with fixed chrome stranded in the middle of it — recoverable only by a resize
 * (a rotate, or dismissing the keyboard).
 *
 * `keyboard` is measured in layout-viewport coordinates, which is the same
 * space `bottom` is resolved in, so `bottom: keyboard` puts a fixed element's
 * bottom edge exactly on the top of the keyboard — correct even mid-pan.
 * Placing the sheet there means the focused input is already visible, so the
 * browser has no reason to pan in the first place.
 *
 * Pass `active: false` (panel closed, or desktop) to unsubscribe and report
 * zero — this runs on every keyboard and scroll event, so it should only be
 * live while something is relying on it.
 */
export function useVisualViewport(active: boolean): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>({
    keyboard: 0,
    height: 0,
  });

  useEffect(() => {
    if (!active) {
      setMetrics({ keyboard: 0, height: 0 });
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setMetrics({
        keyboard: covered > KEYBOARD_MIN ? Math.round(covered) : 0,
        height: Math.round(vv.height),
      });
    };
    // The keyboard animates in, firing a burst of resize + scroll events.
    // Coalesce them to one measurement per frame.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
    };
  }, [active]);

  return metrics;
}
